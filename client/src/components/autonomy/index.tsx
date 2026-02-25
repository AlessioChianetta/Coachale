import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Bot, Activity, ListTodo, Database, X, Cpu, Zap, MessageSquare, Phone, Mail } from "lucide-react";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { AllessiaSidePanel } from "@/components/alessia/FloatingEmployeeChat";
import AgentChat from "./AgentChat";
import { AI_ROLE_PROFILES } from "./constants";

import type {
  AutonomySettings, ActivityResponse, AITask, TasksResponse,
  TasksStats, TaskDetailResponse, SystemStatus, AutonomousLogsResponse, NewTaskData,
  PersonalizzaConfig, KbDocument,
} from "./types";
import { DEFAULT_SETTINGS, EMPTY_NEW_TASK } from "./constants";

import SettingsTab from "./SettingsTab";
import ActivityTab from "./ActivityTab";
import DashboardTab from "./DashboardTab";
import DataCatalogTab from "./DataCatalogTab";

export default function ConsultantAIAutonomyPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("panoramica");
  const isSettingsTab = ["panoramica", "autonomia", "orari", "canali", "dipendenti"].includes(activeTab);
  const [settings, setSettings] = useState<AutonomySettings>(DEFAULT_SETTINGS);
  const [chatOpenRoleId, setChatOpenRoleId] = useState<string | null>(null);
  const [chatInitialMessage, setChatInitialMessage] = useState<string | undefined>(undefined);

  const [activityPage, setActivityPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [activitySubTab, setActivitySubTab] = useState<"all" | "reasoning" | "simulation">("all");
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [reasoningPage, setReasoningPage] = useState(1);
  const [reasoningRole, setReasoningRole] = useState<string>("all");
  const [reasoningModeFilter, setReasoningModeFilter] = useState<string>("all");

  const [dashboardPage, setDashboardPage] = useState(1);
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<string>("all");
  const [dashboardCategoryFilter, setDashboardCategoryFilter] = useState<string>("all");
  const [dashboardOriginFilter, setDashboardOriginFilter] = useState<string>("all");
  const [dashboardRoleFilter, setDashboardRoleFilter] = useState<string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showLibrary, setShowLibrary] = useState(true);
  const [newTask, setNewTask] = useState<NewTaskData>(EMPTY_NEW_TASK);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);
  const [clientSearchFilter, setClientSearchFilter] = useState("");

  const [personalizzaConfig, setPersonalizzaConfig] = useState<PersonalizzaConfig>({
    custom_name: "",
    detailed_instructions: "",
    preferred_channels: ["voice", "email", "whatsapp"],
    task_categories: ["outreach", "reminder", "followup", "analysis"],
    client_segments: "all",
    analysis_frequency: "every_cycle",
    tone_of_voice: "professionale",
    max_tasks_per_run: 3,
    priority_rules: "",
  });
  const [personalizzaLoading, setPersonalizzaLoading] = useState(false);
  const [personalizzaSaving, setPersonalizzaSaving] = useState(false);

  const [kbDocuments, setKbDocuments] = useState<KbDocument[]>([]);

  const [showAlessiaChat, setShowAlessiaChat] = useState(false);
  const [showArchDetails, setShowArchDetails] = useState(true);

  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{ success: boolean; tasks_generated: number; error?: string } | null>(null);
  const [togglingRole, setTogglingRole] = useState<string | null>(null);

  const [autonomousLogsPage, setAutonomousLogsPage] = useState(1);
  const [autonomousLogTypeFilter, setAutonomousLogTypeFilter] = useState("all");
  const [autonomousLogSeverityFilter, setAutonomousLogSeverityFilter] = useState("all");
  const [autonomousLogRoleFilter, setAutonomousLogRoleFilter] = useState("all");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ["/api/ai-autonomy/settings"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/settings", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: allClients } = useQuery<Array<{ id: string; firstName: string; lastName: string; email: string; phoneNumber?: string; isActive: boolean }>>({
    queryKey: ["/api/clients-for-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/clients", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch clients");
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
        role_frequencies: settingsData.role_frequencies || {},
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

  const reasoningLogsUrl = `/api/ai-autonomy/reasoning-logs?page=${reasoningPage}&limit=20${reasoningRole !== "all" ? `&role=${reasoningRole}` : ""}${reasoningModeFilter !== "all" ? `&mode=${reasoningModeFilter}` : ""}`;
  const { data: reasoningLogsData, isLoading: loadingReasoningLogs } = useQuery<any>({
    queryKey: [reasoningLogsUrl],
    queryFn: async () => {
      const res = await fetch(reasoningLogsUrl, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch reasoning logs");
      return res.json();
    },
    enabled: activitySubTab === "reasoning",
  });

  const { data: reasoningData, isLoading: loadingReasoning } = useQuery<ActivityResponse>({
    queryKey: ["ai-reasoning-activity", reasoningPage, reasoningRole],
    queryFn: async () => {
      const params = new URLSearchParams({
        event_type: 'autonomous_analysis',
        page: String(reasoningPage),
        limit: '100',
      });
      if (reasoningRole !== 'all') params.set('ai_role', reasoningRole);
      const res = await fetch(`/api/ai-autonomy/activity?${params.toString()}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch reasoning data");
      return res.json();
    },
    enabled: activitySubTab === "reasoning",
  });

  const { data: reasoningStatsData } = useQuery<any>({
    queryKey: ["/api/ai-autonomy/reasoning-stats"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/reasoning-stats", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch reasoning stats");
      return res.json();
    },
    enabled: activitySubTab === "reasoning",
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

  const clearOldFeedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai-autonomy/activity/clear-old", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Feed pulito", description: `${data.deleted} attività vecchie rimosse` });
      queryClient.invalidateQueries({ queryKey: [activityUrl] });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.includes('/api/ai-autonomy/activity');
      }});
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile pulire il feed", variant: "destructive" });
    },
  });

  const tasksUrl = `/api/ai-autonomy/tasks?page=1&limit=500${dashboardStatusFilter !== "all" ? `&status=${dashboardStatusFilter}` : ""}${dashboardCategoryFilter !== "all" ? `&category=${dashboardCategoryFilter}` : ""}${dashboardOriginFilter !== "all" ? `&origin=${dashboardOriginFilter}` : ""}${dashboardRoleFilter !== "all" ? `&ai_role=${dashboardRoleFilter}` : ""}`;

  const createTaskMutation = useMutation({
    mutationFn: async (data: NewTaskData) => {
      const res = await fetch("/api/ai-autonomy/tasks", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nella creazione");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Task creato", description: "Il task è stato programmato per l'esecuzione" });
      setShowCreateTask(false);
      setNewTask(EMPTY_NEW_TASK);
      setAiSuggested(false);
      setClientSearchFilter("");
      queryClient.invalidateQueries({ queryKey: [tasksUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/tasks-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/active-tasks"] });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const analyzeWithAI = async () => {
    if (!newTask.ai_instruction.trim()) return;
    setAiAnalyzing(true);
    try {
      const res = await fetch("/api/ai-autonomy/tasks/analyze", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ai_instruction: newTask.ai_instruction }),
      });
      if (!res.ok) throw new Error("Analisi fallita");
      const data = await res.json();
      if (data.success && data.suggestions) {
        const s = data.suggestions;
        setNewTask(prev => ({
          ...prev,
          task_category: s.task_category || prev.task_category,
          priority: s.priority || prev.priority,
          client_id: s.client_id || prev.client_id,
          contact_name: s.client_name || s.contact_name || prev.contact_name,
          contact_phone: s.contact_phone || prev.contact_phone,
          preferred_channel: s.preferred_channel && s.preferred_channel !== "none" ? s.preferred_channel : prev.preferred_channel,
          tone: s.tone || prev.tone,
          urgency: s.urgency || prev.urgency,
          objective: s.objective || prev.objective,
          voice_template_suggestion: s.voice_template_suggestion || prev.voice_template_suggestion,
          language: s.language || prev.language,
          additional_context: s.additional_context || prev.additional_context,
          scheduled_datetime: s.scheduled_datetime || prev.scheduled_datetime,
        }));
        setAiSuggested(true);
        toast({ title: "Analisi completata", description: s.reasoning || "Campi compilati dall'AI" });
      }
    } catch (err: any) {
      toast({ title: "Errore analisi", description: err.message, variant: "destructive" });
    } finally {
      setAiAnalyzing(false);
    }
  };

  const { data: systemStatus } = useQuery<SystemStatus>({
    queryKey: ["/api/ai-autonomy/system-status"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/system-status", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isSettingsTab,
    refetchInterval: 30000,
  });

  const fetchPersonalizzaConfig = async () => {
    try {
      setPersonalizzaLoading(true);
      const res = await fetch("/api/ai-autonomy/personalizza-config", {
        headers: { ...getAuthHeaders() },
      });
      if (res.ok) {
        const data = await res.json();
        setPersonalizzaConfig(data);
      }
    } catch (err) {
      console.error("Error fetching personalizza config:", err);
    } finally {
      setPersonalizzaLoading(false);
    }
  };

  const fetchKbDocuments = async () => {
    try {
      const res = await fetch("/api/ai-autonomy/kb-documents-list", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      setKbDocuments(data.documents || []);
    } catch (err) {
      console.error("Error fetching KB documents:", err);
    }
  };

  useEffect(() => {
    fetchPersonalizzaConfig();
    fetchKbDocuments();
  }, []);

  const savePersonalizzaConfig = async () => {
    try {
      setPersonalizzaSaving(true);
      const res = await fetch("/api/ai-autonomy/personalizza-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(personalizzaConfig),
      });
      if (!res.ok) throw new Error("Errore nel salvataggio");
      toast({ title: "Salvato", description: "Configurazione Personalizza aggiornata" });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setPersonalizzaSaving(false);
    }
  };

  const handleTriggerAnalysis = async () => {
    setIsTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch("/api/ai-autonomy/trigger-analysis", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setTriggerResult({ success: false, tasks_generated: 0, error: data.error || "Errore sconosciuto" });
        toast({ title: "Errore", description: data.error || "Impossibile avviare l'analisi", variant: "destructive" });
        return;
      }
      setTriggerResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/system-status"] });
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith?.("/api/ai-autonomy/autonomous-logs") || query.queryKey[0] === "/api/ai-autonomy/autonomous-logs" });
      toast({
        title: data.success ? "Analisi completata" : "Analisi fallita",
        description: data.success
          ? `${data.tasks_generated} task generati dall'analisi.`
          : data.error || "Errore durante l'analisi",
        variant: data.success ? "default" : "destructive",
      });
    } catch {
      toast({ title: "Errore", description: "Impossibile avviare l'analisi", variant: "destructive" });
    } finally {
      setIsTriggering(false);
    }
  };

  const handleToggleRole = async (roleId: string, enabled: boolean) => {
    setTogglingRole(roleId);
    try {
      const res = await fetch("/api/ai-autonomy/roles/toggle", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ roleId, enabled }),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/system-status"] });
      toast({ title: enabled ? "Ruolo attivato" : "Ruolo disattivato", description: `${roleId} è ora ${enabled ? "attivo" : "in pausa"}.` });
    } catch {
      toast({ title: "Errore", description: "Impossibile aggiornare il ruolo", variant: "destructive" });
    } finally {
      setTogglingRole(null);
    }
  };

  const { data: autonomousLogs } = useQuery<AutonomousLogsResponse>({
    queryKey: ["/api/ai-autonomy/autonomous-logs", autonomousLogsPage, autonomousLogTypeFilter, autonomousLogSeverityFilter, autonomousLogRoleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(autonomousLogsPage), limit: "10" });
      if (autonomousLogTypeFilter !== "all") params.set("event_type", autonomousLogTypeFilter);
      if (autonomousLogSeverityFilter !== "all") params.set("severity", autonomousLogSeverityFilter);
      if (autonomousLogRoleFilter !== "all") params.set("ai_role", autonomousLogRoleFilter);
      const res = await fetch(`/api/ai-autonomy/autonomous-logs?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isSettingsTab,
  });

  const { data: pendingApprovalTasks } = useQuery<AITask[]>({
    queryKey: ["/api/ai-autonomy/pending-approval-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/tasks?status=active&origin=autonomous&limit=20", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      return (data.tasks || []).filter((t: any) => t.status === 'scheduled');
    },
    enabled: activeTab === "dashboard",
    refetchInterval: 10000,
  });

  const { data: activeTasks } = useQuery<AITask[]>({
    queryKey: ["/api/ai-autonomy/active-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/tasks?status=active&limit=5", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      return data.tasks || [];
    },
    enabled: activeTab === "dashboard",
    refetchInterval: 5000,
  });

  const { data: tasksStats, isLoading: loadingStats } = useQuery<TasksStats>({
    queryKey: ["/api/ai-autonomy/tasks-stats"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/tasks-stats", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: activeTab === "dashboard",
    refetchInterval: 15000,
  });

  const { data: tasksData, isLoading: loadingTasks } = useQuery<TasksResponse>({
    queryKey: [tasksUrl],
    queryFn: async () => {
      const res = await fetch(tasksUrl, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: activeTab === "dashboard",
    refetchInterval: (query) => {
      const data = query.state.data as TasksResponse | undefined;
      const hasInProgress = data?.tasks?.some(t => t.status === 'in_progress' || t.status === 'waiting_input');
      return hasInProgress ? 3000 : 20000;
    },
  });

  const { data: taskDetailData, isLoading: loadingTaskDetail } = useQuery<TaskDetailResponse>({
    queryKey: [`/api/ai-autonomy/tasks/${selectedTaskId}`],
    queryFn: async () => {
      const res = await fetch(`/api/ai-autonomy/tasks/${selectedTaskId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedTaskId,
    refetchInterval: (query) => {
      const data = query.state.data as TaskDetailResponse | undefined;
      const st = data?.task?.status;
      return (st === 'in_progress' || st === 'waiting_input') ? 2000 : false;
    },
  });

  const executeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/ai-autonomy/tasks/${taskId}/execute`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to execute");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Esecuzione avviata", description: "Alessia sta lavorando sul task..." });
      queryClient.invalidateQueries({ queryKey: [`/api/ai-autonomy/tasks/${selectedTaskId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/tasks-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/active-tasks"] });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile avviare l'esecuzione", variant: "destructive" });
    },
  });

  const unreadCount = unreadData?.count || 0;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={`flex-1 flex flex-col min-h-0 ${isMobile ? "w-full" : "ml-0"}`}>
        <div className="flex-1 flex min-h-0">
          <main className={cn("flex-1 p-6 lg:px-8 overflow-auto transition-all duration-300", chatOpenRoleId ? "mr-0" : "")}>
            <div className={cn("mx-auto space-y-8 transition-all duration-300", chatOpenRoleId ? "max-w-[52rem]" : "max-w-[104rem]")}>
              <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 lg:p-8 shadow-sm">
                <div className="space-y-5">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
                        <Bot className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Dipendente AI</h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                          Configura, monitora e controlla il tuo team autonomo
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full border",
                        systemStatus?.is_active
                          ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                          : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                      )}>
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          systemStatus?.is_active ? "bg-green-500 animate-pulse" : "bg-red-500"
                        )} />
                        <span className={cn(
                          "text-xs font-medium",
                          systemStatus?.is_active ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                        )}>
                          {systemStatus?.is_active ? "Sistema attivo" : "Sistema spento"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                        <Zap className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                          Livello {settings.autonomy_level || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
                      settings.channels_enabled?.voice
                        ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                        : "bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700 opacity-50"
                    )}>
                      <Phone className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      <span className="text-xs font-medium text-green-700 dark:text-green-300">Voice</span>
                    </div>
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
                      settings.channels_enabled?.email
                        ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
                        : "bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700 opacity-50"
                    )}>
                      <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Email</span>
                    </div>
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg border",
                      settings.channels_enabled?.whatsapp
                        ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"
                        : "bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700 opacity-50"
                    )}>
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">WhatsApp</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-50 border border-violet-200 dark:bg-violet-900/20 dark:border-violet-800">
                      <Cpu className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                      <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                        {systemStatus?.roles?.filter((r: any) => r.enabled).length || 0} dipendenti
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <SettingsTab
                settings={settings}
                setSettings={setSettings}
                systemStatus={systemStatus}
                loadingSettings={loadingSettings}
                onSave={() => saveMutation.mutate(settings)}
                isSaving={saveMutation.isPending}
                expandedRole={expandedRole}
                setExpandedRole={setExpandedRole}
                togglingRole={togglingRole}
                onToggleRole={handleToggleRole}
                isTriggering={isTriggering}
                triggerResult={triggerResult}
                onTriggerAnalysis={handleTriggerAnalysis}
                autonomousLogs={autonomousLogs}
                autonomousLogsPage={autonomousLogsPage}
                setAutonomousLogsPage={setAutonomousLogsPage}
                autonomousLogTypeFilter={autonomousLogTypeFilter}
                setAutonomousLogTypeFilter={setAutonomousLogTypeFilter}
                autonomousLogSeverityFilter={autonomousLogSeverityFilter}
                setAutonomousLogSeverityFilter={setAutonomousLogSeverityFilter}
                autonomousLogRoleFilter={autonomousLogRoleFilter}
                setAutonomousLogRoleFilter={setAutonomousLogRoleFilter}
                personalizzaConfig={personalizzaConfig}
                setPersonalizzaConfig={setPersonalizzaConfig}
                personalizzaLoading={personalizzaLoading}
                personalizzaSaving={personalizzaSaving}
                onSavePersonalizza={savePersonalizzaConfig}
                kbDocuments={kbDocuments}
                chatOpenRoleId={chatOpenRoleId}
                setChatOpenRoleId={setChatOpenRoleId}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                unreadCount={unreadCount}
                activityContent={
                  <ActivityTab
                    activityData={activityData}
                    loadingActivity={loadingActivity}
                    activityPage={activityPage}
                    setActivityPage={setActivityPage}
                    severityFilter={severityFilter}
                    setSeverityFilter={setSeverityFilter}
                    activitySubTab={activitySubTab}
                    setActivitySubTab={setActivitySubTab}
                    onMarkRead={(id) => markReadMutation.mutate(id)}
                    onMarkAllRead={() => markAllReadMutation.mutate()}
                    unreadCount={unreadCount}
                    reasoningPage={reasoningPage}
                    setReasoningPage={setReasoningPage}
                    reasoningRole={reasoningRole}
                    setReasoningRole={setReasoningRole}
                    simulationResult={simulationResult}
                    setSimulationResult={setSimulationResult}
                    simulationLoading={simulationLoading}
                    setSimulationLoading={setSimulationLoading}
                    onClearOldFeed={() => clearOldFeedMutation.mutate()}
                    clearingOldFeed={clearOldFeedMutation.isPending}
                    reasoningLogsData={reasoningLogsData}
                    loadingReasoningLogs={loadingReasoningLogs}
                    reasoningStatsData={reasoningStatsData}
                    reasoningModeFilter={reasoningModeFilter}
                    setReasoningModeFilter={setReasoningModeFilter}
                    reasoningData={reasoningData}
                    loadingReasoning={loadingReasoning}
                  />
                }
                dashboardContent={
                  <DashboardTab
                    showCreateTask={showCreateTask}
                    setShowCreateTask={setShowCreateTask}
                    showLibrary={showLibrary}
                    setShowLibrary={setShowLibrary}
                    newTask={newTask}
                    setNewTask={setNewTask}
                    aiAnalyzing={aiAnalyzing}
                    aiSuggested={aiSuggested}
                    setAiSuggested={setAiSuggested}
                    clientSearchFilter={clientSearchFilter}
                    setClientSearchFilter={setClientSearchFilter}
                    allClients={allClients}
                    onAnalyzeWithAI={analyzeWithAI}
                    onCreateTask={() => createTaskMutation.mutate(newTask)}
                    isCreatingTask={createTaskMutation.isPending}
                    activeTasks={activeTasks}
                    pendingApprovalTasks={pendingApprovalTasks}
                    tasksStats={tasksStats}
                    loadingStats={loadingStats}
                    dashboardStatusFilter={dashboardStatusFilter}
                    setDashboardStatusFilter={(val) => { setDashboardStatusFilter(val); setDashboardPage(1); }}
                    dashboardCategoryFilter={dashboardCategoryFilter}
                    setDashboardCategoryFilter={(val) => { setDashboardCategoryFilter(val); setDashboardPage(1); }}
                    dashboardOriginFilter={dashboardOriginFilter}
                    setDashboardOriginFilter={(val) => { setDashboardOriginFilter(val); setDashboardPage(1); }}
                    dashboardRoleFilter={dashboardRoleFilter}
                    setDashboardRoleFilter={(val) => { setDashboardRoleFilter(val); setDashboardPage(1); }}
                    dashboardPage={dashboardPage}
                    setDashboardPage={setDashboardPage}
                    tasksData={tasksData}
                    loadingTasks={loadingTasks}
                    selectedTaskId={selectedTaskId}
                    setSelectedTaskId={setSelectedTaskId}
                    taskDetailData={taskDetailData}
                    loadingTaskDetail={loadingTaskDetail}
                    onExecuteTask={(taskId) => executeTaskMutation.mutate(taskId)}
                    tasksUrl={tasksUrl}
                    onOpenChatWithTask={(roleId, context) => {
                      setChatInitialMessage(context);
                      setChatOpenRoleId(roleId);
                    }}
                    onOpenChat={(roleId) => {
                      setChatInitialMessage(undefined);
                      setChatOpenRoleId(roleId);
                    }}
                  />
                }
                dataCatalogContent={
                  <DataCatalogTab
                    showArchDetails={showArchDetails}
                    setShowArchDetails={setShowArchDetails}
                  />
                }
              />
            </div>
          </main>

          {chatOpenRoleId && systemStatus?.roles && (() => {
            const chatRole = systemStatus.roles.find((r: any) => r.id === chatOpenRoleId);
            const chatProfile = chatRole ? AI_ROLE_PROFILES[chatRole.id] : null;
            return chatRole ? (
              <div className="w-[380px] sm:w-[420px] shrink-0 border-l bg-background h-full">
                <AgentChat
                  roleId={chatRole.id}
                  roleName={chatRole.name}
                  avatar={chatProfile?.avatar || "🤖"}
                  accentColor={chatRole.accentColor}
                  open={true}
                  onClose={() => { setChatOpenRoleId(null); setChatInitialMessage(undefined); }}
                  initialMessage={chatInitialMessage}
                />
              </div>
            ) : null;
          })()}
        </div>
      </div>

      <Button
        onClick={() => setShowAlessiaChat(!showAlessiaChat)}
        size="lg"
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center p-0",
          showAlessiaChat
            ? "bg-muted-foreground hover:bg-muted-foreground/90"
            : "bg-primary hover:bg-primary/90"
        )}
      >
        {showAlessiaChat ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <Bot className="h-6 w-6 text-white" />
        )}
      </Button>

      {showAlessiaChat && (
        <div className={cn(
          "fixed z-50 bg-background border border-border shadow-lg flex flex-col overflow-hidden",
          isMobile
            ? "inset-0 rounded-none"
            : "bottom-24 right-6 w-[400px] h-[600px] rounded-xl"
        )}>
          {isMobile && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
              <span className="font-semibold text-sm flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                Alessia
              </span>
              <Button variant="ghost" size="sm" onClick={() => setShowAlessiaChat(false)}>Chiudi</Button>
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <AllessiaSidePanel />
          </div>
        </div>
      )}
    </div>
  );
}
