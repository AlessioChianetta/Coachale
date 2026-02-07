import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Settings, Activity, Bell, BellOff, Phone, Mail, MessageSquare,
  Clock, Calendar, Shield, Zap, Brain, CheckCircle, AlertCircle,
  XCircle, Info, Loader2, RefreshCw, Eye, ChevronLeft, ChevronRight,
  Save, BarChart3, ListTodo, Target, TrendingUp, Hash, Minus,
  Sparkles, User, Lightbulb,
  ArrowRight, Play, Cog, Timer, ChevronDown, ChevronUp
} from "lucide-react";
import { motion } from "framer-motion";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { AllessiaSidePanel } from "@/components/alessia/FloatingEmployeeChat";

interface AutonomySettings {
  is_active: boolean;
  autonomy_level: number;
  default_mode: string;
  working_hours_start: string;
  working_hours_end: string;
  working_days: number[];
  max_daily_calls: number;
  max_daily_emails: number;
  max_daily_whatsapp: number;
  max_daily_analyses: number;
  channels_enabled: {
    voice: boolean;
    email: boolean;
    whatsapp: boolean;
  };
  allowed_task_categories: string[];
  custom_instructions: string;
}

interface ActivityItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  severity: "info" | "success" | "warning" | "error";
  created_at: string;
  contact_name?: string;
  is_read: boolean;
}

interface ActivityResponse {
  activities: ActivityItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface TaskStepPlan {
  step: number;
  action: string;
  description: string;
  status: string;
}

interface AITask {
  id: string;
  ai_instruction: string;
  status: string;
  task_category: string;
  origin_type: string;
  priority: number;
  contact_name?: string;
  ai_reasoning?: string;
  ai_confidence?: number;
  execution_plan?: TaskStepPlan[];
  result_summary?: string;
  result_data?: any;
  scheduled_at?: string;
  completed_at?: string;
  created_at: string;
}

interface TasksResponse {
  tasks: AITask[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface TasksStats {
  total: number;
  active: number;
  completed: number;
  failed: number;
  pending: number;
}

interface TaskDetailResponse {
  task: AITask;
  activity: ActivityItem[];
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Gio" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sab" },
  { value: 7, label: "Dom" },
];

const TASK_CATEGORIES = [
  { value: "outreach", label: "Contatto", description: "Contattare nuovi o esistenti clienti" },
  { value: "reminder", label: "Promemoria", description: "Ricordare scadenze, appuntamenti, pagamenti" },
  { value: "followup", label: "Follow-up", description: "Ricontattare dopo consulenze o eventi" },
  { value: "analysis", label: "Analisi", description: "Analizzare dati finanziari e pattern del cliente" },
  { value: "report", label: "Report", description: "Generare report e documenti di analisi" },
  { value: "research", label: "Ricerca", description: "Ricercare informazioni di mercato e normative" },
  { value: "preparation", label: "Preparazione", description: "Preparare materiale per consulenze e incontri" },
  { value: "monitoring", label: "Monitoraggio", description: "Monitorare proattivamente situazioni e scadenze clienti" },
];

const DEFAULT_SETTINGS: AutonomySettings = {
  is_active: false,
  autonomy_level: 1,
  default_mode: "manual",
  working_hours_start: "08:00",
  working_hours_end: "20:00",
  working_days: [1, 2, 3, 4, 5],
  max_daily_calls: 10,
  max_daily_emails: 20,
  max_daily_whatsapp: 30,
  max_daily_analyses: 50,
  channels_enabled: { voice: true, email: false, whatsapp: false },
  allowed_task_categories: ["outreach", "reminder", "followup"],
  custom_instructions: "",
};

function getAutonomyLabel(level: number): { label: string; color: string; description: string } {
  if (level === 0) return { label: "Disattivato", color: "text-muted-foreground", description: "Il dipendente AI è completamente disattivato. Non eseguirà alcuna azione." };
  if (level === 1) return { label: "Solo manuale", color: "text-green-500", description: "Modalità manuale: puoi creare task per l'AI, che li eseguirà solo quando programmati. Nessuna azione autonoma." };
  if (level <= 3) return { label: "Proposte", color: "text-green-500", description: "L'AI può eseguire task programmati autonomamente durante l'orario di lavoro, ma solo nelle categorie abilitate. Ti notifica ogni azione." };
  if (level <= 6) return { label: "Semi-autonomo", color: "text-yellow-500", description: "L'AI esegue task di routine autonomamente e può proporre nuove azioni. Chiede approvazione per decisioni importanti come chiamate e email." };
  if (level <= 9) return { label: "Quasi autonomo", color: "text-orange-500", description: "L'AI opera in modo indipendente: analizza, decide e agisce. Ti notifica solo per situazioni critiche o fuori dalla norma." };
  return { label: "Autonomia completa", color: "text-red-500", description: "L'AI gestisce tutto autonomamente entro i limiti configurati. Agisce senza approvazione su tutte le categorie e canali abilitati." };
}

function getAutonomyBadgeColor(level: number): string {
  if (level === 0) return "bg-muted text-muted-foreground";
  if (level <= 3) return "bg-green-500/20 text-green-500 border-green-500/30";
  if (level <= 6) return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
  if (level <= 9) return "bg-orange-500/20 text-orange-500 border-orange-500/30";
  return "bg-red-500/20 text-red-500 border-red-500/30";
}

function getActivityIcon(icon: string) {
  switch (icon) {
    case "brain": return <Brain className="h-5 w-5" />;
    case "check": return <CheckCircle className="h-5 w-5" />;
    case "alert": return <AlertCircle className="h-5 w-5" />;
    case "phone": return <Phone className="h-5 w-5" />;
    case "mail": return <Mail className="h-5 w-5" />;
    case "chart": return <BarChart3 className="h-5 w-5" />;
    default: return <Activity className="h-5 w-5" />;
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "info": return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Info</Badge>;
    case "success": return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Successo</Badge>;
    case "warning": return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Avviso</Badge>;
    case "error": return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Errore</Badge>;
    default: return <Badge variant="secondary">{severity}</Badge>;
  }
}

function getTaskStatusBadge(status: string) {
  switch (status) {
    case "scheduled":
    case "in_progress":
    case "approved":
      return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Attivo</Badge>;
    case "completed":
      return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Completato</Badge>;
    case "failed":
      return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Fallito</Badge>;
    case "paused":
    case "draft":
    case "waiting_approval":
      return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">In pausa</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    outreach: "Contatto",
    analysis: "Analisi",
    report: "Report",
    followup: "Follow-up",
    research: "Ricerca",
    preparation: "Preparazione",
    monitoring: "Monitoraggio",
    reminder: "Promemoria",
  };
  return map[category] || category;
}

function getCategoryBadge(category: string) {
  return <Badge variant="outline" className="text-xs">{getCategoryLabel(category)}</Badge>;
}

function getPriorityIndicator(priority: number) {
  if (priority === 1) return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 text-xs">Alta</Badge>;
  if (priority === 2) return <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30 text-xs">Media-Alta</Badge>;
  if (priority === 3) return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-xs">Media</Badge>;
  return <Badge className="bg-muted text-muted-foreground text-xs">Bassa</Badge>;
}

function getStepStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "in_progress":
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "skipped":
      return <Minus className="h-5 w-5 text-muted-foreground" />;
    default:
      return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/40" />;
  }
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Adesso";
  if (diffMin < 60) return `${diffMin} min fa`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "ora" : "ore"} fa`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "giorno" : "giorni"} fa`;
  return date.toLocaleDateString("it-IT");
}

export default function ConsultantAIAutonomyPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("settings");
  const [settings, setSettings] = useState<AutonomySettings>(DEFAULT_SETTINGS);
  const [activityPage, setActivityPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [dashboardPage, setDashboardPage] = useState(1);
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<string>("all");
  const [dashboardCategoryFilter, setDashboardCategoryFilter] = useState<string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showArchDetails, setShowArchDetails] = useState(true);
  const [showMobileChat, setShowMobileChat] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ["/api/ai-autonomy/settings"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/settings", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  useEffect(() => {
    if (settingsData) {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...settingsData,
        custom_instructions: settingsData.custom_instructions || "",
        channels_enabled: {
          ...DEFAULT_SETTINGS.channels_enabled,
          ...(settingsData.channels_enabled || {}),
        },
      });
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: async (data: AutonomySettings) => {
      const res = await fetch("/api/ai-autonomy/settings", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Salvato", description: "Impostazioni di autonomia aggiornate con successo" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/settings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const activityUrl = `/api/ai-autonomy/activity?page=${activityPage}&limit=20${severityFilter !== "all" ? `&severity=${severityFilter}` : ""}`;
  const { data: activityData, isLoading: loadingActivity } = useQuery<ActivityResponse>({
    queryKey: [activityUrl],
    queryFn: async () => {
      const res = await fetch(activityUrl, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: activeTab === "activity",
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/ai-autonomy/activity/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/activity/unread-count", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai-autonomy/activity/${id}/read`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activityUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/activity/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai-autonomy/activity/read-all", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Fatto", description: "Tutte le attività segnate come lette" });
      queryClient.invalidateQueries({ queryKey: [activityUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/activity/unread-count"] });
    },
  });

  const { data: tasksStats, isLoading: loadingStats } = useQuery<TasksStats>({
    queryKey: ["/api/ai-autonomy/tasks-stats"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/tasks-stats", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: activeTab === "dashboard",
  });

  const tasksUrl = `/api/ai-autonomy/tasks?page=${dashboardPage}&limit=10${dashboardStatusFilter !== "all" ? `&status=${dashboardStatusFilter}` : ""}${dashboardCategoryFilter !== "all" ? `&category=${dashboardCategoryFilter}` : ""}`;
  const { data: tasksData, isLoading: loadingTasks } = useQuery<TasksResponse>({
    queryKey: [tasksUrl],
    queryFn: async () => {
      const res = await fetch(tasksUrl, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: activeTab === "dashboard",
  });

  const { data: taskDetailData, isLoading: loadingTaskDetail } = useQuery<TaskDetailResponse>({
    queryKey: [`/api/ai-autonomy/tasks/${selectedTaskId}`],
    queryFn: async () => {
      const res = await fetch(`/api/ai-autonomy/tasks/${selectedTaskId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedTaskId,
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const toggleWorkingDay = (day: number) => {
    setSettings(prev => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter(d => d !== day)
        : [...prev.working_days, day].sort(),
    }));
  };

  const toggleCategory = (cat: string) => {
    setSettings(prev => ({
      ...prev,
      allowed_task_categories: prev.allowed_task_categories.includes(cat)
        ? prev.allowed_task_categories.filter(c => c !== cat)
        : [...prev.allowed_task_categories, cat],
    }));
  };

  const unreadCount = unreadData?.count || 0;
  const autonomyInfo = getAutonomyLabel(settings.autonomy_level);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={`flex-1 flex flex-col ${isMobile ? "w-full" : "ml-0"}`}>
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 p-6 lg:px-8 overflow-auto">
            <div className="max-w-5xl space-y-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Bot className="h-8 w-8" />
                Dipendente AI - Autonomia
              </h1>
              <p className="text-muted-foreground mt-1">
                Configura il livello di autonomia e monitora le attività del tuo dipendente AI
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 max-w-2xl">
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Impostazioni Autonomia
                </TabsTrigger>
                <TabsTrigger value="activity" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Feed Attività
                  {unreadCount > 0 && (
                    <Badge className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] h-5">
                      {unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
              </TabsList>

              <TabsContent value="settings" className="space-y-6 mt-6">
                {loadingSettings ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
                      <CardHeader className="cursor-pointer" onClick={() => setShowArchDetails(!showArchDetails)}>
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600">
                              <Bot className="h-5 w-5 text-white" />
                            </div>
                            Cosa può fare il tuo Dipendente AI
                          </div>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            {showArchDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CardTitle>
                        <CardDescription>
                          Architettura, modalità operative e guardrail di sicurezza
                        </CardDescription>
                      </CardHeader>

                      {showArchDetails && (
                        <CardContent>
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6"
                          >
                            <div className="rounded-xl border-l-4 border-purple-500 bg-gradient-to-r from-purple-500/10 to-transparent p-4">
                              <div className="flex items-start gap-3">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shrink-0">
                                  <Brain className="h-5 w-5 text-white" />
                                </div>
                                <div className="space-y-2 flex-1">
                                  <h4 className="font-semibold text-sm flex items-center gap-2">
                                    Come funziona
                                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">Il Cervello</Badge>
                                  </h4>
                                  <p className="text-sm text-muted-foreground leading-relaxed">
                                    Un <span className="font-medium text-foreground">motore decisionale</span> basato su Gemini analizza il contesto di ogni cliente
                                    (storico, dati, scadenze) e crea <span className="font-medium text-foreground">piani di esecuzione multi-step</span>.
                                    Ragiona come un consulente esperto per decidere cosa fare, quando e come.
                                  </p>
                                  <div className="flex flex-wrap gap-2 pt-1">
                                    <Badge variant="outline" className="text-xs gap-1"><Eye className="h-3 w-3" /> Analisi contesto</Badge>
                                    <Badge variant="outline" className="text-xs gap-1"><ListTodo className="h-3 w-3" /> Piani multi-step</Badge>
                                    <Badge variant="outline" className="text-xs gap-1"><Sparkles className="h-3 w-3" /> Reasoning AI</Badge>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <Separator />

                            <div className="rounded-xl border-l-4 border-blue-500 bg-gradient-to-r from-blue-500/10 to-transparent p-4">
                              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                <Cog className="h-4 w-4 text-blue-500" />
                                Le 3 Modalità
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="rounded-lg border bg-card p-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-green-500/15">
                                      <User className="h-4 w-4 text-green-500" />
                                    </div>
                                    <span className="font-medium text-sm">Manuale</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    Tu crei i task, l'AI li esegue quando programmati. Controllo totale su ogni azione.
                                  </p>
                                </div>
                                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 space-y-2 relative">
                                  <Badge className="absolute -top-2 right-2 bg-blue-500 text-white text-[10px] px-1.5 py-0">Consigliata</Badge>
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-blue-500/15">
                                      <Lightbulb className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <span className="font-medium text-sm">Ibrida</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    L'AI propone nuove azioni ma chiede approvazione per quelle importanti.
                                  </p>
                                </div>
                                <div className="rounded-lg border bg-card p-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-orange-500/15">
                                      <Zap className="h-4 w-4 text-orange-500" />
                                    </div>
                                    <span className="font-medium text-sm">Automatica</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    L'AI opera in piena autonomia entro i limiti configurati.
                                  </p>
                                </div>
                              </div>
                            </div>

                            <Separator />

                            <div className="rounded-xl border-l-4 border-emerald-500 bg-gradient-to-r from-emerald-500/10 to-transparent p-4">
                              <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                                <RefreshCw className="h-4 w-4 text-emerald-500" />
                                Il Ciclo di Lavoro
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {[
                                  { step: 1, icon: Timer, title: "CRON Scheduler", desc: "Controlla ogni minuto se ci sono task da eseguire", color: "text-cyan-500", bg: "bg-cyan-500/15" },
                                  { step: 2, icon: Brain, title: "Decision Engine", desc: "Analizza contesto cliente, storico e priorità", color: "text-purple-500", bg: "bg-purple-500/15" },
                                  { step: 3, icon: ListTodo, title: "Piano Esecuzione", desc: "Crea un piano multi-step con azioni ordinate", color: "text-blue-500", bg: "bg-blue-500/15" },
                                  { step: 4, icon: Play, title: "Task Executor", desc: "Esegue: chiamate, email, WhatsApp, analisi, report", color: "text-emerald-500", bg: "bg-emerald-500/15" },
                                ].map((item, idx) => (
                                  <div key={item.step} className="flex items-start gap-2">
                                    <div className="flex flex-col items-center gap-1 shrink-0">
                                      <div className={cn("flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold text-white", 
                                        item.step === 1 ? "bg-cyan-500" : item.step === 2 ? "bg-purple-500" : item.step === 3 ? "bg-blue-500" : "bg-emerald-500"
                                      )}>
                                        {item.step}
                                      </div>
                                      {idx < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground hidden lg:block rotate-0 lg:rotate-0" />}
                                    </div>
                                    <div className="space-y-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <item.icon className={cn("h-3.5 w-3.5", item.color)} />
                                        <span className="text-xs font-medium truncate">{item.title}</span>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {[
                                  { icon: Phone, label: "Chiamate", color: "text-green-500" },
                                  { icon: Mail, label: "Email", color: "text-blue-500" },
                                  { icon: MessageSquare, label: "WhatsApp", color: "text-emerald-500" },
                                  { icon: BarChart3, label: "Analisi", color: "text-purple-500" },
                                  { icon: Target, label: "Ricerca", color: "text-cyan-500" },
                                ].map((ch) => (
                                  <Badge key={ch.label} variant="outline" className="text-[10px] gap-1 py-0.5">
                                    <ch.icon className={cn("h-3 w-3", ch.color)} />
                                    {ch.label}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <Separator />

                            <div className="rounded-xl border-l-4 border-amber-500 bg-gradient-to-r from-amber-500/10 to-transparent p-4">
                              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                <Shield className="h-4 w-4 text-amber-500" />
                                Guardrail di Sicurezza
                              </h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                                {[
                                  { icon: Clock, text: "Opera solo nell'orario di lavoro configurato" },
                                  { icon: Shield, text: "Limiti giornalieri per ogni canale" },
                                  { icon: Zap, text: "Solo canali e categorie abilitate" },
                                  { icon: AlertCircle, text: "Livello autonomia richiesto per ogni azione" },
                                  { icon: Activity, text: "Ogni azione registrata nel feed attività" },
                                  { icon: CheckCircle, text: "Nessuna azione duplicata o ridondante" },
                                ].map((rule, i) => (
                                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                                    <rule.icon className="h-4 w-4 text-amber-500 shrink-0" />
                                    <span>{rule.text}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        </CardContent>
                      )}
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="h-5 w-5" />
                          Stato e Livello di Autonomia
                        </CardTitle>
                        <CardDescription>
                          Definisci quanto il tuo dipendente AI può operare in modo indipendente
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-base font-medium">Abilita Dipendente AI</Label>
                            <p className="text-sm text-muted-foreground">
                              Attiva o disattiva il dipendente AI
                            </p>
                          </div>
                          <Switch
                            checked={settings.is_active}
                            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_active: checked }))}
                          />
                        </div>

                        <Separator />

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-base font-medium">Livello di Autonomia</Label>
                            <Badge className={getAutonomyBadgeColor(settings.autonomy_level)}>
                              {settings.autonomy_level}/10 — {autonomyInfo.label}
                            </Badge>
                          </div>

                          <Slider
                            value={[settings.autonomy_level]}
                            onValueChange={(val) => setSettings(prev => ({ ...prev, autonomy_level: val[0] }))}
                            max={10}
                            min={0}
                            step={1}
                            className="w-full"
                          />

                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>0 - Disattivato</span>
                            <span className="text-green-500">1-3 Proposte</span>
                            <span className="text-yellow-500">4-6 Semi-auto</span>
                            <span className="text-orange-500">7-9 Quasi-auto</span>
                            <span className="text-red-500">10 Completa</span>
                          </div>

                          <div className={`p-3 rounded-lg border ${autonomyInfo.color === "text-muted-foreground" ? "bg-muted/50" : "bg-muted/30"}`}>
                            <p className={`text-sm ${autonomyInfo.color}`}>
                              <Info className="h-4 w-4 inline mr-1" />
                              {autonomyInfo.description}
                            </p>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <Label className="text-base font-medium">Modalità Predefinita</Label>
                          <Select
                            value={settings.default_mode}
                            onValueChange={(val) => setSettings(prev => ({ ...prev, default_mode: val }))}
                          >
                            <SelectTrigger className="w-full max-w-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">Manuale</SelectItem>
                              <SelectItem value="hybrid">Ibrido</SelectItem>
                              <SelectItem value="automatic">Automatico</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="h-5 w-5" />
                          Orari di Lavoro
                        </CardTitle>
                        <CardDescription>
                          Imposta quando il dipendente AI può operare
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Ora Inizio</Label>
                            <Input
                              type="time"
                              value={settings.working_hours_start}
                              onChange={(e) => setSettings(prev => ({ ...prev, working_hours_start: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Ora Fine</Label>
                            <Input
                              type="time"
                              value={settings.working_hours_end}
                              onChange={(e) => setSettings(prev => ({ ...prev, working_hours_end: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-base font-medium">Giorni Lavorativi</Label>
                          <div className="flex flex-wrap gap-3">
                            {DAYS_OF_WEEK.map((day) => (
                              <div key={day.value} className="flex items-center gap-2">
                                <Checkbox
                                  id={`day-${day.value}`}
                                  checked={settings.working_days.includes(day.value)}
                                  onCheckedChange={() => toggleWorkingDay(day.value)}
                                />
                                <Label htmlFor={`day-${day.value}`} className="text-sm cursor-pointer">
                                  {day.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Shield className="h-5 w-5" />
                          Limiti Giornalieri
                        </CardTitle>
                        <CardDescription>
                          Imposta i limiti massimi di azioni giornaliere
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Phone className="h-4 w-4" /> Chiamate
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              value={settings.max_daily_calls}
                              onChange={(e) => setSettings(prev => ({ ...prev, max_daily_calls: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Mail className="h-4 w-4" /> Email
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              value={settings.max_daily_emails}
                              onChange={(e) => setSettings(prev => ({ ...prev, max_daily_emails: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <MessageSquare className="h-4 w-4" /> WhatsApp
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              value={settings.max_daily_whatsapp}
                              onChange={(e) => setSettings(prev => ({ ...prev, max_daily_whatsapp: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <BarChart3 className="h-4 w-4" /> Analisi
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              value={settings.max_daily_analyses}
                              onChange={(e) => setSettings(prev => ({ ...prev, max_daily_analyses: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="h-5 w-5" />
                          Canali Abilitati
                        </CardTitle>
                        <CardDescription>
                          Scegli su quali canali il dipendente AI può operare
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-green-500" />
                            <Label>Voice (Chiamate)</Label>
                          </div>
                          <Switch
                            checked={settings.channels_enabled.voice}
                            onCheckedChange={(checked) => setSettings(prev => ({
                              ...prev,
                              channels_enabled: { ...prev.channels_enabled, voice: checked },
                            }))}
                          />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-blue-500" />
                            <Label>Email</Label>
                          </div>
                          <Switch
                            checked={settings.channels_enabled.email}
                            onCheckedChange={(checked) => setSettings(prev => ({
                              ...prev,
                              channels_enabled: { ...prev.channels_enabled, email: checked },
                            }))}
                          />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-emerald-500" />
                            <Label>WhatsApp</Label>
                          </div>
                          <Switch
                            checked={settings.channels_enabled.whatsapp}
                            onCheckedChange={(checked) => setSettings(prev => ({
                              ...prev,
                              channels_enabled: { ...prev.channels_enabled, whatsapp: checked },
                            }))}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ListTodo className="h-5 w-5" />
                          Categorie Task Abilitate
                        </CardTitle>
                        <CardDescription>
                          Scegli quali categorie di task il dipendente AI può gestire
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {TASK_CATEGORIES.map((cat) => (
                            <div key={cat.value} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                              <Checkbox
                                id={`cat-${cat.value}`}
                                checked={settings.allowed_task_categories.includes(cat.value)}
                                onCheckedChange={() => toggleCategory(cat.value)}
                              />
                              <div className="space-y-0.5">
                                <Label htmlFor={`cat-${cat.value}`} className="text-sm font-medium cursor-pointer">
                                  {cat.label}
                                </Label>
                                <p className="text-xs text-muted-foreground">{cat.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="h-5 w-5" />
                          Istruzioni Personalizzate
                        </CardTitle>
                        <CardDescription>
                          Fornisci istruzioni specifiche per guidare il comportamento dell'AI
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={settings.custom_instructions}
                          onChange={(e) => setSettings(prev => ({ ...prev, custom_instructions: e.target.value }))}
                          placeholder="Es: Non chiamare mai i clienti prima delle 10. Prioritizza i lead caldi."
                          rows={4}
                        />
                      </CardContent>
                    </Card>

                    <div className="flex justify-end">
                      <Button onClick={handleSave} disabled={saveMutation.isPending} size="lg">
                        {saveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Salva Impostazioni
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="activity" className="space-y-4 mt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Select value={severityFilter} onValueChange={(val) => { setSeverityFilter(val); setActivityPage(1); }}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Filtra per tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="success">Successo</SelectItem>
                        <SelectItem value="warning">Avviso</SelectItem>
                        <SelectItem value="error">Errore</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending || unreadCount === 0}
                  >
                    {markAllReadMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Segna tutto come letto
                  </Button>
                </div>

                {loadingActivity ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !activityData?.activities?.length ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nessuna attività trovata</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {activityData.activities.map((item) => (
                      <Card key={item.id} className={`transition-colors ${!item.is_read ? "border-primary/30 bg-primary/5" : ""}`}>
                        <CardContent className="py-4 px-5">
                          <div className="flex items-start gap-4">
                            <div className={`mt-0.5 p-2 rounded-full ${
                              item.severity === "error" ? "bg-red-500/10 text-red-500" :
                              item.severity === "warning" ? "bg-yellow-500/10 text-yellow-500" :
                              item.severity === "success" ? "bg-green-500/10 text-green-500" :
                              "bg-blue-500/10 text-blue-500"
                            }`}>
                              {getActivityIcon(item.icon)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">{item.title}</span>
                                {getSeverityBadge(item.severity)}
                                {!item.is_read && (
                                  <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                                    Nuovo
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {getRelativeTime(item.created_at)}
                                </span>
                                {item.contact_name && (
                                  <span className="flex items-center gap-1">
                                    <Bot className="h-3 w-3" />
                                    {item.contact_name}
                                  </span>
                                )}
                              </div>
                            </div>

                            {!item.is_read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0"
                                onClick={() => markReadMutation.mutate(item.id)}
                                disabled={markReadMutation.isPending}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {activityData && activityData.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                      disabled={activityPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Precedente
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Pagina {activityData.page} di {activityData.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActivityPage(p => Math.min(activityData.totalPages, p + 1))}
                      disabled={activityPage >= activityData.totalPages}
                    >
                      Successiva
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="dashboard" className="space-y-6 mt-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-500/10">
                          <ListTodo className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{loadingStats ? "—" : tasksStats?.total ?? 0}</p>
                          <p className="text-xs text-muted-foreground">Totali</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-blue-500/10">
                          <TrendingUp className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{loadingStats ? "—" : tasksStats?.active ?? 0}</p>
                          <p className="text-xs text-muted-foreground">Attivi</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-green-500/10">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{loadingStats ? "—" : tasksStats?.completed ?? 0}</p>
                          <p className="text-xs text-muted-foreground">Completati</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-red-500/10">
                          <XCircle className="h-5 w-5 text-red-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{loadingStats ? "—" : tasksStats?.failed ?? 0}</p>
                          <p className="text-xs text-muted-foreground">Falliti</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <Select value={dashboardStatusFilter} onValueChange={(val) => { setDashboardStatusFilter(val); setDashboardPage(1); }}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Stato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      <SelectItem value="active">Attivi</SelectItem>
                      <SelectItem value="completed">Completati</SelectItem>
                      <SelectItem value="failed">Falliti</SelectItem>
                      <SelectItem value="paused">In pausa</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dashboardCategoryFilter} onValueChange={(val) => { setDashboardCategoryFilter(val); setDashboardPage(1); }}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      <SelectItem value="outreach">Contatto</SelectItem>
                      <SelectItem value="reminder">Promemoria</SelectItem>
                      <SelectItem value="followup">Follow-up</SelectItem>
                      <SelectItem value="analysis">Analisi</SelectItem>
                      <SelectItem value="report">Report</SelectItem>
                      <SelectItem value="research">Ricerca</SelectItem>
                      <SelectItem value="preparation">Preparazione</SelectItem>
                      <SelectItem value="monitoring">Monitoraggio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {loadingTasks ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !tasksData?.tasks?.length ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nessun task trovato</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {tasksData.tasks.map((task) => (
                      <Card
                        key={task.id}
                        className="cursor-pointer hover:border-primary/40 transition-colors"
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <CardContent className="py-4 px-5">
                          <div className="flex items-start gap-4">
                            <div className="mt-0.5 p-2 rounded-full bg-primary/10">
                              <Target className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold truncate max-w-[400px]">
                                  {task.ai_instruction.length > 80
                                    ? task.ai_instruction.substring(0, 80) + "…"
                                    : task.ai_instruction}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {getTaskStatusBadge(task.status)}
                                {getCategoryBadge(task.task_category)}
                                {getPriorityIndicator(task.priority)}
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {getRelativeTime(task.created_at)}
                                </span>
                                {task.contact_name && (
                                  <span className="flex items-center gap-1">
                                    <Bot className="h-3 w-3" />
                                    {task.contact_name}
                                  </span>
                                )}
                                {task.completed_at && (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Completato: {new Date(task.completed_at).toLocaleString("it-IT")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {tasksData && tasksData.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDashboardPage(p => Math.max(1, p - 1))}
                      disabled={dashboardPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Precedente
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Pagina {tasksData.page} di {tasksData.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDashboardPage(p => Math.min(tasksData.totalPages, p + 1))}
                      disabled={dashboardPage >= tasksData.totalPages}
                    >
                      Successiva
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}

                <Dialog open={!!selectedTaskId} onOpenChange={(open) => { if (!open) setSelectedTaskId(null); }}>
                  <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    {loadingTaskDetail ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : taskDetailData?.task ? (
                      <>
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-lg">
                            <Target className="h-5 w-5" />
                            Dettaglio Task
                          </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-6 mt-2">
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Istruzione</p>
                              <p className="mt-1">{taskDetailData.task.ai_instruction}</p>
                            </div>
                            {taskDetailData.task.ai_reasoning && (
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Ragionamento AI</p>
                                <p className="mt-1 text-sm">{taskDetailData.task.ai_reasoning}</p>
                              </div>
                            )}
                            <div className="flex items-center gap-4 flex-wrap">
                              {getTaskStatusBadge(taskDetailData.task.status)}
                              {getCategoryBadge(taskDetailData.task.task_category)}
                              {getPriorityIndicator(taskDetailData.task.priority)}
                              {taskDetailData.task.ai_confidence != null && (
                                <Badge variant="outline" className="text-xs">
                                  <Hash className="h-3 w-3 mr-1" />
                                  Confidenza: {Math.round(taskDetailData.task.ai_confidence * 100)}%
                                </Badge>
                              )}
                            </div>
                            {taskDetailData.task.contact_name && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Bot className="h-4 w-4" />
                                <span>{taskDetailData.task.contact_name}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span>Creato: {new Date(taskDetailData.task.created_at).toLocaleString("it-IT")}</span>
                              {taskDetailData.task.scheduled_at && (
                                <span>Schedulato: {new Date(taskDetailData.task.scheduled_at).toLocaleString("it-IT")}</span>
                              )}
                              {taskDetailData.task.completed_at && (
                                <span>Completato: {new Date(taskDetailData.task.completed_at).toLocaleString("it-IT")}</span>
                              )}
                            </div>
                          </div>

                          {taskDetailData.task.execution_plan && taskDetailData.task.execution_plan.length > 0 && (
                            <>
                              <Separator />
                              <div>
                                <p className="text-sm font-medium mb-3">Piano di Esecuzione</p>
                                <div className="space-y-0">
                                  {taskDetailData.task.execution_plan.map((step, idx) => (
                                    <div key={step.step} className="flex gap-3">
                                      <div className="flex flex-col items-center">
                                        {getStepStatusIcon(step.status)}
                                        {idx < taskDetailData.task.execution_plan!.length - 1 && (
                                          <div className="w-0.5 flex-1 bg-border my-1 min-h-[24px]" />
                                        )}
                                      </div>
                                      <div className="pb-4">
                                        <p className="text-sm font-medium">{step.description}</p>
                                        <p className="text-xs text-muted-foreground">{step.action}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}

                          {taskDetailData.task.result_summary && (
                            <>
                              <Separator />
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Risultato</p>
                                <p className="mt-1 text-sm">{taskDetailData.task.result_summary}</p>
                              </div>
                            </>
                          )}

                          {taskDetailData.task.result_data && (
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Dati risultato</p>
                              <pre className="text-xs overflow-auto max-h-40">
                                {JSON.stringify(taskDetailData.task.result_data, null, 2)}
                              </pre>
                            </div>
                          )}

                          {taskDetailData.activity && taskDetailData.activity.length > 0 && (
                            <>
                              <Separator />
                              <div>
                                <p className="text-sm font-medium mb-3">Timeline Attività</p>
                                <div className="space-y-3">
                                  {taskDetailData.activity.map((act) => (
                                    <div key={act.id} className="flex items-start gap-3">
                                      <div className={`mt-0.5 p-1.5 rounded-full ${
                                        act.severity === "error" ? "bg-red-500/10 text-red-500" :
                                        act.severity === "warning" ? "bg-yellow-500/10 text-yellow-500" :
                                        act.severity === "success" ? "bg-green-500/10 text-green-500" :
                                        "bg-blue-500/10 text-blue-500"
                                      }`}>
                                        {getActivityIcon(act.icon)}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{act.title}</p>
                                        <p className="text-xs text-muted-foreground">{act.description}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {getRelativeTime(act.created_at)}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="py-8 text-center text-muted-foreground">
                        Task non trovato
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </TabsContent>

            </Tabs>
          </div>
        </main>
        <div className="w-[380px] border-l border-border shrink-0 hidden lg:flex flex-col">
          <AllessiaSidePanel />
        </div>
        </div>

        {isMobile && (
          <>
            <Button
              onClick={() => setShowMobileChat(!showMobileChat)}
              size="lg"
              className={cn(
                "fixed bottom-6 right-6 z-50 h-12 px-4 rounded-xl shadow-2xl transition-all duration-300 flex items-center gap-2 lg:hidden",
                "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
              )}
            >
              <Bot className="h-5 w-5 text-white" />
              <span className="text-white font-medium">Alessia</span>
            </Button>
            {showMobileChat && (
              <div className="fixed inset-0 z-50 lg:hidden flex flex-col bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="font-semibold text-sm">Alessia</span>
                  <Button variant="ghost" size="sm" onClick={() => setShowMobileChat(false)}>Chiudi</Button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <AllessiaSidePanel />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
