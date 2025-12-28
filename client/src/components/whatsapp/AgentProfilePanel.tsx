import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { 
  Settings, 
  MessageSquare, 
  Trash2, 
  Bot,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Target,
  Zap,
  Brain,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Copy,
  CalendarCheck,
  Link,
  Unlink,
  Loader2,
  RefreshCw,
  Info,
  Mic,
  BookOpen,
  ShieldCheck,
  BadgeDollarSign,
  UserX,
  Sparkles,
  FileText,
  Share2,
  Instagram
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AgentShareManager } from "./agent-share-manager";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Agent {
  id: string;
  name: string;
  agentType: string;
  status: "active" | "paused" | "test";
  performanceScore: number;
  trend: "up" | "down" | "stable";
}

interface FileSearchCategories {
  courses?: boolean;
  lessons?: boolean;
  exercises?: boolean;
  knowledgeBase?: boolean;
  library?: boolean;
  university?: boolean;
}

interface AgentAnalytics {
  agent: {
    id: string;
    name: string;
    type: string;
    businessName?: string;
    businessDescription?: string;
    consultantDisplayName?: string;
    personality?: string;
    isActive?: boolean;
    phone?: string;
    isDryRun?: boolean;
    isProactive?: boolean;
    enableInAIAssistant?: boolean;
    fileSearchCategories?: FileSearchCategories;
    features?: {
      bookingEnabled: boolean;
      objectionHandlingEnabled: boolean;
      disqualificationEnabled: boolean;
      upsellingEnabled: boolean;
      ttsEnabled: boolean;
      hasCalendar: boolean;
      hasKnowledgeBase: boolean;
      hasSalesScript: boolean;
    };
    workingHours?: {
      start: number;
      end: number;
      timezone?: string;
    } | null;
    whoWeHelp?: string;
    whatWeDo?: string;
    createdAt?: string;
  };
  metrics: {
    score: number;
    conversations7d: number;
    conversations30d: number;
    messages7d: number;
    avgResponseTime: number;
  };
  trend: Array<{
    date: string;
    conversations: number;
  }>;
  skills: Array<{
    name: string;
    level: number;
    description?: string;
  }>;
}

interface AgentProfilePanelProps {
  selectedAgent: Agent | null;
  onDeleteAgent?: (agentId: string) => void;
  onDuplicateAgent?: (agentId: string) => void;
}

interface ConsultantClient {
  id: string;
  name: string;
  email?: string;
}

function PerformanceGauge({ score, trend }: { score: number; trend: string }) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-slate-400";
  
  const scoreColor = score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-red-600";
  const strokeColor = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="45"
            stroke="#e2e8f0"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="64"
            cy="64"
            r="45"
            stroke={strokeColor}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-3xl font-bold", scoreColor)}>{score}</span>
          <span className="text-xs text-slate-500">Performance</span>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-2">
        <TrendIcon className={cn("h-4 w-4", trendColor)} />
        <span className={cn("text-sm font-medium", trendColor)}>
          {trend === "up" ? "In crescita" : trend === "down" ? "In calo" : "Stabile"}
        </span>
      </div>
    </div>
  );
}

function SkillBar({ name, level, description }: { name: string; level: number; description: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{name}</span>
        <span className="text-xs text-slate-500">{level}%</span>
      </div>
      <Progress value={level} className="h-2" />
      <p className="text-xs text-slate-400">{description}</p>
    </div>
  );
}

function PlaceholderPanel() {
  return (
    <Card className="bg-white border border-slate-200 h-full flex items-center justify-center">
      <CardContent className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Bot className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-700 mb-2">Seleziona un agente</h3>
        <p className="text-sm text-slate-500 max-w-xs">
          Clicca su un agente nella lista per visualizzare i dettagli e le statistiche
        </p>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <Card className="bg-white border border-slate-200 h-full">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-32 w-32 mx-auto rounded-full" />
        <Skeleton className="h-48 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentProfilePanel({ selectedAgent, onDeleteAgent, onDuplicateAgent }: AgentProfilePanelProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [calendarStatus, setCalendarStatus] = useState<{
    connected: boolean;
    email?: string;
    connectedAt?: string;
  }>({ connected: false });
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const [enableInAIAssistant, setEnableInAIAssistant] = useState(false);
  const [fileSearchCategories, setFileSearchCategories] = useState<FileSearchCategories>({
    courses: false,
    lessons: false,
    exercises: false,
    knowledgeBase: false,
    library: false,
    university: false,
  });
  const [isSavingAISettings, setIsSavingAISettings] = useState(false);

  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [showShareManager, setShowShareManager] = useState(false);
  
  // Instagram integration state
  const [selectedInstagramConfigId, setSelectedInstagramConfigId] = useState<string | null>(null);
  const [isSavingInstagram, setIsSavingInstagram] = useState(false);

  // Fetch Instagram configs
  const { data: instagramConfigs, isLoading: isLoadingInstagramConfigs } = useQuery<{
    configs: Array<{
      id: string;
      instagramPageId: string;
      agentName: string | null;
      isActive: boolean;
      linkedAgent: { agentId: string; agentName: string } | null;
    }>;
  }>({
    queryKey: ["/api/whatsapp/instagram-configs"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/instagram-configs", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch Instagram configs");
      return res.json();
    },
    staleTime: 30000,
  });

  // Load agent's current Instagram config
  const { data: agentDetails } = useQuery<{ config: { instagramConfigId?: string } }>({
    queryKey: ["/api/whatsapp/config", selectedAgent?.id],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/config/${selectedAgent?.id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch agent details");
      return res.json();
    },
    enabled: !!selectedAgent?.id,
  });

  useEffect(() => {
    if (agentDetails?.config?.instagramConfigId) {
      setSelectedInstagramConfigId(agentDetails.config.instagramConfigId);
    } else {
      setSelectedInstagramConfigId(null);
    }
  }, [agentDetails?.config?.instagramConfigId, selectedAgent?.id]);

  const handleLinkInstagram = async (configId: string | null) => {
    if (!selectedAgent?.id) return;
    
    setIsSavingInstagram(true);
    try {
      const response = await fetch(`/api/whatsapp/config/${selectedAgent.id}/instagram`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ instagramConfigId: configId })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Errore durante il collegamento');
      }
      
      setSelectedInstagramConfigId(configId);
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/instagram-configs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config", selectedAgent.id] });
      
      toast({
        title: configId ? "Instagram Collegato" : "Instagram Scollegato",
        description: data.message
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile collegare Instagram"
      });
    } finally {
      setIsSavingInstagram(false);
    }
  };

  const { data: consultantClients } = useQuery<ConsultantClient[]>({
    queryKey: ["/api/ai-assistant/consultant/clients"],
    queryFn: async () => {
      const res = await fetch("/api/ai-assistant/consultant/clients", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: clientAssignments, isLoading: isLoadingAssignments } = useQuery<{ clientIds: string[] }>({
    queryKey: ["/api/ai-assistant/agent", selectedAgent?.id, "client-assignments"],
    queryFn: async () => {
      const res = await fetch(`/api/ai-assistant/agent/${selectedAgent?.id}/client-assignments`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json();
    },
    enabled: !!selectedAgent?.id,
  });

  useEffect(() => {
    if (clientAssignments?.clientIds) {
      setSelectedClientIds(clientAssignments.clientIds);
    } else {
      setSelectedClientIds([]);
    }
  }, [clientAssignments?.clientIds, selectedAgent?.id]);

  const saveClientAssignments = useMutation({
    mutationFn: async (clientIds: string[]) => {
      const res = await fetch(`/api/ai-assistant/agent/${selectedAgent?.id}/client-assignments`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds })
      });
      if (!res.ok) throw new Error("Failed to save assignments");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-assistant/agent", selectedAgent?.id, "client-assignments"] });
      toast({
        title: "Assegnazioni Salvate",
        description: "Le assegnazioni clienti sono state aggiornate"
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Impossibile salvare le assegnazioni"
      });
    }
  });

  const handleClientToggle = (clientId: string, checked: boolean) => {
    const newSelectedIds = checked 
      ? [...selectedClientIds, clientId]
      : selectedClientIds.filter(id => id !== clientId);
    setSelectedClientIds(newSelectedIds);
    saveClientAssignments.mutate(newSelectedIds);
  };

  useEffect(() => {
    if (selectedAgent?.id) {
      fetchCalendarStatus();
    }
  }, [selectedAgent?.id]);

  const fetchCalendarStatus = async () => {
    if (!selectedAgent?.id) return;
    
    setIsLoadingCalendar(true);
    try {
      const response = await fetch(`/api/whatsapp/agents/${selectedAgent.id}/calendar/status`, {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setCalendarStatus(data);
      }
    } catch (error) {
      console.error('Error fetching calendar status:', error);
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const handleConnectCalendar = async () => {
    if (!selectedAgent?.id) return;

    setIsConnecting(true);
    try {
      const response = await fetch(`/api/whatsapp/agents/${selectedAgent.id}/calendar/oauth/start`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Errore durante la connessione');
      }
      
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile avviare la connessione al calendario"
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!selectedAgent?.id) return;

    setIsDisconnecting(true);
    try {
      const response = await fetch(`/api/whatsapp/agents/${selectedAgent.id}/calendar/disconnect`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Errore durante la disconnessione');
      }
      
      setCalendarStatus({ connected: false });
      toast({
        title: "Calendario Scollegato",
        description: "Il calendario Google è stato scollegato da questo agente"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile scollegare il calendario"
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTestCalendar = async () => {
    if (!selectedAgent?.id) return;

    setIsTesting(true);
    try {
      const response = await fetch(`/api/whatsapp/agents/${selectedAgent.id}/calendar/test`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Connessione Verificata",
          description: `Calendario funzionante - ${data.eventsCount} eventi nei prossimi 7 giorni`
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore Test",
        description: error.message || "Impossibile verificare la connessione"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const saveAIAssistantSettings = async (
    enabled: boolean,
    categories: FileSearchCategories
  ) => {
    if (!selectedAgent?.id) return;

    setIsSavingAISettings(true);
    try {
      const response = await fetch(`/api/ai-assistant/agent/${selectedAgent.id}/ai-assistant-settings`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enableInAIAssistant: enabled,
          fileSearchCategories: categories
        })
      });

      if (!response.ok) {
        throw new Error('Errore durante il salvataggio');
      }

      toast({
        title: "Impostazioni Salvate",
        description: "Le impostazioni AI Assistant sono state aggiornate"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile salvare le impostazioni"
      });
    } finally {
      setIsSavingAISettings(false);
    }
  };

  const handleEnableAIAssistantChange = async (checked: boolean) => {
    setEnableInAIAssistant(checked);
    await saveAIAssistantSettings(checked, fileSearchCategories);
  };

  const handleCategoryChange = async (category: keyof FileSearchCategories, checked: boolean) => {
    const newCategories = { ...fileSearchCategories, [category]: checked };
    setFileSearchCategories(newCategories);
    await saveAIAssistantSettings(enableInAIAssistant, newCategories);
  };

  const { data, isLoading, isError } = useQuery<AgentAnalytics>({
    queryKey: ["/api/whatsapp/agents", selectedAgent?.id, "analytics"],
    queryFn: async () => {
      const response = await fetch(`/api/whatsapp/agents/${selectedAgent?.id}/analytics`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch agent analytics");
      }
      return response.json();
    },
    enabled: !!selectedAgent?.id,
    staleTime: 30000,
  });

  useEffect(() => {
    if (data?.agent) {
      setEnableInAIAssistant(data.agent.enableInAIAssistant ?? false);
      setFileSearchCategories({
        courses: data.agent.fileSearchCategories?.courses ?? false,
        lessons: data.agent.fileSearchCategories?.lessons ?? false,
        exercises: data.agent.fileSearchCategories?.exercises ?? false,
        knowledgeBase: data.agent.fileSearchCategories?.knowledgeBase ?? false,
        library: data.agent.fileSearchCategories?.library ?? false,
        university: data.agent.fileSearchCategories?.university ?? false,
      });
    }
  }, [data?.agent]);

  if (!selectedAgent) {
    return <PlaceholderPanel />;
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return (
      <Card className="bg-white border border-slate-200 h-full">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center text-center py-8">
            <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
            <p className="text-sm text-red-600">Errore nel caricamento analytics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const defaultPerformance = {
    score: selectedAgent.performanceScore || 65,
    trend: selectedAgent.trend || "stable",
    conversationsTotal: 0,
    conversationsToday: 0,
    avgResponseTime: "15s",
    successRate: 85,
  };

  const defaultSkills = [
    { name: "Qualificazione Lead", level: 85, description: "Capacita di identificare lead qualificati" },
    { name: "Gestione Obiezioni", level: 72, description: "Risposta efficace alle obiezioni" },
    { name: "Conversione", level: 68, description: "Tasso di conversione in appuntamenti" },
    { name: "Engagement", level: 90, description: "Mantenimento della conversazione" },
  ];

  const rawMetrics = data?.performance || data?.metrics || {};
  const analytics = {
    agent: data?.agent || selectedAgent,
    performance: {
      score: rawMetrics.score || defaultPerformance.score,
      trend: rawMetrics.trend || defaultPerformance.trend,
      conversationsTotal: rawMetrics.conversations7d || rawMetrics.conversationsTotal || defaultPerformance.conversationsTotal,
      conversationsToday: rawMetrics.conversationsToday || defaultPerformance.conversationsToday,
      avgResponseTime: rawMetrics.avgResponseTime ? `${rawMetrics.avgResponseTime}s` : defaultPerformance.avgResponseTime,
      successRate: rawMetrics.successRate || defaultPerformance.successRate,
    },
    trendData: data?.trendData || data?.trend || [],
    skills: data?.skills || defaultSkills,
  };

  const agentTypeLabels: Record<string, string> = {
    reactive_lead: "Lead Reattivo",
    proactive_setter: "Setter Proattivo",
    informative_advisor: "Advisor Informativo",
    customer_success: "Customer Success",
    intake_coordinator: "Coordinatore Intake",
  };

  const agentTypeDescriptions: Record<string, string> = {
    reactive_lead: "Risponde ai messaggi in arrivo, qualifica i lead e li guida verso la prenotazione di una consulenza.",
    proactive_setter: "Contatta proattivamente i potenziali clienti per fissare appuntamenti e gestire le obiezioni.",
    informative_advisor: "Fornisce informazioni dettagliate sui servizi senza spingere alla vendita diretta.",
    customer_success: "Segue i clienti esistenti per garantire la loro soddisfazione e favorire il successo.",
    intake_coordinator: "Raccoglie documenti e informazioni necessarie prima delle consulenze.",
  };

  const personalityLabels: Record<string, string> = {
    amico_fidato: "Amico Fidato",
    coach_motivazionale: "Coach Motivazionale",
    consulente_professionale: "Consulente Professionale",
    mentore_paziente: "Mentore Paziente",
    venditore_energico: "Venditore Energico",
    consigliere_empatico: "Consigliere Empatico",
    stratega_diretto: "Stratega Diretto",
    educatore_socratico: "Educatore Socratico",
    esperto_tecnico: "Esperto Tecnico",
    compagno_entusiasta: "Compagno Entusiasta",
  };

  const agentData = data?.agent;
  const features = agentData?.features;

  const statusConfig = {
    active: { label: "Attivo", color: "bg-green-100 text-green-700" },
    paused: { label: "In Pausa", color: "bg-amber-100 text-amber-700" },
    test: { label: "Test", color: "bg-blue-100 text-blue-700" },
  };

  const status = statusConfig[selectedAgent.status as keyof typeof statusConfig] || statusConfig.active;

  return (
    <Card className="bg-white border border-slate-200 h-full flex flex-col">
      <ScrollArea className="flex-1">
        <CardContent className="p-4 space-y-4">
          {/* Header - Always visible */}
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
              {selectedAgent.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-slate-900 truncate">{selectedAgent.name}</h2>
                <Badge variant="outline" className={cn("text-xs", status.color)}>
                  {status.label}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                {agentTypeLabels[selectedAgent.agentType] || selectedAgent.agentType}
              </p>
              {agentData?.businessName && (
                <p className="text-xs text-slate-400 truncate mt-0.5">{agentData.businessName}</p>
              )}
            </div>
          </div>

          {/* Features badges - compact row */}
          {features && (
            <div className="flex flex-wrap gap-1.5">
              {features.bookingEnabled && (
                <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-xs px-1.5 py-0.5">
                  <CalendarCheck className="h-3 w-3 mr-0.5" />
                  Prenotazioni
                </Badge>
              )}
              {features.objectionHandlingEnabled && (
                <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200 text-xs px-1.5 py-0.5">
                  <ShieldCheck className="h-3 w-3 mr-0.5" />
                  Obiezioni
                </Badge>
              )}
              {features.hasCalendar && (
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-1.5 py-0.5">
                  <Calendar className="h-3 w-3 mr-0.5" />
                  Calendario
                </Badge>
              )}
              {features.ttsEnabled && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-1.5 py-0.5">
                  <Mic className="h-3 w-3 mr-0.5" />
                  Vocali
                </Badge>
              )}
              {agentData?.personality && (
                <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200 text-xs px-1.5 py-0.5">
                  <Sparkles className="h-3 w-3 mr-0.5" />
                  {personalityLabels[agentData.personality]?.split(' ')[0] || agentData.personality}
                </Badge>
              )}
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="performance" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-9">
              <TabsTrigger value="performance" className="text-xs gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Performance</span>
              </TabsTrigger>
              <TabsTrigger value="integrations" className="text-xs gap-1">
                <Link className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Integrazioni</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="text-xs gap-1">
                <Bot className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">AI & Sharing</span>
              </TabsTrigger>
            </TabsList>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-4 mt-4">
              <div className="flex justify-center">
                <PerformanceGauge 
                  score={analytics.performance.score} 
                  trend={analytics.performance.trend}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="text-xs">Conversazioni</span>
                  </div>
                  <p className="text-base font-semibold text-slate-900">
                    {analytics.performance.conversationsTotal}
                  </p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs">Tempo Risposta</span>
                  </div>
                  <p className="text-base font-semibold text-slate-900">
                    {analytics.performance.avgResponseTime}
                  </p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                    <Target className="h-3.5 w-3.5" />
                    <span className="text-xs">Successo</span>
                  </div>
                  <p className="text-base font-semibold text-slate-900">
                    {analytics.performance.successRate}%
                  </p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-xs">Oggi</span>
                  </div>
                  <p className="text-base font-semibold text-slate-900">
                    {analytics.performance.conversationsToday}
                  </p>
                </div>
              </div>

              {analytics.trendData && analytics.trendData.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                    Trend 7 Giorni
                  </h3>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 9 }} stroke="#94a3b8" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            fontSize: "11px",
                          }}
                        />
                        <Line type="monotone" dataKey="conversations" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", strokeWidth: 2 }} name="Conversazioni" />
                        <Line type="monotone" dataKey="successRate" stroke="#22c55e" strokeWidth={2} dot={{ fill: "#22c55e", strokeWidth: 2 }} name="Successo %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-medium text-slate-700 mb-2 flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-purple-500" />
                  Competenze
                </h3>
                <div className="space-y-3">
                  {analytics.skills.map((skill, index) => (
                    <SkillBar key={index} name={skill.name} level={skill.level} description={skill.description} />
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Integrations Tab */}
            <TabsContent value="integrations" className="space-y-4 mt-4">
              {/* Working Hours */}
              {agentData?.workingHours && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="h-4 w-4 text-slate-500" />
                    <span className="text-sm font-medium">Orari di Lavoro</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {String(agentData.workingHours.start).padStart(2, '0')}:00 - {String(agentData.workingHours.end).padStart(2, '0')}:00
                    {agentData.workingHours.timezone && (
                      <span className="text-xs text-slate-400 ml-1">({agentData.workingHours.timezone})</span>
                    )}
                  </p>
                </div>
              )}

              {/* Google Calendar */}
              <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100">
                <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-green-500" />
                  Google Calendar
                </h3>
                {isLoadingCalendar ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  </div>
                ) : calendarStatus.connected ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 rounded bg-green-100/50 border border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-green-700">Collegato</p>
                        <p className="text-xs text-green-600 truncate">{calendarStatus.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleTestCalendar} disabled={isTesting} className="flex-1 h-8 text-xs">
                        {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        Test
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDisconnectCalendar} disabled={isDisconnecting} className="flex-1 h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                        {isDisconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3 mr-1" />}
                        Scollega
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" onClick={handleConnectCalendar} disabled={isConnecting} className="w-full h-8 text-xs bg-green-600 hover:bg-green-700">
                    {isConnecting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Link className="h-3 w-3 mr-1" />}
                    Collega Google Calendar
                  </Button>
                )}
              </div>

              {/* Instagram DM */}
              <div className="p-3 bg-gradient-to-br from-pink-50 to-purple-50 rounded-lg border border-pink-100">
                <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                  <Instagram className="h-4 w-4 text-pink-500" />
                  Instagram DM
                </h3>
                {isLoadingInstagramConfigs ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  </div>
                ) : instagramConfigs?.configs && instagramConfigs.configs.length > 0 ? (
                  <div className="space-y-2">
                    {selectedInstagramConfigId ? (
                      <div className="flex items-center gap-2 p-2 rounded bg-pink-100/50 border border-pink-200">
                        <Instagram className="h-4 w-4 text-pink-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-pink-700">Collegato</p>
                          <p className="text-xs text-pink-600 truncate">
                            {instagramConfigs.configs.find(c => c.id === selectedInstagramConfigId)?.instagramPageId || "Account Instagram"}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleLinkInstagram(null)} disabled={isSavingInstagram} className="h-7 px-2 text-pink-600 hover:text-pink-700 hover:bg-pink-50 border-pink-300">
                          {isSavingInstagram ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-xs text-slate-500">Seleziona un account:</p>
                        {instagramConfigs.configs.map((config) => {
                          const isLinkedToOther = config.linkedAgent && config.linkedAgent.agentId !== selectedAgent?.id;
                          return (
                            <button
                              key={config.id}
                              onClick={() => !isLinkedToOther && handleLinkInstagram(config.id)}
                              disabled={isSavingInstagram || isLinkedToOther}
                              className={cn(
                                "w-full flex items-center gap-2 p-2 rounded border transition-colors text-left",
                                isLinkedToOther ? "bg-slate-50 border-slate-200 cursor-not-allowed opacity-60" : "bg-white border-slate-200 hover:bg-pink-50 hover:border-pink-300"
                              )}
                            >
                              <Instagram className={cn("h-4 w-4", isLinkedToOther ? "text-slate-400" : "text-pink-500")} />
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-xs font-medium truncate", isLinkedToOther ? "text-slate-500" : "text-slate-700")}>{config.instagramPageId}</p>
                                {isLinkedToOther && <p className="text-xs text-slate-400">Collegato a: {config.linkedAgent?.agentName}</p>}
                              </div>
                              {!isLinkedToOther && <Link className="h-3 w-3 text-pink-500" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                    <Instagram className="h-4 w-4 text-slate-400" />
                    <div className="flex-1">
                      <p className="text-xs text-slate-600">Nessun account configurato</p>
                      <p className="text-xs text-slate-400">Configura in API Keys</p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* AI & Sharing Tab */}
            <TabsContent value="ai" className="space-y-4 mt-4">
              {/* AI Assistant Integration - Card style */}
              <div 
                className={cn(
                  "relative overflow-hidden rounded-xl border-2 transition-all duration-300 cursor-pointer",
                  enableInAIAssistant 
                    ? "border-blue-400 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 shadow-md shadow-blue-100" 
                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                )}
                onClick={() => !isSavingAISettings && handleEnableAIAssistantChange(!enableInAIAssistant)}
              >
                {enableInAIAssistant && (
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-400/20 to-transparent rounded-bl-full" />
                )}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                      enableInAIAssistant ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-500"
                    )}>
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-800">AI Assistant</h3>
                        <Switch
                          id="ai-assistant-toggle"
                          checked={enableInAIAssistant}
                          onCheckedChange={handleEnableAIAssistantChange}
                          disabled={isSavingAISettings}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {enableInAIAssistant 
                          ? "L'agente è disponibile nella chat AI" 
                          : "Abilita per usare nella chat AI"}
                      </p>
                      {enableInAIAssistant && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-xs font-medium text-green-600">Attivo</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {isSavingAISettings && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  </div>
                )}
              </div>

              {/* Share with Clients - Improved */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center">
                        <Share2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">Condividi</h3>
                        <p className="text-xs text-slate-500">Accesso clienti</p>
                      </div>
                    </div>
                    {selectedClientIds.length > 0 && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500 text-white">
                        <Users className="h-3 w-3" />
                        <span className="text-xs font-semibold">{selectedClientIds.length}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-3 bg-white">
                  {isLoadingAssignments ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : consultantClients && consultantClients.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {consultantClients.map((client) => {
                        const isSelected = selectedClientIds.includes(client.id);
                        return (
                          <label
                            key={client.id}
                            className={cn(
                              "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all duration-200",
                              isSelected 
                                ? "bg-emerald-50 border border-emerald-200" 
                                : "bg-slate-50 border border-transparent hover:bg-slate-100"
                            )}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 transition-colors",
                              isSelected 
                                ? "bg-emerald-500 text-white" 
                                : "bg-slate-200 text-slate-600"
                            )}>
                              {(client.name || client.email || "?").charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm font-medium truncate transition-colors",
                                isSelected ? "text-emerald-700" : "text-slate-700"
                              )}>
                                {client.name || client.email || "Cliente"}
                              </p>
                            </div>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleClientToggle(client.id, checked as boolean)}
                              disabled={saveClientAssignments.isPending}
                              className={cn(
                                "transition-colors",
                                isSelected && "border-emerald-500 data-[state=checked]:bg-emerald-500"
                              )}
                            />
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                        <Users className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500">Nessun cliente</p>
                      <p className="text-xs text-slate-400">Aggiungi clienti per condividere</p>
                    </div>
                  )}
                </div>
                
                {saveClientAssignments.isPending && (
                  <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-100 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                    <span className="text-xs font-medium text-emerald-600">Salvataggio modifiche...</span>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Quick Actions - Always visible */}
          <div className="pt-3 border-t border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Azioni Rapide
            </h3>
            <div className="grid grid-cols-5 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-col h-auto py-3 gap-1"
                onClick={() => navigate(`/consultant/whatsapp/agent/${selectedAgent.id}`)}
              >
                <Settings className="h-4 w-4" />
                <span className="text-xs">Configura</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-col h-auto py-3 gap-1"
                onClick={() => navigate(`/consultant/whatsapp-agents-chat?agentId=${selectedAgent.id}`)}
              >
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs">Chat</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-col h-auto py-3 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={() => setShowShareManager(true)}
              >
                <Share2 className="h-4 w-4" />
                <span className="text-xs">Condividi</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-col h-auto py-3 gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => onDuplicateAgent?.(selectedAgent.id)}
              >
                <Copy className="h-4 w-4" />
                <span className="text-xs">Duplica</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-col h-auto py-3 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => onDeleteAgent?.(selectedAgent.id)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="text-xs">Elimina</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </ScrollArea>

      <Dialog open={showShareManager} onOpenChange={setShowShareManager}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Condividi Agente</DialogTitle>
          </DialogHeader>
          <AgentShareManager 
            agentId={selectedAgent.id} 
            agentName={selectedAgent.name} 
            onClose={() => setShowShareManager(false)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
