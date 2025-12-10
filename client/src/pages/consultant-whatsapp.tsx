import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Server, 
  Key, 
  Phone,
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Save,
  ExternalLink,
  Plus,
  Trash2,
  Sparkles,
  Clock,
  Building2,
  FileText,
  User,
  Edit,
  Bot,
  Users,
  Copy,
  Lightbulb,
  ChevronRight,
  Info,
  Mail,
  ClipboardCheck
} from "lucide-react";
import WhatsAppLayout from "@/components/whatsapp/WhatsAppLayout";
import { getAuthHeaders } from "@/lib/auth";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { AgentInstructionsPanel } from "@/components/whatsapp/AgentInstructionsPanel";
import { whatsappAgentIdeas } from "@/data/whatsapp-agent-ideas";

interface WhatsAppConfig {
  id?: string;
  agentName: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioWhatsappNumber: string;
  autoResponseEnabled: boolean;
  agentType?: "reactive_lead" | "proactive_setter";
  workingHoursEnabled?: boolean;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  workingDays?: string[];
  afterHoursMessage?: string;
  businessName?: string;
  consultantDisplayName?: string;
  businessDescription?: string;
  consultantBio?: string;
  salesScript?: string;
  vision?: string;
  mission?: string;
  values?: string[];
  usp?: string;
  whoWeHelp?: string;
  whoWeDontHelp?: string;
  whatWeDo?: string;
  howWeDoIt?: string;
  softwareCreated?: Array<{ name: string; description: string }>;
  booksPublished?: Array<{ title: string; year: string }>;
  yearsExperience?: number;
  clientsHelped?: number;
  resultsGenerated?: string;
  caseStudies?: Array<{ clientName: string; result: string }>;
  servicesOffered?: Array<{ name: string; description: string; price: string }>;
  guarantees?: string;
  aiPersonality?: "amico_fidato" | "coach_motivazionale" | "consulente_professionale" | "mentore_paziente" | "venditore_energico" | "consigliere_empatico" | "stratega_diretto" | "educatore_socratico" | "esperto_tecnico" | "compagno_entusiasta";
  whatsappConciseMode?: boolean;
  defaultObiettivi?: string;
  defaultDesideri?: string;
  defaultUncino?: string;
  defaultIdealState?: string;
  isDryRun?: boolean;
  agentInstructions?: string | null;
  agentInstructionsEnabled?: boolean;
  selectedTemplate?: "receptionist" | "marco_setter" | "custom";
}

const emptyConfig: WhatsAppConfig = {
  agentName: "",
  twilioAccountSid: "",
  twilioAuthToken: "",
  twilioWhatsappNumber: "",
  autoResponseEnabled: true,
  agentType: "reactive_lead" as "reactive_lead" | "proactive_setter",
  workingHoursEnabled: false,
  workingHoursStart: "09:00",
  workingHoursEnd: "18:00",
  workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  afterHoursMessage: "Ciao! Ti risponderò durante i miei orari di lavoro.",
  businessName: "",
  consultantDisplayName: "",
  businessDescription: "",
  consultantBio: "",
  salesScript: "",
  vision: "",
  mission: "",
  values: [],
  usp: "",
  whoWeHelp: "",
  whoWeDontHelp: "",
  whatWeDo: "",
  howWeDoIt: "",
  softwareCreated: [],
  booksPublished: [],
  yearsExperience: undefined,
  clientsHelped: undefined,
  resultsGenerated: "",
  caseStudies: [],
  servicesOffered: [],
  guarantees: "",
  aiPersonality: "amico_fidato",
  whatsappConciseMode: false,
  defaultObiettivi: "",
  defaultDesideri: "",
  defaultUncino: "",
  defaultIdealState: "",
  isDryRun: true,
  agentInstructions: null,
  agentInstructionsEnabled: false,
  selectedTemplate: "receptionist",
};

export default function ConsultantWhatsAppPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<WhatsAppConfig | null>(null);
  const [newApiKey, setNewApiKey] = useState("");

  const searchParams = new URLSearchParams(useSearch());
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "system" ? "system" : "custom";

  // Load existing WhatsApp configs
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
      const data = await response.json();
      return data;
    },
  });

  const configs = existingConfigs?.configs || [];

  // Delete WhatsApp config mutation
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

  // Duplicate WhatsApp config mutation
  const duplicateMutation = useMutation({
    mutationFn: async (config: WhatsAppConfig) => {
      // Invece di creare subito, apri il dialog con i dati pre-compilati
      const duplicateData = {
        agentName: `${config.agentName} - Copia`,
        twilioAccountSid: "",
        twilioAuthToken: "",
        twilioWhatsappNumber: "",
        autoResponseEnabled: config.autoResponseEnabled,
        agentType: config.agentType,
        workingHoursEnabled: config.workingHoursEnabled,
        workingHoursStart: config.workingHoursStart,
        workingHoursEnd: config.workingHoursEnd,
        workingDays: config.workingDays,
        afterHoursMessage: config.afterHoursMessage,
        businessName: config.businessName,
        businessDescription: config.businessDescription,
        consultantBio: config.consultantBio,
        salesScript: config.salesScript,
        vision: config.vision,
        mission: config.mission,
        values: config.values,
        usp: config.usp,
        whoWeHelp: config.whoWeHelp,
        whoWeDontHelp: config.whoWeDontHelp,
        whatWeDo: config.whatWeDo,
        howWeDoIt: config.howWeDoIt,
        softwareCreated: config.softwareCreated,
        booksPublished: config.booksPublished,
        yearsExperience: config.yearsExperience,
        clientsHelped: config.clientsHelped,
        resultsGenerated: config.resultsGenerated,
        caseStudies: config.caseStudies,
        servicesOffered: config.servicesOffered,
        guarantees: config.guarantees,
        aiPersonality: config.aiPersonality,
        whatsappConciseMode: config.whatsappConciseMode,
        defaultObiettivi: config.defaultObiettivi,
        defaultDesideri: config.defaultDesideri,
        defaultUncino: config.defaultUncino,
        defaultIdealState: config.defaultIdealState,
        isDryRun: config.isDryRun,
      };

      return duplicateData;
    },
    onSuccess: (duplicateData) => {
      // Navigate to new agent page with duplicated data (store temporarily in session)
      sessionStorage.setItem('duplicateAgentData', JSON.stringify(duplicateData));
      navigate("/consultant/whatsapp/agent/new");
      toast({
        title: "📋 Agente pronto per la duplicazione",
        description: "Completa le credenziali Twilio e salva per creare la copia.",
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

  const handleAddNew = () => {
    navigate("/consultant/whatsapp/agent/new");
  };

  const handleEdit = (config: WhatsAppConfig) => {
    navigate(`/consultant/whatsapp/agent/${config.id}`);
  };

  const handleDelete = (config: WhatsAppConfig) => {
    setConfigToDelete(config);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (configToDelete?.id) {
      deleteMutation.mutate(configToDelete.id);
    }
  };

  const handleDuplicate = (config: WhatsAppConfig) => {
    duplicateMutation.mutate(config);
  };

  // Load API Keys
  const { data: apiKeysData, isLoading: keysLoading } = useQuery({
    queryKey: ["/api/whatsapp/api-keys"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/api-keys", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to load API keys");
      return response.json();
    },
  });

  const apiKeys = apiKeysData?.keys || [];
  const keysCount = apiKeysData?.count || 0;
  const maxKeys = apiKeysData?.maxKeys || 50;

  // Add API Key mutation
  const addKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const response = await fetch("/api/whatsapp/api-keys", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/api-keys"] });
      setNewApiKey("");
      toast({
        title: "✅ API Key aggiunta",
        description: "La chiave è stata aggiunta con successo.",
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

  // Delete API Key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/whatsapp/api-keys/${keyId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete key");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/api-keys"] });
      toast({
        title: "✅ API Key rimossa",
        description: "La chiave è stata rimossa con successo.",
      });
    },
  });

  // Toggle API Key mutation
  const toggleKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/whatsapp/api-keys/${keyId}/toggle`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to toggle key");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/api-keys"] });
    },
  });

  const handleAddKey = () => {
    if (!newApiKey.trim() || newApiKey.trim().length < 20) {
      toast({
        title: "⚠️ API Key non valida",
        description: "Inserisci una API key Gemini valida (minimo 20 caratteri).",
        variant: "destructive",
      });
      return;
    }
    addKeyMutation.mutate(newApiKey.trim());
  };

  return (
    <WhatsAppLayout 
      title="Configurazione WhatsApp Business"
      description="Gestisci più agenti WhatsApp AI per diversi ruoli e conversazioni"
      actions={
        <Button 
          onClick={handleAddNew}
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Aggiungi Nuovo Agente
        </Button>
      }
    >
      <div className="max-w-7xl mx-auto space-y-8">
        <Tabs defaultValue={initialTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 gap-2">
            <TabsTrigger value="custom" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
              <Bot className="h-4 w-4 mr-2" />
              Agenti Personalizzati
            </TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700">
              <Users className="h-4 w-4 mr-2" />
              Agenti di Sistema
            </TabsTrigger>
          </TabsList>

          <TabsContent value="custom" className="space-y-6">
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <AlertDescription className="text-blue-900 dark:text-blue-200">
                  <strong className="font-semibold">Configurazione Multi-Agente</strong>
                  <p className="mt-1 text-sm">
                    Ogni agente può avere una personalità e configurazione diversa. Ad esempio: "Dot - Receptionist" per accoglienza iniziale, "Spec - Assistant" per supporto clienti esistenti.
                  </p>
                </AlertDescription>
              </div>
            </Alert>

            {isLoading ? (
              <div className="flex justify-center items-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : configs.length === 0 ? (
              <Card className="border-dashed">
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
              <div className={`grid gap-6 ${
                configs.length === 1 
                  ? 'grid-cols-1 max-w-2xl mx-auto' 
                  : configs.length === 2 
                  ? 'grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto' 
                  : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              }`}>
                {configs.map((config: WhatsAppConfig) => (
                  <Card 
                    key={config.id} 
                    className="group relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 border-2 hover:border-green-400/50 dark:hover:border-green-500/50 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50"
                  >
                    {/* Gradient overlay animato */}
                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-emerald-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    {/* Pattern decorativo */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/10 to-transparent rounded-bl-[100px] opacity-50" />
                    
                    <CardHeader className="pb-3 relative z-10">
                      {/* Header compatto - Nome e Icona */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative flex-shrink-0">
                          <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl blur-sm opacity-50 group-hover:opacity-75 transition-opacity" />
                          <div className="relative bg-gradient-to-br from-green-100 to-emerald-50 dark:from-green-900/40 dark:to-emerald-900/40 p-2.5 rounded-xl border border-green-200/50 dark:border-green-700/50">
                            <Bot className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base font-bold truncate bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                            {config.agentName}
                          </CardTitle>
                          {config.businessName && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {config.businessName}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Badges orizzontali */}
                      <div className="flex flex-wrap gap-1.5">
                        <Badge 
                          variant="outline"
                          className={`
                            font-semibold text-xs px-2 py-0.5 border-2
                            ${config.agentType === "proactive_setter"
                              ? "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-300 dark:from-emerald-900/30 dark:to-green-900/30 dark:text-emerald-300 dark:border-emerald-700"
                              : "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-300 dark:from-blue-900/30 dark:to-indigo-900/30 dark:text-blue-300 dark:border-blue-700"
                            }
                          `}
                        >
                          {config.agentType === "proactive_setter" ? "🎯 Setter" : "📞 Receptionist"}
                        </Badge>
                        <Badge 
                          className={`
                            font-semibold text-xs px-2 py-0.5 border-2
                            ${config.autoResponseEnabled
                              ? "bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border-green-300 dark:from-green-900/30 dark:to-emerald-900/30 dark:text-green-300 dark:border-green-700"
                              : "bg-gradient-to-r from-gray-50 to-slate-50 text-gray-600 border-gray-300 dark:from-gray-800 dark:to-slate-800 dark:text-gray-400 dark:border-gray-600"
                            }
                          `}
                        >
                          {config.autoResponseEnabled ? "✅ Attivo" : "⏸️ Pausa"}
                        </Badge>
                        {(config.isDryRun ?? true) && (
                          <Badge 
                            variant="outline"
                            className="bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 border-2 border-orange-300 dark:from-orange-900/30 dark:to-amber-900/30 dark:text-orange-300 dark:border-orange-700 font-semibold text-xs px-2 py-0.5"
                          >
                            🧪 Test
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-3 relative z-10 pt-0">
                      {/* Info box - Grid compatto */}
                      <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900/50 rounded-xl p-3 border border-gray-200/50 dark:border-gray-700/50">
                        <div className="grid gap-2">
                          <div className="flex items-center gap-2 text-sm">
                            <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-lg">
                              <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
                              {config.twilioWhatsappNumber || "N/A"}
                            </span>
                          </div>
                          
                          {config.aiPersonality && (
                            <div className="flex items-center gap-2 text-sm">
                              <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded-lg">
                                <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <span className="capitalize text-xs font-medium text-gray-600 dark:text-gray-400 truncate">
                                {config.aiPersonality.replace(/_/g, " ")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Default Lead Values Section - Collapsable con design premium */}
                      {(config.defaultObiettivi || config.defaultDesideri || config.defaultUncino || config.defaultIdealState) && (
                        <Accordion type="single" collapsible className="border-t border-gray-200/50 dark:border-gray-700/50 pt-3">
                          <AccordionItem value="lead-defaults" className="border-none">
                            <AccordionTrigger className="py-2 hover:no-underline group/trigger">
                              <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
                                <div className="bg-indigo-100 dark:bg-indigo-900/30 p-1.5 rounded-lg group-hover/trigger:bg-indigo-200 dark:group-hover/trigger:bg-indigo-800/40 transition-colors">
                                  <Users className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                                  Valori Lead Proattivi
                                </span>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-2">
                              <div className="grid gap-2 pt-2">
                                {config.defaultObiettivi && (
                                  <div className="group/item bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 p-3 rounded-xl border-2 border-blue-200/50 dark:border-blue-800/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all hover:shadow-md">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <div className="bg-blue-500/10 dark:bg-blue-400/10 p-1 rounded">
                                        <span className="text-xs">🎯</span>
                                      </div>
                                      <span className="font-bold text-xs text-blue-700 dark:text-blue-300">Obiettivi</span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">{config.defaultObiettivi}</p>
                                  </div>
                                )}
                                {config.defaultDesideri && (
                                  <div className="group/item bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 p-3 rounded-xl border-2 border-purple-200/50 dark:border-purple-800/50 hover:border-purple-300 dark:hover:border-purple-700 transition-all hover:shadow-md">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <div className="bg-purple-500/10 dark:bg-purple-400/10 p-1 rounded">
                                        <span className="text-xs">✨</span>
                                      </div>
                                      <span className="font-bold text-xs text-purple-700 dark:text-purple-300">Desideri</span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">{config.defaultDesideri}</p>
                                  </div>
                                )}
                                {config.defaultUncino && (
                                  <div className="group/item bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 p-3 rounded-xl border-2 border-orange-200/50 dark:border-orange-800/50 hover:border-orange-300 dark:hover:border-orange-700 transition-all hover:shadow-md">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <div className="bg-orange-500/10 dark:bg-orange-400/10 p-1 rounded">
                                        <span className="text-xs">🎣</span>
                                      </div>
                                      <span className="font-bold text-xs text-orange-700 dark:text-orange-300">Uncino</span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">{config.defaultUncino}</p>
                                  </div>
                                )}
                                {config.defaultIdealState && (
                                  <div className="group/item bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-3 rounded-xl border-2 border-green-200/50 dark:border-green-800/50 hover:border-green-300 dark:hover:border-green-700 transition-all hover:shadow-md">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <div className="bg-green-500/10 dark:bg-green-400/10 p-1 rounded">
                                        <span className="text-xs">🌟</span>
                                      </div>
                                      <span className="font-bold text-xs text-green-700 dark:text-green-300">Stato Ideale</span>
                                    </div>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">{config.defaultIdealState}</p>
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      )}
                      
                      {/* Action buttons - Layout orizzontale con priorità */}
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(config)}
                          className="col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-200 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all font-bold text-blue-700 dark:text-blue-300"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Modifica Configurazione
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicate(config)}
                          disabled={duplicateMutation.isPending}
                          className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 border-2 border-cyan-200 dark:border-cyan-800 hover:border-cyan-300 dark:hover:border-cyan-700 hover:shadow-md transition-all text-cyan-700 dark:text-cyan-300 disabled:opacity-50"
                          title="Duplica agente (senza credenziali Twilio)"
                        >
                          {duplicateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-1.5" />
                              Duplica
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(config)}
                          className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30 border-2 border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700 hover:shadow-md transition-all text-red-700 dark:text-red-300"
                        >
                          <Trash2 className="h-4 w-4 mr-1.5" />
                          Elimina
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

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
                                      : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs"
                                  }
                                >
                                  {idea.agentType === "proactive_setter" ? "Setter" : "Lead"}
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

            <Card className="border-indigo-100 dark:border-indigo-900/30 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/10 dark:to-purple-950/10">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2.5 rounded-lg">
                    <Sparkles className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Funzionalità Future 🚀</CardTitle>
                    <CardDescription className="mt-1">
                      12 feature modulari da implementare per potenziare i tuoi agenti AI
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800/50">
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-2xl">💳</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base text-gray-900 dark:text-white mb-1">Payment Collection</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Raccolta acconti/pagamenti via Stripe con link automatici</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">E-commerce</Badge>
                          <Badge variant="secondary" className="text-xs">Eventi</Badge>
                          <Badge variant="secondary" className="text-xs">Formazione</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800/50">
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-2xl">📋</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base text-gray-900 dark:text-white mb-1">Quote Generation</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Preventivi automatici con domande guidate e range prezzi</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">Edilizia</Badge>
                          <Badge variant="secondary" className="text-xs">Eventi</Badge>
                          <Badge variant="secondary" className="text-xs">Immobiliare</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800/50">
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-2xl">🚨</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base text-gray-900 dark:text-white mb-1">Emergency Handling</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Gestione urgenze con priorità e escalation immediata</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">Edilizia</Badge>
                          <Badge variant="secondary" className="text-xs">Automotive</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800/50">
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-2xl">🎁</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base text-gray-900 dark:text-white mb-1">Loyalty Program</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Programma fedeltà con punti, reward e gamification</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">Bellezza</Badge>
                          <Badge variant="secondary" className="text-xs">Fitness</Badge>
                          <Badge variant="secondary" className="text-xs">Ristoranti</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800/50">
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-2xl">⭐</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base text-gray-900 dark:text-white mb-1">Review Collection</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Raccolta recensioni post-servizio con incentivi</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">Tutti i settori</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800/50">
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-2xl">🏢</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base text-gray-900 dark:text-white mb-1">Multi-Location</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Gestione multiple sedi con disponibilità differenziate</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">Catene</Badge>
                          <Badge variant="secondary" className="text-xs">Franchise</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800/50">
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-2xl">📅</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base text-gray-900 dark:text-white mb-1">Subscription Management</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Gestione abbonamenti con rinnovi e upgrade/downgrade</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">Fitness</Badge>
                          <Badge variant="secondary" className="text-xs">SaaS</Badge>
                          <Badge variant="secondary" className="text-xs">Formazione</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800/50">
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-2xl">🛒</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base text-gray-900 dark:text-white mb-1">Product Recommendation</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Raccomandazioni personalizzate e comparazione prodotti</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">E-commerce</Badge>
                          <Badge variant="secondary" className="text-xs">Bellezza</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800/50">
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-2xl">⏳</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base text-gray-900 dark:text-white mb-1">Waitlist Management</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Lista d'attesa con notifiche automatiche slot liberi</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">Ristoranti</Badge>
                          <Badge variant="secondary" className="text-xs">Eventi</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800/50">
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-2xl">👥</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base text-gray-900 dark:text-white mb-1">Group Booking</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Prenotazioni di gruppo con pacchetti e sconti multipli</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">Eventi</Badge>
                          <Badge variant="secondary" className="text-xs">Ristoranti</Badge>
                          <Badge variant="secondary" className="text-xs">Turismo</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800/50">
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-2xl">📄</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base text-gray-900 dark:text-white mb-1">Document Collection</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Checklist e raccolta documenti via WhatsApp con tracking</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">Professionisti</Badge>
                          <Badge variant="secondary" className="text-xs">Automotive</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800/50">
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-2xl">🍽️</span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base text-gray-900 dark:text-white mb-1">Menu/Catalog</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Catalogo interattivo con filtri, carrello e personalizzazioni</p>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">Ristoranti</Badge>
                          <Badge variant="secondary" className="text-xs">E-commerce</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Alert className="border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20 dark:border-indigo-800 mt-4">
                  <Lightbulb className="h-4 w-4 text-indigo-600" />
                  <AlertDescription className="text-indigo-900 dark:text-indigo-200">
                    <strong>Roadmap:</strong> Queste funzionalità seguiranno lo stesso pattern modulare dei blocchi esistenti (toggle nel wizard + instruction block + conditional injection). Implementabili una alla volta in base alle esigenze.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
              <Info className="h-5 w-5 text-blue-600" />
              <AlertDescription>
                <strong>Agenti AI di Sistema</strong><br />
                Questi agenti sono preconfigurati e gestiti automaticamente dal sistema. Non possono essere modificati o eliminati.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Card 1 - Millie (AI Email Writer) */}
              <Card className="relative overflow-hidden border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-purple-950/30 dark:via-pink-950/30 dark:to-gray-900 hover:shadow-2xl hover:shadow-purple-200/50 dark:hover:shadow-purple-900/50 hover:-translate-y-2 hover:border-purple-400 dark:hover:border-purple-600 transition-all duration-300 rounded-2xl">
                <CardHeader className="text-center pt-6 pb-3">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                    Millie
                  </CardTitle>
                  <p className="text-base font-bold text-purple-700 dark:text-purple-400 mb-4">
                    AI Email Writer
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center shadow-lg">
                        <Mail className="h-16 w-16 text-purple-600 dark:text-purple-400" />
                      </div>
                      <Badge className="absolute -top-1 -right-1 bg-gray-500 text-white text-xs px-2 py-0.5">
                        Sistema - Non Modificabile
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 px-6">
                  <div className="bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-5 mb-5 border border-purple-100 dark:border-purple-800/30 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-1 w-1 rounded-full bg-purple-500"></div>
                      <p className="text-sm font-bold text-purple-800 dark:text-purple-300 tracking-wide uppercase">
                        Cosa posso fare
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-purple-200/50 dark:border-purple-700/30 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Email Giornaliere AI
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-purple-200/50 dark:border-purple-700/30 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Personalizzate per Cliente
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-purple-200/50 dark:border-purple-700/30 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Journey Automatico
                        </p>
                      </div>
                      <div className="text-xs text-center text-purple-700 dark:text-purple-400 font-medium italic mt-3 pt-3 border-t border-purple-200/50 dark:border-purple-700/30">
                        e centinaia di altre funzioni.
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                    onClick={() => window.location.href = '/consultant/ai-config'}
                  >
                    Gestisci Email Journey
                  </Button>
                  
                  {/* Chi sono section */}
                  <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-800">
                    <p className="text-center text-sm font-medium text-purple-900 dark:text-purple-100">
                      Sono <span className="font-bold">Millie</span>
                    </p>
                    <p className="text-center text-xs text-purple-700 dark:text-purple-300 mt-1">
                      Aiuto <span className="font-semibold">consulenti e coach</span>, a <span className="font-semibold">mantenere relazioni costanti con i clienti</span>, attraverso <span className="font-semibold">email personalizzate giornaliere generate da AI</span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2 - Echo (AI Consultation Summarizer) */}
              <Card className="relative overflow-hidden border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 via-amber-50 to-white dark:from-orange-950/30 dark:via-amber-950/30 dark:to-gray-900 hover:shadow-2xl hover:shadow-orange-200/50 dark:hover:shadow-orange-900/50 hover:-translate-y-2 hover:border-orange-400 dark:hover:border-orange-600 transition-all duration-300 rounded-2xl">
                <CardHeader className="text-center pt-6 pb-3">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-2">
                    Echo
                  </CardTitle>
                  <p className="text-base font-bold text-orange-700 dark:text-orange-400 mb-4">
                    AI Consultation Summarizer
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex items-center justify-center shadow-lg">
                        <ClipboardCheck className="h-16 w-16 text-orange-600 dark:text-orange-400" />
                      </div>
                      <Badge className="absolute -top-1 -right-1 bg-gray-500 text-white text-xs px-2 py-0.5">
                        Sistema - Non Modificabile
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 px-6">
                  <div className="bg-gradient-to-br from-orange-50/80 to-amber-50/80 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-5 mb-5 border border-orange-100 dark:border-orange-800/30 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-1 w-1 rounded-full bg-orange-500"></div>
                      <p className="text-sm font-bold text-orange-800 dark:text-orange-300 tracking-wide uppercase">
                        Cosa posso fare
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-orange-200/50 dark:border-orange-700/30 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Riepiloghi Consulenze AI
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-orange-200/50 dark:border-orange-700/30 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Email Personalizzate
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-orange-200/50 dark:border-orange-700/30 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Da Trascrizioni Fathom
                        </p>
                      </div>
                      <div className="text-xs text-center text-orange-700 dark:text-orange-400 font-medium italic mt-3 pt-3 border-t border-orange-200/50 dark:border-orange-700/30">
                        e centinaia di altre funzioni.
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                    onClick={() => window.location.href = '/consultant/appointments'}
                  >
                    Gestisci Consulenze
                  </Button>
                  
                  {/* Chi sono section */}
                  <div className="mt-4 pt-4 border-t border-orange-200 dark:border-orange-800">
                    <p className="text-center text-sm font-medium text-orange-900 dark:text-orange-100">
                      Sono <span className="font-bold">Echo</span>
                    </p>
                    <p className="text-center text-xs text-orange-700 dark:text-orange-300 mt-1">
                      Aiuto <span className="font-semibold">consulenti</span>, a <span className="font-semibold">documentare e condividere i progressi delle consulenze</span>, attraverso <span className="font-semibold">riepiloghi AI da trascrizioni Fathom inviati via email</span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Card 3 - Spec (AI Researcher) */}
              <Card className="relative overflow-hidden border-2 border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50 via-blue-50 to-white dark:from-cyan-950/30 dark:via-blue-950/30 dark:to-gray-900 hover:shadow-2xl hover:shadow-cyan-200/50 dark:hover:shadow-cyan-900/50 hover:-translate-y-2 hover:border-cyan-400 dark:hover:border-cyan-600 transition-all duration-300 rounded-2xl">
                <CardHeader className="text-center pt-6 pb-3">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent mb-2">
                    Spec
                  </CardTitle>
                  <p className="text-base font-bold text-cyan-700 dark:text-cyan-400 mb-4">
                    AI Researcher
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 flex items-center justify-center shadow-lg">
                        <Bot className="h-16 w-16 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <Badge className="absolute -top-1 -right-1 bg-gray-500 text-white text-xs px-2 py-0.5">
                        Sistema - Non Modificabile
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 px-6">
                  <div className="bg-gradient-to-br from-cyan-50/80 to-blue-50/80 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-xl p-5 mb-5 border border-cyan-100 dark:border-cyan-800/30 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-1 w-1 rounded-full bg-cyan-500"></div>
                      <p className="text-sm font-bold text-cyan-800 dark:text-cyan-300 tracking-wide uppercase">
                        Cosa posso fare
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-cyan-200/50 dark:border-cyan-700/30 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Supporto Clienti 24/7
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-cyan-200/50 dark:border-cyan-700/30 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Risposte su Esercizi
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-cyan-200/50 dark:border-cyan-700/30 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Guida ai Materiali
                        </p>
                      </div>
                      <div className="text-xs text-center text-cyan-700 dark:text-cyan-400 font-medium italic mt-3 pt-3 border-t border-cyan-200/50 dark:border-cyan-700/30">
                        e centinaia di altre funzioni.
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                    onClick={() => window.location.href = '/client/ai-assistant'}
                  >
                    Area Clienti
                  </Button>
                  
                  {/* Chi sono section */}
                  <div className="mt-4 pt-4 border-t border-cyan-200 dark:border-cyan-800">
                    <p className="text-center text-sm font-medium text-cyan-900 dark:text-cyan-100">
                      Sono <span className="font-bold">Spec</span>
                    </p>
                    <p className="text-center text-xs text-cyan-700 dark:text-cyan-300 mt-1">
                      Aiuto <span className="font-semibold">i clienti in percorso</span>, a <span className="font-semibold">trovare risposte immediate su esercizi e materiali</span>, attraverso <span className="font-semibold">chat AI 24/7 con accesso alla biblioteca e università</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
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
