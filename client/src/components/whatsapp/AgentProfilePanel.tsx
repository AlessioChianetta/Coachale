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
  Share2
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";

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
        <CardContent className="p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                {selectedAgent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{selectedAgent.name}</h2>
                <p className="text-sm text-slate-500">
                  {agentTypeLabels[selectedAgent.agentType] || selectedAgent.agentType}
                </p>
                <Badge variant="outline" className={cn("mt-1", status.color)}>
                  {status.label}
                </Badge>
              </div>
            </div>
          </div>

          {/* Summary Section - Cosa fa questo agente */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-500" />
              Cosa fa questo agente
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {agentTypeDescriptions[selectedAgent.agentType] || "Gestisce le conversazioni WhatsApp in modo intelligente."}
            </p>
            
            {/* Business Info */}
            {(agentData?.businessName || agentData?.businessDescription) && (
              <div className="mt-3 pt-3 border-t border-blue-100">
                {agentData.businessName && (
                  <p className="text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Business:</span> {agentData.businessName}
                  </p>
                )}
                {agentData.businessDescription && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {agentData.businessDescription}
                  </p>
                )}
              </div>
            )}

            {/* Personality */}
            {agentData?.personality && (
              <div className="mt-3 flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-purple-500" />
                <span className="text-xs text-purple-600 font-medium">
                  {personalityLabels[agentData.personality] || agentData.personality}
                </span>
              </div>
            )}
          </div>

          {/* Features enabled badges */}
          {features && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Funzionalità Attive
              </h3>
              <div className="flex flex-wrap gap-2">
                {features.bookingEnabled && (
                  <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                    <CalendarCheck className="h-3 w-3 mr-1" />
                    Prenotazioni
                  </Badge>
                )}
                {features.objectionHandlingEnabled && (
                  <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200">
                    <ShieldCheck className="h-3 w-3 mr-1" />
                    Obiezioni
                  </Badge>
                )}
                {features.upsellingEnabled && (
                  <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">
                    <BadgeDollarSign className="h-3 w-3 mr-1" />
                    Upselling
                  </Badge>
                )}
                {features.disqualificationEnabled && (
                  <Badge variant="secondary" className="bg-red-50 text-red-700 border-red-200">
                    <UserX className="h-3 w-3 mr-1" />
                    Disqualifica
                  </Badge>
                )}
                {features.ttsEnabled && (
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                    <Mic className="h-3 w-3 mr-1" />
                    Vocali
                  </Badge>
                )}
                {features.hasCalendar && (
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    <Calendar className="h-3 w-3 mr-1" />
                    Calendario
                  </Badge>
                )}
                {features.hasKnowledgeBase && (
                  <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                    <BookOpen className="h-3 w-3 mr-1" />
                    Knowledge Base
                  </Badge>
                )}
                {features.hasSalesScript && (
                  <Badge variant="secondary" className="bg-pink-50 text-pink-700 border-pink-200">
                    <FileText className="h-3 w-3 mr-1" />
                    Script Vendita
                  </Badge>
                )}
              </div>
            </div>
          )}

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

          <div className="flex justify-center py-4">
            <PerformanceGauge 
              score={analytics.performance.score} 
              trend={analytics.performance.trend}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs">Conversazioni</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {analytics.performance.conversationsTotal}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Tempo Risposta</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {analytics.performance.avgResponseTime}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Target className="h-4 w-4" />
                <span className="text-xs">Successo</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {analytics.performance.successRate}%
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">Oggi</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {analytics.performance.conversationsToday}
              </p>
            </div>
          </div>

          {analytics.trendData && analytics.trendData.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Trend Ultimi 7 Giorni
              </h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }} 
                      stroke="#94a3b8"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }} 
                      stroke="#94a3b8"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="conversations"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6", strokeWidth: 2 }}
                      name="Conversazioni"
                    />
                    <Line
                      type="monotone"
                      dataKey="successRate"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ fill: "#22c55e", strokeWidth: 2 }}
                      name="Successo %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              Competenze
            </h3>
            <div className="space-y-4">
              {analytics.skills.map((skill, index) => (
                <SkillBar
                  key={index}
                  name={skill.name}
                  level={skill.level}
                  description={skill.description}
                />
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-green-500" />
              Google Calendar
            </h3>
            {isLoadingCalendar ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : calendarStatus.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-700">Collegato</p>
                    <p className="text-xs text-green-600 truncate">{calendarStatus.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestCalendar}
                    disabled={isTesting}
                    className="flex-1"
                  >
                    {isTesting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    Test
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectCalendar}
                    disabled={isDisconnecting}
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {isDisconnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="h-4 w-4 mr-1" />
                    )}
                    Scollega
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <Calendar className="h-5 w-5 text-slate-400" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-600">Nessun calendario collegato</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleConnectCalendar}
                  disabled={isConnecting}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Link className="h-4 w-4 mr-2" />
                  )}
                  Collega Google Calendar
                </Button>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-500" />
                AI Assistant Integration
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Quando abilitato, questo agente può essere utilizzato come contesto nella chat AI Assistant, 
                permettendo all'assistente di accedere alle informazioni e conversazioni dell'agente.
              </p>
              
              <div className="flex items-center justify-between mb-4">
                <label htmlFor="ai-assistant-toggle" className="text-sm font-medium text-slate-700">
                  Abilita in AI Assistant
                </label>
                <Switch
                  id="ai-assistant-toggle"
                  checked={enableInAIAssistant}
                  onCheckedChange={handleEnableAIAssistantChange}
                  disabled={isSavingAISettings}
                />
              </div>

              {enableInAIAssistant && (
                <div className="space-y-3 pt-3 border-t border-blue-100">
                  <p className="text-sm font-medium text-slate-700">Categorie File Search</p>
                  <p className="text-xs text-slate-500 mb-2">
                    Seleziona quali categorie di documenti l'AI Assistant può cercare per questo agente.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <Checkbox
                        checked={fileSearchCategories.courses}
                        onCheckedChange={(checked) => handleCategoryChange('courses', checked as boolean)}
                        disabled={isSavingAISettings}
                      />
                      <span className="text-sm text-slate-600">Corsi</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <Checkbox
                        checked={fileSearchCategories.lessons}
                        onCheckedChange={(checked) => handleCategoryChange('lessons', checked as boolean)}
                        disabled={isSavingAISettings}
                      />
                      <span className="text-sm text-slate-600">Lezioni</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <Checkbox
                        checked={fileSearchCategories.exercises}
                        onCheckedChange={(checked) => handleCategoryChange('exercises', checked as boolean)}
                        disabled={isSavingAISettings}
                      />
                      <span className="text-sm text-slate-600">Esercizi</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <Checkbox
                        checked={fileSearchCategories.knowledgeBase}
                        onCheckedChange={(checked) => handleCategoryChange('knowledgeBase', checked as boolean)}
                        disabled={isSavingAISettings}
                      />
                      <span className="text-sm text-slate-600">Knowledge Base</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <Checkbox
                        checked={fileSearchCategories.library}
                        onCheckedChange={(checked) => handleCategoryChange('library', checked as boolean)}
                        disabled={isSavingAISettings}
                      />
                      <span className="text-sm text-slate-600">Libreria</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <Checkbox
                        checked={fileSearchCategories.university}
                        onCheckedChange={(checked) => handleCategoryChange('university', checked as boolean)}
                        disabled={isSavingAISettings}
                      />
                      <span className="text-sm text-slate-600">Università</span>
                    </label>
                  </div>
                  {isSavingAISettings && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 mt-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Salvataggio in corso...
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-emerald-500" />
                  Condividi con Clienti
                </h3>
                {selectedClientIds.length > 0 && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    {selectedClientIds.length} {selectedClientIds.length === 1 ? 'cliente' : 'clienti'}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Seleziona quali clienti potranno vedere e utilizzare questo agente nel loro AI Assistant.
              </p>
              
              {isLoadingAssignments ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : consultantClients && consultantClients.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {consultantClients.map((client) => (
                    <label
                      key={client.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedClientIds.includes(client.id)}
                        onCheckedChange={(checked) => handleClientToggle(client.id, checked as boolean)}
                        disabled={saveClientAssignments.isPending}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{client.name}</p>
                        {client.email && (
                          <p className="text-xs text-slate-400 truncate">{client.email}</p>
                        )}
                      </div>
                      {selectedClientIds.includes(client.id) && (
                        <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      )}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-slate-200">
                  <Users className="h-5 w-5 text-slate-400" />
                  <p className="text-sm text-slate-500">Nessun cliente disponibile</p>
                </div>
              )}
              
              {saveClientAssignments.isPending && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 mt-3">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Salvataggio in corso...
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Azioni Rapide
            </h3>
            <div className="grid grid-cols-4 gap-2">
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
    </Card>
  );
}
