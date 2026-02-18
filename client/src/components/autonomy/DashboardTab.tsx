import React, { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Plus, ChevronUp, ChevronLeft, ChevronRight, BookOpen, Sparkles,
  Loader2, Clock, CheckCircle, XCircle, User, ListTodo, TrendingUp,
  Target, Play, Trash2, Brain, Cog, Activity, Timer, Minus,
  Save, RefreshCw, AlertCircle, Info, Shield, RotateCcw, Database,
  Phone, Mail, MessageSquare, Globe, FileText, Eye, Search,
  ThumbsUp, Ban, UserCheck, ExternalLink, CalendarClock, Pencil,
  Layers, Square, CheckSquare, GitBranch, MoreHorizontal, LayoutList, Zap
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { AITask, TasksResponse, TasksStats, TaskDetailResponse, NewTaskData, ActivityItem } from "./types";
import { TASK_LIBRARY, TASK_CATEGORIES, EMPTY_NEW_TASK, AI_ROLE_PROFILES } from "./constants";
import {
  getTaskStatusBadge, getCategoryBadge, getPriorityIndicator,
  getActivityIcon, getRelativeTime, getStepActionLabel,
  getRoleBadgeClass, generateTaskPDF, tryParseJSON, renderFormattedText
} from "./utils";
import DeepResearchResults from "./DeepResearchResults";

interface DashboardTabProps {
  showCreateTask: boolean;
  setShowCreateTask: (show: boolean) => void;
  showLibrary: boolean;
  setShowLibrary: (show: boolean) => void;
  newTask: NewTaskData;
  setNewTask: React.Dispatch<React.SetStateAction<NewTaskData>>;
  aiAnalyzing: boolean;
  aiSuggested: boolean;
  setAiSuggested: (suggested: boolean) => void;
  clientSearchFilter: string;
  setClientSearchFilter: (filter: string) => void;
  allClients: Array<{ id: string; firstName: string; lastName: string; email: string; phoneNumber?: string; isActive: boolean }> | undefined;
  onAnalyzeWithAI: () => void;
  onCreateTask: () => void;
  isCreatingTask: boolean;
  activeTasks: AITask[] | undefined;
  pendingApprovalTasks: AITask[] | undefined;
  tasksStats: TasksStats | undefined;
  loadingStats: boolean;
  dashboardStatusFilter: string;
  setDashboardStatusFilter: (filter: string) => void;
  dashboardCategoryFilter: string;
  setDashboardCategoryFilter: (filter: string) => void;
  dashboardOriginFilter: string;
  setDashboardOriginFilter: (filter: string) => void;
  dashboardRoleFilter: string;
  setDashboardRoleFilter: (filter: string) => void;
  dashboardPage: number;
  setDashboardPage: (page: number | ((p: number) => number)) => void;
  tasksData: TasksResponse | undefined;
  loadingTasks: boolean;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  taskDetailData: TaskDetailResponse | undefined;
  loadingTaskDetail: boolean;
  onExecuteTask: (taskId: string) => void;
  tasksUrl: string;
  onOpenChatWithTask?: (roleId: string, taskContext: string) => void;
}

function DashboardTab({
  showCreateTask, setShowCreateTask,
  showLibrary, setShowLibrary,
  newTask, setNewTask,
  aiAnalyzing, aiSuggested, setAiSuggested,
  clientSearchFilter, setClientSearchFilter,
  allClients,
  onAnalyzeWithAI, onCreateTask, isCreatingTask,
  activeTasks,
  pendingApprovalTasks,
  tasksStats, loadingStats,
  dashboardStatusFilter, setDashboardStatusFilter,
  dashboardCategoryFilter, setDashboardCategoryFilter,
  dashboardOriginFilter, setDashboardOriginFilter,
  dashboardRoleFilter, setDashboardRoleFilter,
  dashboardPage, setDashboardPage,
  tasksData, loadingTasks,
  selectedTaskId, setSelectedTaskId,
  taskDetailData, loadingTaskDetail,
  onExecuteTask,
  tasksUrl,
  onOpenChatWithTask,
}: DashboardTabProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedTaskIds, setExpandedTaskIds] = React.useState<Set<string>>(new Set());
  const [cancelDialogTask, setCancelDialogTask] = React.useState<AITask | null>(null);
  const [rescheduleTask, setRescheduleTask] = React.useState<AITask | null>(null);
  const [rescheduleDate, setRescheduleDate] = React.useState("");
  const [isBlockCancel, setIsBlockCancel] = React.useState(false);
  const [blocksData, setBlocksData] = React.useState<any[]>([]);
  const [blocksLoading, setBlocksLoading] = React.useState(false);
  const [deletingBlockId, setDeletingBlockId] = React.useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = React.useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [resettingAll, setResettingAll] = React.useState(false);
  const [gestioneTab, setGestioneTab] = React.useState("blocks");
  const [actionDialogTask, setActionDialogTask] = React.useState<AITask | null>(null);
  const [restoringTaskId, setRestoringTaskId] = React.useState<string | null>(null);
  const [expandedHistoryIds, setExpandedHistoryIds] = React.useState<Set<string>>(new Set());
  const [editTask, setEditTask] = React.useState<AITask | null>(null);
  const [editInstruction, setEditInstruction] = React.useState("");
  const [editContext, setEditContext] = React.useState("");
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [postponeTask, setPostponeTask] = React.useState<AITask | null>(null);
  const [postponeNote, setPostponeNote] = React.useState("");
  const [postponeHours, setPostponeHours] = React.useState("24");
  const [mergeMode, setMergeMode] = React.useState(false);
  const [selectedMergeIds, setSelectedMergeIds] = React.useState<Set<string>>(new Set());
  const [isMerging, setIsMerging] = React.useState(false);
  const [executiveView, setExecutiveView] = React.useState(false);
  const [showAllActivity, setShowAllActivity] = React.useState(false);

  React.useEffect(() => {
    setShowAllActivity(false);
  }, [selectedTaskId]);

  const fetchBlocks = React.useCallback(async () => {
    setBlocksLoading(true);
    try {
      const res = await fetch("/api/ai-autonomy/blocks", { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBlocksData(data);
      }
    } catch {}
    setBlocksLoading(false);
  }, []);

  React.useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const handleDeleteBlock = async (blockId: string) => {
    setDeletingBlockId(blockId);
    try {
      const res = await fetch(`/api/ai-autonomy/blocks/${blockId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setBlocksData(prev => prev.filter(b => b.id !== blockId));
        toast({ title: "Blocco rimosso", description: "Il blocco è stato eliminato con successo" });
      } else throw new Error();
    } catch {
      toast({ title: "Errore", description: "Impossibile eliminare il blocco", variant: "destructive" });
    }
    setDeletingBlockId(null);
  };

  const handleBulkDeleteBlocks = async () => {
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/ai-autonomy/blocks", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setBlocksData([]);
        toast({ title: "Tutti i blocchi rimossi", description: "Tutti i blocchi sono stati eliminati" });
      } else throw new Error();
    } catch {
      toast({ title: "Errore", description: "Impossibile eliminare i blocchi", variant: "destructive" });
    }
    setBulkDeleting(false);
  };

  const handleDeleteTask = async (taskId: string) => {
    setDeletingTaskId(taskId);
    try {
      const res = await fetch(`/api/ai-autonomy/tasks/${taskId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === "string" && key.includes("/api/ai-autonomy/");
          },
        });
        toast({ title: "Task eliminato", description: "Il task è stato eliminato definitivamente" });
        if (selectedTaskId === taskId) setSelectedTaskId(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast({ title: "Errore", description: errData.error || "Impossibile eliminare il task", variant: "destructive" });
      }
    } catch {
      toast({ title: "Errore", description: "Impossibile eliminare il task", variant: "destructive" });
    }
    setDeletingTaskId(null);
  };

  const handleRestoreTask = async (taskId: string) => {
    setRestoringTaskId(taskId);
    try {
      const res = await fetch(`/api/ai-autonomy/tasks/${taskId}/restore`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === "string" && key.includes("/api/ai-autonomy/");
          },
        });
        toast({ title: "Task ripristinato", description: "Il task è tornato in coda per l'approvazione" });
        setActionDialogTask(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast({ title: "Errore", description: errData.error || "Impossibile ripristinare il task", variant: "destructive" });
      }
    } catch {
      toast({ title: "Errore", description: "Impossibile ripristinare il task", variant: "destructive" });
    }
    setRestoringTaskId(null);
  };

  const toggleHistoryExpand = (taskId: string) => {
    setExpandedHistoryIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleResetAll = async () => {
    setResettingAll(true);
    try {
      const res = await fetch("/api/ai-autonomy/reset-all", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setBlocksData([]);
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === "string" && key.includes("/api/ai-autonomy/");
          },
        });
        toast({
          title: "Reset completato",
          description: `Eliminati: ${data.deleted.tasks} task, ${data.deleted.blocks} blocchi, ${data.deleted.activityLogs} log attività`,
        });
      } else throw new Error();
    } catch {
      toast({ title: "Errore", description: "Impossibile eseguire il reset", variant: "destructive" });
    }
    setResettingAll(false);
  };

  const handleCancelTask = async (taskId: string, block: boolean) => {
    try {
      const res = await fetch(`/api/ai-autonomy/tasks/${taskId}/cancel`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        ...(block ? { body: JSON.stringify({ block: true }) } : {}),
      });
      if (!res.ok) throw new Error("Failed");
      toast({
        title: block ? "Task cancellato e bloccato" : "Task cancellato",
        description: block
          ? "Il task è stato cancellato e un blocco permanente è stato creato"
          : "Il task è stato cancellato con successo",
      });
      queryClient.invalidateQueries({ queryKey: [tasksUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/tasks-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/active-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/pending-approval-tasks"] });
      if (selectedTaskId === taskId) setSelectedTaskId(null);
    } catch {
      toast({ title: "Errore", description: "Impossibile cancellare il task", variant: "destructive" });
    }
    setCancelDialogTask(null);
    setIsBlockCancel(false);
  };

  const handleMarkDone = async (taskId: string, skipConfirm = false) => {
    if (!skipConfirm && !window.confirm("Hai già gestito questo task manualmente?\n\nVerrà segnato come completato e l'AI non lo riproporrà.")) {
      return;
    }
    try {
      const res = await fetch(`/api/ai-autonomy/tasks/${taskId}/mark-done`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      toast({
        title: "Task completato",
        description: "Il task è stato segnato come già fatto da te",
      });
      queryClient.invalidateQueries({ queryKey: [tasksUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/tasks-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/active-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/pending-approval-tasks"] });
      if (selectedTaskId === taskId) {
        queryClient.invalidateQueries({ queryKey: [`/api/ai-autonomy/tasks/${taskId}`] });
      }
    } catch {
      toast({ title: "Errore", description: "Impossibile segnare il task come completato", variant: "destructive" });
    }
  };

  const handlePostpone = async (taskId: string) => {
    try {
      const res = await fetch(`/api/ai-autonomy/tasks/${taskId}/postpone`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ note: postponeNote, reschedule_hours: parseInt(postponeHours) || 24 }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({
        title: "Task rimandato",
        description: `Verrà riproposto tra ${postponeHours} ore per ri-analisi`,
      });
      queryClient.invalidateQueries({ queryKey: [tasksUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/tasks-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/active-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/pending-approval-tasks"] });
      setPostponeTask(null);
      setPostponeNote("");
      setPostponeHours("24");
    } catch {
      toast({ title: "Errore", description: "Impossibile rimandare il task", variant: "destructive" });
    }
  };

  const handleMergeTasks = async () => {
    if (selectedMergeIds.size < 2) return;
    setIsMerging(true);
    try {
      const res = await fetch("/api/ai-autonomy/tasks/merge", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ task_ids: Array.from(selectedMergeIds) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore durante l'aggregazione");
      }
      const data = await res.json();
      toast({
        title: "Task aggregati",
        description: `${data.merged_count} task aggregati nel task principale`,
      });
      setSelectedMergeIds(new Set());
      setMergeMode(false);
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.includes("/api/ai-autonomy/");
        },
      });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message || "Impossibile aggregare i task", variant: "destructive" });
    }
    setIsMerging(false);
  };

  const toggleMergeSelect = (taskId: string) => {
    setSelectedMergeIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleOpenChatAboutTask = (task: AITask, question?: string) => {
    const roleId = task.ai_role || 'alessia';
    const prefix = question || 'Cosa hai fatto?';
    const context = `${prefix} Parlo del task: "${task.ai_instruction?.substring(0, 200)}"${task.contact_name ? ` (riguarda ${task.contact_name})` : ''}. Stato: ${task.status}.`;
    onOpenChatWithTask?.(roleId, context);
  };

  const toggleTaskExpand = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const getRoleBadge = (role: string) => {
    const colorMap: Record<string, string> = {
      alessia: "border-pink-200 text-pink-700 dark:border-pink-800 dark:text-pink-400",
      millie: "border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-400",
      echo: "border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-400",
      nova: "border-pink-200 text-pink-700 dark:border-pink-800 dark:text-pink-400",
      stella: "border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400",
      iris: "border-teal-200 text-teal-700 dark:border-teal-800 dark:text-teal-400",
      marco: "border-indigo-200 text-indigo-700 dark:border-indigo-800 dark:text-indigo-400",
    };
    return colorMap[role] || "border-border text-muted-foreground";
  };

  const getPriorityBorderColor = (priority: number) => {
    switch(priority) {
      case 1: return 'border-l-red-500';
      case 2: return 'border-l-amber-500';
      case 3: return 'border-l-blue-500';
      default: return 'border-l-gray-300 dark:border-l-gray-600';
    }
  };

  const detectPlannedActions = (task: AITask) => {
    const actions: Array<{ icon: React.ReactNode; label: string; detail?: string; color: string }> = [];
    const instruction = (task.ai_instruction || '').toLowerCase();
    const channel = task.preferred_channel;
    const plan = task.execution_plan || [];
    const planActions = plan.map(s => s.action);
    const isMarco = task.ai_role === 'marco';

    if (channel === 'voice' || planActions.includes('voice_call') || planActions.includes('prepare_call') ||
        instruction.includes('chiama') || instruction.includes('chiamata') || instruction.includes('telefonat')) {
      actions.push({
        icon: <Phone className="h-3.5 w-3.5" />,
        label: isMarco ? "Ti chiamerà" : "Chiamata vocale",
        detail: isMarco ? "a te" : (task.contact_phone || undefined),
        color: isMarco
          ? "text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800"
          : "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800"
      });
    }

    if (channel === 'email' || planActions.includes('send_email') ||
        instruction.includes('email') || instruction.includes('e-mail') || instruction.includes('invia email')) {
      actions.push({
        icon: <Mail className="h-3.5 w-3.5" />,
        label: isMarco ? "Email a te" : "Invio email",
        detail: undefined,
        color: isMarco
          ? "text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800"
          : "text-violet-600 bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800"
      });
    }

    if (channel === 'whatsapp' || planActions.includes('send_whatsapp') ||
        instruction.includes('whatsapp') || instruction.includes('messaggio')) {
      actions.push({
        icon: <MessageSquare className="h-3.5 w-3.5" />,
        label: isMarco ? "WhatsApp a te" : "Messaggio WhatsApp",
        detail: isMarco ? "a te" : (task.contact_phone || undefined),
        color: isMarco
          ? "text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800"
          : "text-green-600 bg-green-50 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
      });
    }

    if (planActions.includes('web_search') || instruction.includes('ricerca') || instruction.includes('cerca')) {
      actions.push({
        icon: <Globe className="h-3.5 w-3.5" />,
        label: "Ricerca web",
        color: "text-cyan-600 bg-cyan-50 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800"
      });
    }

    if (planActions.includes('generate_report') || task.task_category === 'report' ||
        instruction.includes('report') || instruction.includes('riepilog')) {
      actions.push({
        icon: <FileText className="h-3.5 w-3.5" />,
        label: "Genera report",
        color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
      });
    }

    if (planActions.includes('fetch_client_data') || planActions.includes('analyze_patterns') ||
        task.task_category === 'analysis' || instruction.includes('analiz')) {
      actions.push({
        icon: <Search className="h-3.5 w-3.5" />,
        label: "Analisi dati",
        color: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800"
      });
    }

    if (planActions.includes('search_private_stores')) {
      actions.push({
        icon: <Database className="h-3.5 w-3.5" />,
        label: "Ricerca documenti",
        color: "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-800"
      });
    }

    if (actions.length === 0) {
      actions.push({
        icon: <Brain className="h-3.5 w-3.5" />,
        label: "Elaborazione AI",
        color: "text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800"
      });
    }

    return actions;
  };

  const getObjectiveLabel = (obj?: string) => {
    const map: Record<string, string> = {
      informare: "Informare",
      vendere: "Vendere",
      fidelizzare: "Fidelizzare",
      raccogliere_info: "Raccogliere info",
      supporto: "Supporto",
      followup: "Follow-up",
    };
    return obj ? map[obj] || obj : null;
  };

  const availableRoles = useMemo(() => {
    if (!tasksStats?.role_counts) return [];
    return tasksStats.role_counts.map(rc => rc.role).sort();
  }, [tasksStats?.role_counts]);

  const subTaskMap = useMemo(() => {
    if (!tasksData?.tasks) return new Map<string, typeof tasksData.tasks>();
    const map = new Map<string, typeof tasksData.tasks>();
    tasksData.tasks.forEach(task => {
      if (task.parent_task_id) {
        const existing = map.get(task.parent_task_id) || [];
        existing.push(task);
        map.set(task.parent_task_id, existing);
      }
    });
    return map;
  }, [tasksData?.tasks]);

  const [showCompletedSection, setShowCompletedSection] = React.useState(false);

  const { groupedTasks, recentCompletedTasks, olderCompletedTasks } = useMemo(() => {
    if (!tasksData?.tasks) return { groupedTasks: [], recentCompletedTasks: [], olderCompletedTasks: [] };
    const topLevelTasks = tasksData.tasks.filter(t => !t.parent_task_id);
    const filteredTasks = dashboardRoleFilter === 'all'
      ? topLevelTasks
      : dashboardRoleFilter === '__manual__'
        ? topLevelTasks.filter(t => !t.ai_role)
        : topLevelTasks.filter(t => t.ai_role === dashboardRoleFilter);

    const isAllTab = dashboardStatusFilter === 'all';
    const activeTasks = isAllTab ? filteredTasks.filter(t => t.status !== 'completed') : filteredTasks;
    const completed = isAllTab ? filteredTasks.filter(t => t.status === 'completed') : [];

    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    const recent: typeof completed = [];
    const older: typeof completed = [];
    completed.forEach(task => {
      const taskTime = new Date(task.completed_at || task.created_at).getTime();
      if (taskTime >= twentyFourHoursAgo) {
        recent.push(task);
      } else {
        older.push(task);
      }
    });

    const groups: Record<string, typeof activeTasks> = {};
    activeTasks.forEach(task => {
      const role = task.ai_role || '__manual__';
      if (!groups[role]) groups[role] = [];
      groups[role].push(task);
    });
    const roleOrder = Object.keys(groups).sort((a, b) => {
      if (a === '__manual__') return 1;
      if (b === '__manual__') return -1;
      return a.localeCompare(b);
    });
    return {
      groupedTasks: roleOrder.map(role => ({ role, tasks: groups[role] })),
      recentCompletedTasks: recent,
      olderCompletedTasks: older,
    };
  }, [tasksData?.tasks, dashboardRoleFilter, dashboardStatusFilter]);

  const STATUS_TABS = [
    { value: 'all', label: 'Tutti', count: tasksStats?.total ?? 0, icon: <ListTodo className="h-3.5 w-3.5" />, color: '' },
    { value: 'waiting_approval', label: 'Da approvare', count: tasksStats?.waiting_approval ?? 0, icon: <ThumbsUp className="h-3.5 w-3.5" />, color: 'text-amber-600 dark:text-amber-400' },
    { value: 'scheduled', label: 'Programmati', count: tasksStats?.scheduled ?? 0, icon: <CalendarClock className="h-3.5 w-3.5" />, color: 'text-blue-600 dark:text-blue-400' },
    { value: 'in_progress', label: 'In corso', count: tasksStats?.in_progress ?? 0, icon: <Activity className="h-3.5 w-3.5" />, color: 'text-primary' },
    { value: 'completed', label: 'Completati', count: tasksStats?.completed ?? 0, icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'text-emerald-600 dark:text-emerald-400' },
    { value: 'failed', label: 'Falliti', count: tasksStats?.failed ?? 0, icon: <XCircle className="h-3.5 w-3.5" />, color: 'text-red-600 dark:text-red-400' },
    { value: 'deferred', label: 'Rimandati', count: tasksStats?.deferred ?? 0, icon: <Clock className="h-3.5 w-3.5" />, color: 'text-orange-600 dark:text-orange-400' },
    { value: 'cancelled', label: 'Cancellati', count: tasksStats?.cancelled ?? 0, icon: <Ban className="h-3.5 w-3.5" />, color: 'text-muted-foreground' },
  ];

  const handleStatusTabChange = (value: string) => {
    setDashboardStatusFilter(value);
    setDashboardPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {mergeMode && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs tabular-nums px-2 py-1">
                  {selectedMergeIds.size} selezionati
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => { setMergeMode(false); setSelectedMergeIds(new Set()); }}
                >
                  Annulla
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/50">
              <Button
                variant={executiveView ? "ghost" : "secondary"}
                size="sm"
                className={cn("h-7 px-2.5 text-xs gap-1 rounded-md", !executiveView && "shadow-sm")}
                onClick={() => setExecutiveView(false)}
              >
                <LayoutList className="h-3 w-3" />
                Operativa
              </Button>
              <Button
                variant={executiveView ? "secondary" : "ghost"}
                size="sm"
                className={cn("h-7 px-2.5 text-xs gap-1 rounded-md", executiveView && "shadow-sm")}
                onClick={() => setExecutiveView(true)}
              >
                <Zap className="h-3 w-3" />
                Executive
              </Button>
            </div>
            {!mergeMode && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9 text-xs font-medium border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-950/30"
                onClick={() => { setMergeMode(true); setSelectedMergeIds(new Set()); }}
              >
                <Layers className="h-3.5 w-3.5" />
                Aggrega duplicati
              </Button>
            )}
            {!showCreateTask && (
              <Button
                onClick={() => setShowCreateTask(true)}
                className="gap-2 h-10 px-5 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-lg transition-all duration-200 text-sm font-semibold"
              >
                <Plus className="h-4.5 w-4.5" />
                Crea Nuovo Task
              </Button>
            )}
          </div>
        </div>

        {showCreateTask && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <Card className="border border-border rounded-xl shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-xl bg-primary/10">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    Crea Nuovo Task AI
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn("h-8 gap-1 text-xs", showLibrary && "bg-primary/10 text-primary")}
                      onClick={() => setShowLibrary(!showLibrary)}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Libreria
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowCreateTask(false)}>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              {showLibrary && (
                <div className="px-6 pb-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Libreria Task</span>
                      <Badge variant="outline" className="text-[10px]">{TASK_LIBRARY.length} preset</Badge>
                    </div>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pr-3">
                      {TASK_LIBRARY.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            setNewTask(prev => ({
                              ...prev,
                              ai_instruction: preset.instruction,
                              task_category: preset.category,
                              priority: preset.priority || 3,
                              preferred_channel: preset.preferred_channel || "",
                              tone: preset.tone || "",
                              urgency: preset.urgency || "normale",
                              objective: preset.objective || "",
                              voice_template_suggestion: preset.voice_template_suggestion || "",
                            }));
                            setAiSuggested(false);
                          }}
                          className="flex items-start gap-2.5 p-3 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/40 transition-all duration-200 text-left group"
                        >
                          <span className="text-lg shrink-0 mt-0.5">{preset.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold group-hover:text-primary transition-colors truncate">{preset.title}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{preset.description}</p>
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              {getCategoryBadge(preset.category)}
                              {preset.preferred_channel && (
                                <Badge variant="outline" className="text-[9px] py-0 px-1">
                                  {preset.preferred_channel === 'voice' ? '📞' : preset.preferred_channel === 'email' ? '📧' : '💬'}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                  <Separator className="mt-3" />
                </div>
              )}
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Istruzioni per l'AI</Label>
                  <Textarea
                    placeholder="Descrivi cosa deve fare l'AI... es: Chiama Mario Rossi per ricordargli la scadenza del portafoglio"
                    value={newTask.ai_instruction}
                    onChange={(e) => { setNewTask(prev => ({ ...prev, ai_instruction: e.target.value })); setAiSuggested(false); }}
                    rows={3}
                    className="resize-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onAnalyzeWithAI}
                    disabled={!newTask.ai_instruction.trim() || aiAnalyzing}
                    className="gap-2"
                  >
                    {aiAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {aiAnalyzing ? "Analisi in corso..." : "Analizza con AI"}
                  </Button>
                </div>

                {aiSuggested && (
                  <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 rounded-xl px-3 py-2 border border-primary/10">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Campi compilati dall'AI — puoi modificarli prima di creare il task</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      Categoria
                      {aiSuggested && <Badge className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 text-[9px] px-1 py-0">AI</Badge>}
                    </Label>
                    <Select value={newTask.task_category} onValueChange={(v) => setNewTask(prev => ({ ...prev, task_category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TASK_CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      Priorità
                      {aiSuggested && <Badge className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 text-[9px] px-1 py-0">AI</Badge>}
                    </Label>
                    <Select value={String(newTask.priority)} onValueChange={(v) => setNewTask(prev => ({ ...prev, priority: parseInt(v) }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Alta</SelectItem>
                        <SelectItem value="2">Media-Alta</SelectItem>
                        <SelectItem value="3">Media</SelectItem>
                        <SelectItem value="4">Bassa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      Canale preferito
                      {aiSuggested && <Badge className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 text-[9px] px-1 py-0">AI</Badge>}
                    </Label>
                    <Select value={newTask.preferred_channel || "none"} onValueChange={(v) => setNewTask(prev => ({ ...prev, preferred_channel: v === "none" ? "" : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nessun canale specifico</SelectItem>
                        <SelectItem value="voice">Voce (Chiamata)</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      Tono
                      {aiSuggested && <Badge className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 text-[9px] px-1 py-0">AI</Badge>}
                    </Label>
                    <Select value={newTask.tone || "professionale"} onValueChange={(v) => setNewTask(prev => ({ ...prev, tone: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formale">Formale</SelectItem>
                        <SelectItem value="informale">Informale</SelectItem>
                        <SelectItem value="empatico">Empatico</SelectItem>
                        <SelectItem value="professionale">Professionale</SelectItem>
                        <SelectItem value="persuasivo">Persuasivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      Urgenza
                      {aiSuggested && <Badge className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 text-[9px] px-1 py-0">AI</Badge>}
                    </Label>
                    <Select value={newTask.urgency || "normale"} onValueChange={(v) => setNewTask(prev => ({ ...prev, urgency: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediata">Immediata</SelectItem>
                        <SelectItem value="oggi">Entro oggi</SelectItem>
                        <SelectItem value="settimana">Entro questa settimana</SelectItem>
                        <SelectItem value="programmata">Programmata (data specifica)</SelectItem>
                        <SelectItem value="normale">Normale</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      Obiettivo
                      {aiSuggested && <Badge className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 text-[9px] px-1 py-0">AI</Badge>}
                    </Label>
                    <Select value={newTask.objective || "informare"} onValueChange={(v) => setNewTask(prev => ({ ...prev, objective: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="informare">Informare</SelectItem>
                        <SelectItem value="vendere">Vendere / Proporre</SelectItem>
                        <SelectItem value="fidelizzare">Fidelizzare</SelectItem>
                        <SelectItem value="raccogliere_info">Raccogliere Informazioni</SelectItem>
                        <SelectItem value="supporto">Supporto</SelectItem>
                        <SelectItem value="followup">Follow-up Generico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {newTask.urgency === "programmata" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Data e ora programmata</Label>
                    <Input
                      type="datetime-local"
                      value={newTask.scheduled_datetime}
                      onChange={(e) => setNewTask(prev => ({ ...prev, scheduled_datetime: e.target.value }))}
                    />
                  </div>
                )}

                {newTask.preferred_channel === "voice" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      Template Vocale
                      {aiSuggested && newTask.voice_template_suggestion && <Badge className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 text-[9px] px-1 py-0">AI</Badge>}
                    </Label>
                    <Select value={newTask.voice_template_suggestion || "__none__"} onValueChange={(v) => setNewTask(prev => ({ ...prev, voice_template_suggestion: v === "__none__" ? "" : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nessun template specifico</SelectItem>
                        <SelectItem value="sales-orbitale">Sales Call Orbitale</SelectItem>
                        <SelectItem value="follow-up-lead">Follow-up Lead</SelectItem>
                        <SelectItem value="recupero-crediti">Recupero Crediti</SelectItem>
                        <SelectItem value="check-in-cliente">Check-in Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-1.5">
                      Cliente <span className="text-muted-foreground font-normal">(opzionale)</span>
                      {aiSuggested && newTask.client_id && <Badge className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 text-[9px] px-1 py-0">AI</Badge>}
                    </Label>
                    <Select
                      value={newTask.client_id}
                      onValueChange={(v) => {
                        const selectedClient = allClients?.find(c => c.id === v);
                        if (v === "__none__") {
                          setNewTask(prev => ({ ...prev, client_id: "", contact_name: "", contact_phone: "" }));
                          setClientSearchFilter("");
                        } else if (selectedClient) {
                          setNewTask(prev => ({
                            ...prev,
                            client_id: v,
                            contact_name: `${selectedClient.firstName} ${selectedClient.lastName}`,
                            contact_phone: selectedClient.phoneNumber || "",
                          }));
                          setClientSearchFilter("");
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona un cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="px-2 py-1.5">
                          <Input
                            placeholder="Cerca cliente..."
                            value={clientSearchFilter}
                            onChange={(e) => setClientSearchFilter(e.target.value)}
                            className="h-8 text-sm"
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                        </div>
                        <SelectItem value="__none__">Nessun cliente specifico</SelectItem>
                        {(() => {
                          const filtered = (allClients || []).filter(c => {
                            if (!clientSearchFilter) return true;
                            const search = clientSearchFilter.toLowerCase();
                            return `${c.firstName} ${c.lastName}`.toLowerCase().includes(search) || c.email.toLowerCase().includes(search);
                          });
                          const activeClients = filtered.filter(c => c.isActive);
                          const inactiveClients = filtered.filter(c => !c.isActive);
                          return (
                            <>
                              {activeClients.length > 0 && (
                                <>
                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                    Clienti attivi <span className="font-normal text-[10px]">(include consulenti-clienti)</span>
                                  </div>
                                  {activeClients.map(c => (
                                    <SelectItem key={c.id} value={c.id}>
                                      <span className="flex items-center gap-2">
                                        {c.firstName} {c.lastName}
                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 text-[10px] px-1 py-0">Attivo</Badge>
                                      </span>
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                              {inactiveClients.length > 0 && (
                                <>
                                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                    Clienti inattivi
                                  </div>
                                  {inactiveClients.map(c => (
                                    <SelectItem key={c.id} value={c.id}>
                                      <span className="flex items-center gap-2">
                                        {c.firstName} {c.lastName}
                                        <Badge className="bg-muted text-muted-foreground text-[10px] px-1 py-0">Inattivo</Badge>
                                      </span>
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                              {filtered.length === 0 && (
                                <div className="px-2 py-3 text-sm text-muted-foreground text-center">Nessun cliente trovato</div>
                              )}
                            </>
                          );
                        })()}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Telefono <span className="text-muted-foreground font-normal">(opzionale)</span></Label>
                    <Input
                      placeholder="es: +39 333 1234567 o 1009"
                      value={newTask.contact_phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9+\s\-()]/g, '');
                        setNewTask(prev => ({ ...prev, contact_phone: val }));
                      }}
                      className={cn("h-9 text-sm", newTask.contact_phone && !/^\+?[0-9\s\-()]{3,20}$/.test(newTask.contact_phone) && "border-red-500 focus-visible:ring-red-500")}
                      type="tel"
                    />
                    {newTask.contact_phone && !/^\+?[0-9\s\-()]{3,20}$/.test(newTask.contact_phone) && (
                      <p className="text-xs text-red-500">Formato non valido. Usa un numero di telefono o interno (es: +39 333 1234567, 1009)</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Contesto aggiuntivo <span className="text-muted-foreground font-normal">(opzionale)</span></Label>
                  <Textarea
                    placeholder="Note o contesto extra per l'AI... es: Il cliente ha mostrato interesse per i fondi pensione nell'ultima call"
                    value={newTask.additional_context}
                    onChange={(e) => setNewTask(prev => ({ ...prev, additional_context: e.target.value }))}
                    rows={2}
                    className="resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={onCreateTask}
                    disabled={!newTask.ai_instruction.trim() || isCreatingTask}
                    className="gap-2"
                  >
                    {isCreatingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Crea Task
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateTask(false);
                      setNewTask(EMPTY_NEW_TASK);
                      setClientSearchFilter("");
                      setAiSuggested(false);
                    }}
                  >
                    Annulla
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {activeTasks && activeTasks.length > 0 && (
        <Card className="border border-primary/20 rounded-xl shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
              Task Attive in Tempo Reale
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{activeTasks.length}</Badge>
              <span className="ml-auto text-xs font-normal text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Ultimo aggiornamento: {new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeTasks.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.08 }}
                className="rounded-xl border border-border bg-card p-4 space-y-3 cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => setSelectedTaskId(task.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{task.ai_instruction}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {getCategoryBadge(task.task_category)}
                      {getPriorityIndicator(task.priority)}
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                        {task.status === "in_progress" ? "In esecuzione" : task.status === "approved" ? "Approvato" : "Programmato"}
                      </Badge>
                    </div>
                  </div>
                </div>
                {task.execution_plan && task.execution_plan.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progresso</span>
                      <span>{task.execution_plan.filter(s => s.status === "completed").length}/{task.execution_plan.length} step</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(task.execution_plan.filter(s => s.status === "completed").length / task.execution_plan.length) * 100}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {task.execution_plan.map((step) => (
                        <div key={step.step} className="flex items-center gap-1 text-xs">
                          {step.status === "completed" ? (
                            <CheckCircle className="h-3 w-3 text-emerald-500" />
                          ) : step.status === "in_progress" ? (
                            <Loader2 className="h-3 w-3 text-primary animate-spin" />
                          ) : step.status === "failed" ? (
                            <XCircle className="h-3 w-3 text-red-500" />
                          ) : (
                            <div className="h-3 w-3 rounded-full border border-muted-foreground/40" />
                          )}
                          <span className={step.status === "completed" ? "text-emerald-600" : step.status === "in_progress" ? "text-primary" : "text-muted-foreground"}>
                            {step.action.replace(/_/g, " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {task.result_summary && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl p-2">{task.result_summary}</p>
                )}
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      {pendingApprovalTasks && pendingApprovalTasks.length > 0 && (
        <Card className="border border-amber-200 dark:border-amber-800 rounded-xl shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base">Task Generati dall'AI</CardTitle>
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400">
                {pendingApprovalTasks.length}
              </Badge>
            </div>
            <CardDescription>Task autonomi in attesa della tua approvazione</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingApprovalTasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl border border-amber-200/50 dark:border-amber-800/50 bg-background/80 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.ai_instruction}</p>
                    {task.ai_reasoning && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.ai_reasoning}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center flex-wrap gap-1.5">
                  {getCategoryBadge(task.task_category)}
                  {getPriorityIndicator(task.priority)}
                  {task.ai_role && (
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getRoleBadge(task.ai_role))}>
                      {task.ai_role}
                    </Badge>
                  )}
                  {task.contact_name && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      <User className="h-3 w-3 mr-0.5" />
                      {task.contact_name}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/ai-autonomy/tasks/${task.id}/execute`, {
                          method: "PATCH",
                          headers: getAuthHeaders(),
                        });
                        if (!res.ok) throw new Error("Failed");
                        toast({ title: "Task avviato", description: "Il task è stato avviato con successo" });
                        queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/pending-approval-tasks"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/active-tasks"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/tasks-stats"] });
                        queryClient.invalidateQueries({ queryKey: [tasksUrl] });
                      } catch {
                        toast({ title: "Errore", description: "Impossibile avviare il task", variant: "destructive" });
                      }
                    }}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Avvia
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                    onClick={() => handleMarkDone(task.id)}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Già fatta
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => setCancelDialogTask(task)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Elimina
                  </Button>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
        <div className="flex items-center overflow-x-auto scrollbar-none">
          {STATUS_TABS.map(tab => {
            const effectiveActive = dashboardStatusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => handleStatusTabChange(tab.value)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap transition-all duration-200 border-b-2 relative",
                  effectiveActive
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <span className={cn(tab.color)}>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={cn(
                    "min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1",
                    effectiveActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative overflow-hidden rounded-2xl border border-blue-200/60 dark:border-blue-800/40 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-950/40 dark:to-indigo-950/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/15 dark:bg-blue-400/15">
              <ListTodo className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-blue-900 dark:text-blue-100">{loadingStats ? "—" : tasksStats?.total ?? 0}</p>
              <p className="text-[11px] font-medium text-blue-600/80 dark:text-blue-400/80 uppercase tracking-wider">Totali</p>
            </div>
          </div>
          <div className="absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-blue-400/10 dark:bg-blue-400/5" />
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/60 dark:border-amber-800/40 bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/40 dark:to-orange-950/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 dark:bg-amber-400/15">
              <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-amber-900 dark:text-amber-100">{loadingStats ? "—" : tasksStats?.active ?? 0}</p>
              <p className="text-[11px] font-medium text-amber-600/80 dark:text-amber-400/80 uppercase tracking-wider">Attivi</p>
            </div>
          </div>
          <div className="absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-amber-400/10 dark:bg-amber-400/5" />
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50 to-green-50/50 dark:from-emerald-950/40 dark:to-green-950/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 dark:bg-emerald-400/15">
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-emerald-900 dark:text-emerald-100">{loadingStats ? "—" : tasksStats?.completed ?? 0}</p>
              <p className="text-[11px] font-medium text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wider">Completati</p>
            </div>
          </div>
          <div className="absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-emerald-400/10 dark:bg-emerald-400/5" />
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-red-200/60 dark:border-red-800/40 bg-gradient-to-br from-red-50 to-rose-50/50 dark:from-red-950/40 dark:to-rose-950/20 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/15 dark:bg-red-400/15">
              <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-red-900 dark:text-red-100">{loadingStats ? "—" : tasksStats?.failed ?? 0}</p>
              <p className="text-[11px] font-medium text-red-600/80 dark:text-red-400/80 uppercase tracking-wider">Falliti</p>
            </div>
          </div>
          <div className="absolute -bottom-3 -right-3 h-16 w-16 rounded-full bg-red-400/10 dark:bg-red-400/5" />
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtra task</span>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Select value={dashboardStatusFilter} onValueChange={(val) => { setDashboardStatusFilter(val); setDashboardPage(1); }}>
            <SelectTrigger className="w-[160px] h-9 rounded-lg text-sm">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              <SelectItem value="active">Attivi</SelectItem>
              <SelectItem value="completed">Completati</SelectItem>
              <SelectItem value="failed">Falliti</SelectItem>
              <SelectItem value="paused">In pausa</SelectItem>
              <SelectItem value="deferred">Rimandati</SelectItem>
              <SelectItem value="cancelled">Cancellati</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dashboardCategoryFilter} onValueChange={(val) => { setDashboardCategoryFilter(val); setDashboardPage(1); }}>
            <SelectTrigger className="w-[160px] h-9 rounded-lg text-sm">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le categorie</SelectItem>
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
          <Select value={dashboardOriginFilter} onValueChange={(val) => { setDashboardOriginFilter(val); setDashboardPage(1); }}>
            <SelectTrigger className="w-[180px] h-9 rounded-lg text-sm">
              <SelectValue placeholder="Origine" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le origini</SelectItem>
              <SelectItem value="manual">Manuali</SelectItem>
              <SelectItem value="autonomous">Autonomi (AI)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {availableRoles.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <button
            onClick={() => setDashboardRoleFilter("all")}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 shrink-0 min-w-[84px]",
              dashboardRoleFilter === "all"
                ? "bg-primary/10 ring-2 ring-primary/40"
                : "hover:bg-muted/60"
            )}
          >
            <div className={cn(
              "h-10 w-10 rounded-full bg-muted flex items-center justify-center transition-all",
              dashboardRoleFilter === "all" && "ring-2 ring-primary ring-offset-2 ring-offset-background"
            )}>
              <ListTodo className="h-5 w-5 text-muted-foreground" />
            </div>
            <span className={cn(
              "text-[10px] font-medium leading-tight text-center",
              dashboardRoleFilter === "all" ? "text-primary" : "text-muted-foreground"
            )}>Tutti</span>
          </button>
          {availableRoles.map(role => {
            const profile = AI_ROLE_PROFILES[role];
            const isActive = dashboardRoleFilter === role;
            const roleRingColors: Record<string, string> = {
              alessia: "ring-pink-400",
              millie: "ring-purple-400",
              echo: "ring-orange-400",
              nova: "ring-pink-400",
              stella: "ring-emerald-400",
              iris: "ring-teal-400",
              marco: "ring-indigo-400",
            };
            const roleBgColors: Record<string, string> = {
              alessia: "bg-pink-50 dark:bg-pink-950/30",
              millie: "bg-purple-50 dark:bg-purple-950/30",
              echo: "bg-orange-50 dark:bg-orange-950/30",
              nova: "bg-pink-50 dark:bg-pink-950/30",
              stella: "bg-emerald-50 dark:bg-emerald-950/30",
              iris: "bg-teal-50 dark:bg-teal-950/30",
              marco: "bg-indigo-50 dark:bg-indigo-950/30",
            };
            const roleTextColors: Record<string, string> = {
              alessia: "text-pink-600 dark:text-pink-400",
              millie: "text-purple-600 dark:text-purple-400",
              echo: "text-orange-600 dark:text-orange-400",
              nova: "text-pink-600 dark:text-pink-400",
              stella: "text-emerald-600 dark:text-emerald-400",
              iris: "text-teal-600 dark:text-teal-400",
              marco: "text-indigo-600 dark:text-indigo-400",
            };
            const taskCount = tasksStats?.role_counts?.find(rc => rc.role === role)?.count || 0;
            return (
              <button
                key={role}
                onClick={() => setDashboardRoleFilter(isActive ? "all" : role)}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 shrink-0 min-w-[84px] relative",
                  isActive
                    ? cn(roleBgColors[role] || "bg-primary/10", "ring-2", roleRingColors[role] || "ring-primary/40")
                    : "hover:bg-muted/60"
                )}
              >
                {profile?.avatar ? (
                  <img
                    src={profile.avatar}
                    alt={role}
                    className={cn(
                      "h-10 w-10 rounded-full object-cover transition-all",
                      isActive
                        ? cn("ring-2 ring-offset-2 ring-offset-background", roleRingColors[role] || "ring-primary")
                        : "ring-1 ring-border opacity-75 hover:opacity-100"
                    )}
                  />
                ) : (
                  <div className={cn(
                    "h-10 w-10 rounded-full bg-muted flex items-center justify-center",
                    isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  )}>
                    <ListTodo className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <span className={cn(
                  "text-[10px] font-medium leading-tight text-center max-w-[80px] line-clamp-2",
                  isActive ? (roleTextColors[role] || "text-primary") : "text-muted-foreground"
                )}>
                  {profile?.role || role.charAt(0).toUpperCase() + role.slice(1)}
                </span>
                {taskCount > 0 && (
                  <span className={cn(
                    "absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-background",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted-foreground/20 text-muted-foreground"
                  )}>
                    {taskCount}
                  </span>
                )}
              </button>
            );
          })}
          {(tasksStats?.manual_count ?? 0) > 0 && (
            <button
              onClick={() => setDashboardRoleFilter(dashboardRoleFilter === "__manual__" ? "all" : "__manual__")}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 shrink-0 min-w-[84px] relative",
                dashboardRoleFilter === "__manual__"
                  ? "bg-muted ring-2 ring-muted-foreground/40"
                  : "hover:bg-muted/60"
              )}
            >
              <div className={cn(
                "h-10 w-10 rounded-full bg-muted flex items-center justify-center transition-all",
                dashboardRoleFilter === "__manual__" && "ring-2 ring-muted-foreground ring-offset-2 ring-offset-background"
              )}>
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className={cn(
                "text-[10px] font-medium leading-tight text-center",
                dashboardRoleFilter === "__manual__" ? "text-foreground" : "text-muted-foreground"
              )}>Manuali</span>
              {(tasksStats?.manual_count ?? 0) > 0 && (
                <span className={cn(
                  "absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-background",
                  dashboardRoleFilter === "__manual__"
                    ? "bg-muted-foreground text-background"
                    : "bg-muted-foreground/20 text-muted-foreground"
                )}>
                  {tasksStats?.manual_count}
                </span>
              )}
            </button>
          )}
        </div>
      )}

      {loadingTasks ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !tasksData?.tasks?.length ? (
        <Card className="border border-border rounded-xl shadow-sm">
          <CardContent className="py-12 text-center">
            <ListTodo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nessun task trovato</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedTasks.map(({ role, tasks }) => {
            const profile = role !== '__manual__' ? AI_ROLE_PROFILES[role] : null;
            const roleAccentMap: Record<string, string> = {
              alessia: "text-pink-600 dark:text-pink-400",
              millie: "text-purple-600 dark:text-purple-400",
              echo: "text-orange-600 dark:text-orange-400",
              nova: "text-pink-600 dark:text-pink-400",
              stella: "text-emerald-600 dark:text-emerald-400",
              iris: "text-teal-600 dark:text-teal-400",
              marco: "text-indigo-600 dark:text-indigo-400",
            };
            const roleRingMap: Record<string, string> = {
              alessia: "ring-pink-300",
              millie: "ring-purple-300",
              echo: "ring-orange-300",
              nova: "ring-pink-300",
              stella: "ring-emerald-300",
              iris: "ring-teal-300",
              marco: "ring-indigo-300",
            };
            const accentText = role !== '__manual__' ? (roleAccentMap[role] || '') : '';
            const accentRing = role !== '__manual__' ? (roleRingMap[role] || 'ring-border') : 'ring-border';
            return (
              <div key={role} className="space-y-2">
                <div className="flex items-center gap-3 px-1 py-2">
                  {profile?.avatar ? (
                    <img src={profile.avatar} alt={role} className={cn("h-8 w-8 rounded-full object-cover ring-2 ring-offset-1 ring-offset-background", accentRing)} />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <ListTodo className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-semibold text-sm", accentText)}>
                        {role === '__manual__' ? 'Task Manuali' : role.charAt(0).toUpperCase() + role.slice(1)}
                      </span>
                      {profile && (
                        <span className="text-xs text-muted-foreground">{profile.role}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs tabular-nums">
                    {tasks.length}
                  </Badge>
                </div>
                <div className={cn("space-y-4 pl-1", executiveView && "space-y-1.5")}>
                  {tasks.map((task) => {
                    const plannedActions = detectPlannedActions(task);
                    const isWaiting = task.status === 'waiting_approval';
                    const isActionable = ['scheduled', 'draft', 'waiting_approval', 'paused', 'approved', 'deferred'].includes(task.status);
                    const isCancellable = ['scheduled', 'draft', 'waiting_approval', 'paused', 'deferred'].includes(task.status);
                    const canPostpone = ['scheduled', 'draft', 'waiting_approval', 'paused', 'approved'].includes(task.status);
                    const canRequestReport = ['completed', 'in_progress', 'failed'].includes(task.status);
                    const isMergeSelected = selectedMergeIds.has(task.id);
                    const isExpanded = expandedTaskIds.has(task.id);

                    if (executiveView) {
                      return (
                        <React.Fragment key={task.id}>
                        <div
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-colors cursor-pointer",
                            "hover:bg-muted/40",
                            getPriorityBorderColor(task.priority),
                            "border-l-4",
                            isWaiting && "bg-amber-50/30 dark:bg-amber-950/10"
                          )}
                          onClick={(e) => toggleTaskExpand(task.id, e)}
                        >
                          <div className="flex-1 min-w-0 flex items-center gap-2.5">
                            {task.contact_name && (
                              <span className="text-sm font-semibold text-foreground shrink-0">
                                {task.contact_name}
                              </span>
                            )}
                            <p className="text-sm text-muted-foreground truncate">
                              {task.ai_instruction}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {getPriorityIndicator(task.priority)}
                            {getTaskStatusBadge(task.status)}
                            {isWaiting && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2.5 text-xs gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetch(`/api/ai-autonomy/tasks/${task.id}/approve`, {
                                    method: "PATCH",
                                    headers: getAuthHeaders(),
                                  }).then(res => {
                                    if (res.ok) {
                                      toast({ title: "Task approvato", description: "Il task verrà eseguito al prossimo ciclo" });
                                      queryClient.invalidateQueries({ queryKey: [tasksUrl] });
                                      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/tasks-stats"] });
                                      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/active-tasks"] });
                                    } else {
                                      toast({ title: "Errore", description: "Impossibile approvare il task", variant: "destructive" });
                                    }
                                  });
                                }}
                              >
                                <ThumbsUp className="h-3 w-3" />
                                Approva
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground"
                              onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        </React.Fragment>
                      );
                    }

                    return (
                      <React.Fragment key={task.id}>
                      <Card
                        className={cn(
                          "transition-all duration-200 border rounded-xl border-l-4 overflow-hidden",
                          isWaiting ? "bg-muted/20 dark:bg-muted/5" : "bg-card",
                          getPriorityBorderColor(task.priority),
                          mergeMode && isMergeSelected && "ring-2 ring-purple-400 bg-purple-50/30 dark:bg-purple-950/20"
                        )}
                      >
                        <CardContent className="p-0">
                          <div
                            className="px-4 pt-4 pb-3 cursor-pointer flex gap-3"
                            onClick={(e) => {
                              if (mergeMode) {
                                e.stopPropagation();
                                toggleMergeSelect(task.id);
                              } else {
                                toggleTaskExpand(task.id, e);
                              }
                            }}
                          >
                            {mergeMode && (
                              <div className="pt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={isMergeSelected}
                                  onCheckedChange={() => toggleMergeSelect(task.id)}
                                  className="h-5 w-5 border-2"
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    {task.contact_name && (
                                      <span className="inline-flex items-center gap-1.5 text-base font-bold text-foreground">
                                        <User className="h-4 w-4 text-muted-foreground/70" />
                                        {task.ai_role === 'marco' && <span className="text-xs font-normal text-muted-foreground mr-0.5">Riguarda:</span>}
                                        {task.contact_name}
                                      </span>
                                    )}
                                    {task.ai_role !== 'marco' && task.contact_phone && (
                                      <span className="text-[11px] text-muted-foreground/70 font-mono">
                                        {task.contact_phone}
                                      </span>
                                    )}
                                  </div>
                                  <p className={cn(
                                    "text-sm text-foreground/80 leading-relaxed transition-all duration-200",
                                    !isExpanded && "line-clamp-2"
                                  )}>
                                    {task.ai_instruction}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {getTaskStatusBadge(task.status)}
                                  {getPriorityIndicator(task.priority)}
                                </div>
                              </div>

                              {isExpanded && task.additional_context && (
                                <div className="mt-2.5 text-xs bg-muted/40 dark:bg-muted/20 rounded-lg px-3 py-2 border border-border/40">
                                  <span className="font-medium text-muted-foreground flex items-center gap-1 mb-0.5">
                                    <Info className="h-3 w-3" />
                                    Contesto aggiuntivo
                                  </span>
                                  <span className="text-foreground/70">{task.additional_context}</span>
                                </div>
                              )}

                              {subTaskMap.has(task.id) && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); toggleTaskExpand(task.id, e); }}
                                >
                                  <Layers className="h-3 w-3" />
                                  <span>{subTaskMap.get(task.id)!.length} follow-up</span>
                                  <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
                                </div>
                              )}

                              {task.origin_type === 'autonomous' && task.ai_reasoning && (
                                <details className="mt-2.5" open={isExpanded}>
                                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground/70 flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 text-purple-400" />
                                    Insight AI
                                  </summary>
                                  <p className={cn(
                                    "mt-1 text-xs text-muted-foreground/80 italic pl-4",
                                    !isExpanded && "line-clamp-2"
                                  )}>
                                    {task.ai_reasoning}
                                  </p>
                                </details>
                              )}

                              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                                {plannedActions.map((action, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/30"
                                  >
                                    {action.icon}
                                    {action.label}
                                  </span>
                                ))}
                                {task.origin_type === 'autonomous' && (
                                  <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/30">
                                    <Sparkles className="h-2.5 w-2.5" />
                                    AI
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/30">
                                  {getCategoryBadge(task.task_category)}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground/70">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-2.5 w-2.5" />
                                  {getRelativeTime(task.created_at)}
                                </span>
                                {task.scheduled_at && ['scheduled', 'waiting_approval', 'approved', 'draft', 'paused'].includes(task.status) && (
                                  <span className="flex items-center gap-1 text-primary/80 font-medium" title={task.scheduling_reason || undefined}>
                                    <CalendarClock className="h-2.5 w-2.5" />
                                    {new Date(task.scheduled_at).toLocaleString("it-IT", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                                {task.completed_at && (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle className="h-2.5 w-2.5 text-emerald-500" />
                                    {new Date(task.completed_at).toLocaleString("it-IT", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {(isWaiting || isActionable) && (
                            <div className="px-4 py-2 border-t border-border/30 bg-muted/10 flex items-center gap-2">
                              {isWaiting && (
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 h-7 px-3 text-xs font-medium"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    fetch(`/api/ai-autonomy/tasks/${task.id}/approve`, {
                                      method: "PATCH",
                                      headers: getAuthHeaders(),
                                    }).then(res => {
                                      if (res.ok) {
                                        toast({ title: "Task approvato", description: "Il task verrà eseguito al prossimo ciclo" });
                                        queryClient.invalidateQueries({ queryKey: [tasksUrl] });
                                        queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/tasks-stats"] });
                                        queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/active-tasks"] });
                                      } else {
                                        toast({ title: "Errore", description: "Impossibile approvare il task", variant: "destructive" });
                                      }
                                    });
                                  }}
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                  Approva
                                </Button>
                              )}
                              {canPostpone && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 h-7 px-2.5 text-xs border-border/50 text-muted-foreground hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPostponeTask(task);
                                  }}
                                >
                                  <Clock className="h-3 w-3" />
                                  Rimanda
                                </Button>
                              )}
                              {isCancellable && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 h-7 px-2.5 text-xs border-red-200/50 text-red-500 hover:bg-red-50/50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-950/20"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCancelDialogTask(task);
                                  }}
                                >
                                  <Ban className="h-3 w-3" />
                                  Rifiuta
                                </Button>
                              )}

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {isWaiting && (
                                    <>
                                      <DropdownMenuItem onClick={() => {
                                        setEditInstruction(task.ai_instruction || "");
                                        setEditContext(task.additional_context || "");
                                        setEditTask(task);
                                      }}>
                                        <Pencil className="h-3.5 w-3.5 mr-2" />
                                        Modifica testo
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        const currentScheduled = task.scheduled_at ? new Date(task.scheduled_at) : new Date();
                                        const localIso = new Date(currentScheduled.getTime() - currentScheduled.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                        setRescheduleDate(localIso);
                                        setRescheduleTask(task);
                                      }}>
                                        <CalendarClock className="h-3.5 w-3.5 mr-2" />
                                        Modifica orario
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {isActionable && (
                                    <DropdownMenuItem onClick={() => handleMarkDone(task.id)}>
                                      <UserCheck className="h-3.5 w-3.5 mr-2" />
                                      Già fatta da me
                                    </DropdownMenuItem>
                                  )}
                                  {canRequestReport && task.ai_role && onOpenChatWithTask && (
                                    <DropdownMenuItem onClick={() => handleOpenChatAboutTask(task, 'Cosa hai fatto?')}>
                                      <MessageSquare className="h-3.5 w-3.5 mr-2" />
                                      Cosa hai fatto?
                                    </DropdownMenuItem>
                                  )}
                                  {task.ai_role && onOpenChatWithTask && !canRequestReport && (
                                    <DropdownMenuItem onClick={() => handleOpenChatAboutTask(task)}>
                                      <MessageSquare className="h-3.5 w-3.5 mr-2" />
                                      Parlane in chat
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => setSelectedTaskId(task.id)}>
                                    <Eye className="h-3.5 w-3.5 mr-2" />
                                    Dettagli
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}

                          {!isWaiting && !isActionable && (
                            <div className="px-4 py-2 border-t border-border/20 bg-muted/5 flex items-center gap-2">
                              {canRequestReport && task.ai_role && onOpenChatWithTask && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 h-7 px-2.5 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50/50 dark:text-violet-400 dark:hover:bg-violet-950/20"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenChatAboutTask(task, 'Cosa hai fatto?');
                                  }}
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  Cosa hai fatto?
                                </Button>
                              )}
                              {task.ai_role && onOpenChatWithTask && !canRequestReport && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenChatAboutTask(task);
                                  }}
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  Parlane in chat
                                </Button>
                              )}
                              <div className="ml-auto">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 h-7 px-2.5 text-xs text-muted-foreground hover:text-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTaskId(task.id);
                                  }}
                                >
                                  <Eye className="h-3 w-3" />
                                  Dettagli
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      {isExpanded && subTaskMap.has(task.id) && (
                        <div className="ml-6 pl-4 border-l-2 border-purple-200/60 dark:border-purple-800/40 space-y-2">
                          {subTaskMap.get(task.id)!.map((subTask) => {
                            const subExpanded = expandedTaskIds.has(subTask.id);
                            const subPlannedActions = detectPlannedActions(subTask);
                            return (
                              <div
                                key={subTask.id}
                                className="rounded-lg bg-muted/20 border border-border/20 overflow-hidden cursor-pointer hover:bg-muted/30 transition-colors"
                                onClick={(e) => toggleTaskExpand(subTask.id, e)}
                              >
                                <div className="flex items-start gap-2 px-3 py-2.5">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                      {subTask.contact_name && (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground/80">
                                          <User className="h-3 w-3 text-muted-foreground/60" />
                                          {subTask.contact_name}
                                        </span>
                                      )}
                                      {getTaskStatusBadge(subTask.status)}
                                      {subTask.priority <= 2 && getPriorityIndicator(subTask.priority)}
                                    </div>
                                    <p className={cn(
                                      "text-xs text-muted-foreground leading-relaxed",
                                      !subExpanded && "line-clamp-1"
                                    )}>
                                      {subTask.ai_instruction}
                                    </p>

                                    {subExpanded && (
                                      <>
                                        {subTask.additional_context && (
                                          <div className="mt-2 text-[11px] bg-muted/40 rounded px-2.5 py-1.5 border border-border/30">
                                            <span className="font-medium text-muted-foreground flex items-center gap-1 mb-0.5">
                                              <Info className="h-2.5 w-2.5" />
                                              Contesto
                                            </span>
                                            <span className="text-foreground/70">{subTask.additional_context}</span>
                                          </div>
                                        )}

                                        {subTask.origin_type === 'autonomous' && subTask.ai_reasoning && (
                                          <div className="mt-2 text-[11px] text-muted-foreground/70 italic bg-purple-50/30 dark:bg-purple-950/10 rounded px-2.5 py-1.5 border border-purple-200/30 dark:border-purple-800/20">
                                            <Sparkles className="h-2.5 w-2.5 inline mr-1 text-purple-400" />
                                            {subTask.ai_reasoning}
                                          </div>
                                        )}

                                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                          {subPlannedActions.map((action, idx) => (
                                            <span key={idx} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/30">
                                              {action.icon}
                                              {action.label}
                                            </span>
                                          ))}
                                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/30">
                                            {getCategoryBadge(subTask.task_category)}
                                          </span>
                                        </div>

                                        {subTask.result_summary && (
                                          <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10 rounded px-2.5 py-1.5 border border-emerald-200/30 dark:border-emerald-800/20">
                                            <CheckCircle className="h-2.5 w-2.5 inline mr-1" />
                                            {subTask.result_summary}
                                          </div>
                                        )}

                                        {subTask.scheduled_at && (
                                          <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-primary/80 font-medium">
                                            <CalendarClock className="h-2.5 w-2.5" />
                                            {new Date(subTask.scheduled_at).toLocaleString("it-IT", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground/60">
                                    <span>{getRelativeTime(subTask.created_at)}</span>
                                    <ChevronRight className={cn("h-3 w-3 transition-transform", subExpanded && "rotate-90")} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {recentCompletedTasks.length > 0 && dashboardStatusFilter === 'all' && (
        <div className="mt-4">
          <div className="flex items-center gap-2 px-2 py-2 mb-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Completati di recente ({recentCompletedTasks.length})
            </span>
          </div>
          <div className="space-y-2">
            {recentCompletedTasks.map((task) => (
              <Card key={task.id} className="border-l-4 border-l-emerald-400 border rounded-lg shadow-sm overflow-hidden opacity-80 hover:opacity-100 transition-opacity bg-muted/20 border-border/40 cursor-pointer" onClick={() => setSelectedTaskId(task.id)}>
                <CardContent className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {task.ai_role && (
                          <Badge variant="outline" className={cn("text-[10px] py-0 px-1.5", getRoleBadge(task.ai_role))}>
                            {task.ai_role.charAt(0).toUpperCase() + task.ai_role.slice(1)}
                          </Badge>
                        )}
                        {task.contact_name && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                            <User className="h-3 w-3" />
                            {task.contact_name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1">
                        {task.ai_instruction}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                        {task.completed_at && (
                          <span className="flex items-center gap-0.5">
                            <CheckCircle className="h-2.5 w-2.5 text-emerald-500" />
                            {new Date(task.completed_at).toLocaleString("it-IT", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        <span>{getRelativeTime(task.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {task.ai_role && onOpenChatWithTask && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 h-7 px-2 text-[10px] text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/30"
                          onClick={(e) => { e.stopPropagation(); handleOpenChatAboutTask(task, 'Cosa hai fatto?'); }}
                        >
                          <MessageSquare className="h-3 w-3" />
                          Cosa hai fatto?
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 h-7 px-2 text-[10px] text-muted-foreground"
                        onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); }}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {olderCompletedTasks.length > 0 && dashboardStatusFilter === 'all' && (
        <div className="mt-4">
          <button
            onClick={() => setShowCompletedSection(!showCompletedSection)}
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium text-muted-foreground">
              Completati ({olderCompletedTasks.length})
            </span>
            <ChevronRight className={cn("h-4 w-4 text-muted-foreground ml-auto transition-transform", showCompletedSection && "rotate-90")} />
          </button>
          {showCompletedSection && (
            <div className="mt-2 space-y-2 pl-2">
              {olderCompletedTasks.map((task) => (
                <Card key={task.id} className="border rounded-lg shadow-sm overflow-hidden opacity-70 hover:opacity-100 transition-opacity bg-muted/20 border-border/40">
                  <CardContent className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={(e) => toggleTaskExpand(task.id, e)}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {task.contact_name && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                              <User className="h-3 w-3" />
                              {task.contact_name}
                            </span>
                          )}
                          {task.ai_role && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground">
                              {task.ai_role.charAt(0).toUpperCase() + task.ai_role.slice(1)}
                            </Badge>
                          )}
                          <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 text-[10px] py-0 px-1.5">
                            <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                            Completato
                          </Badge>
                        </div>
                        <p className={cn("text-xs text-muted-foreground leading-relaxed", !expandedTaskIds.has(task.id) && "line-clamp-1")}>
                          {task.ai_instruction}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                          {task.completed_at && (
                            <span className="flex items-center gap-0.5">
                              <CheckCircle className="h-2.5 w-2.5 text-emerald-500" />
                              {new Date(task.completed_at).toLocaleString("it-IT", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          <span>{getRelativeTime(task.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {task.ai_role && onOpenChatWithTask && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 h-7 px-2 text-[10px] text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/30"
                            onClick={(e) => { e.stopPropagation(); handleOpenChatAboutTask(task, 'Cosa hai fatto?'); }}
                          >
                            <MessageSquare className="h-3 w-3" />
                            Cosa hai fatto?
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 h-7 px-2 text-[10px] text-muted-foreground"
                          onClick={(e) => { e.stopPropagation(); setSelectedTaskId(task.id); }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
          {loadingTaskDetail ? (
            <div className="flex items-center justify-center py-20">
              <DialogHeader className="sr-only"><DialogTitle>Caricamento task</DialogTitle><DialogDescription>Caricamento dettagli task in corso</DialogDescription></DialogHeader>
              <div className="text-center space-y-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Caricamento...</p>
              </div>
            </div>
          ) : taskDetailData?.task ? (() => {
            const task = taskDetailData.task;
            const formatTime = (d: string) => new Date(d).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
            const sortedActivity = taskDetailData.activity
              ? [...taskDetailData.activity].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              : [];
            const hasResults = task.result_data && task.result_data.results;
            const isFinished = task.status === 'completed' || task.status === 'failed';

            const executionDuration = (() => {
              if (task.status === 'in_progress') return "In corso...";
              if (task.completed_at && task.created_at) {
                const start = new Date(task.created_at).getTime();
                const end = new Date(task.completed_at).getTime();
                const diffMs = end - start;
                const diffSec = Math.floor(diffMs / 1000);
                if (diffSec < 60) return `${diffSec}s`;
                const diffMin = Math.floor(diffSec / 60);
                const remainSec = diffSec % 60;
                if (diffMin < 60) return `${diffMin}m ${remainSec}s`;
                const diffHrs = Math.floor(diffMin / 60);
                const remainMin = diffMin % 60;
                return `${diffHrs}h ${remainMin}m`;
              }
              return null;
            })();

            const progressPercent = task.execution_plan && task.execution_plan.length > 0
              ? Math.max(5, (task.execution_plan.filter(s => s.status === 'completed').length / task.execution_plan.length) * 100)
              : 30;

            return (
              <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
                <DialogHeader className="sr-only">
                  <DialogTitle>Deep Research</DialogTitle>
                  <DialogDescription>Dettaglio task e risultati deep research</DialogDescription>
                </DialogHeader>

                <div className="rounded-xl border border-border shadow-sm bg-card p-6 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-bold text-foreground mb-2">Deep Research</h2>
                      <p className="text-sm text-muted-foreground leading-[1.8]">
                        {task.ai_instruction}
                      </p>
                    </div>
                    {['scheduled', 'draft', 'waiting_approval', 'paused'].includes(task.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
                        onClick={() => setCancelDialogTask(task)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Cancella Task
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                      task.status === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400" :
                      task.status === 'failed' ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400" :
                      task.status === 'in_progress' ? "bg-primary/10 text-primary border-primary/20" :
                      task.status === 'paused' ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400" :
                      task.status === 'waiting_approval' ? "bg-primary/10 text-primary border-primary/20" :
                      "bg-muted text-muted-foreground border-border"
                    )}>
                      {task.status === 'completed' ? '✅ Completato' :
                       task.status === 'failed' ? '❌ Fallito' :
                       task.status === 'in_progress' ? '⚡ In esecuzione' :
                       task.status === 'paused' ? '⏸️ In pausa' :
                       task.status === 'deferred' ? '🔄 Rimandato' :
                       task.status === 'scheduled' ? '📅 Programmato' :
                       task.status === 'waiting_approval' ? '⏳ In attesa di approvazione' :
                       task.status}
                    </span>
                    <Separator orientation="vertical" className="h-4" />
                    {getCategoryBadge(task.task_category)}
                    {task.contact_name && (
                      <>
                        <Separator orientation="vertical" className="h-4" />
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3 w-3" /> {task.contact_name}
                        </span>
                      </>
                    )}
                    {task.ai_role && (
                      <>
                        <Separator orientation="vertical" className="h-4" />
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0.5", getRoleBadge(task.ai_role))}>
                          {task.ai_role.charAt(0).toUpperCase() + task.ai_role.slice(1)}
                        </Badge>
                      </>
                    )}
                    {executionDuration && (
                      <>
                        <Separator orientation="vertical" className="h-4" />
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Timer className="h-3 w-3" /> {executionDuration}
                        </span>
                      </>
                    )}
                    {task.ai_confidence != null && (
                      <>
                        <Separator orientation="vertical" className="h-4" />
                        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <Target className="h-3 w-3" />
                          <span>{Math.round(task.ai_confidence * 100)}%</span>
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                task.ai_confidence >= 0.8 ? "bg-emerald-500" :
                                task.ai_confidence >= 0.5 ? "bg-amber-500" :
                                "bg-red-500"
                              )}
                              style={{ width: `${Math.round(task.ai_confidence * 100)}%` }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                    {task.status === 'completed' && task.completed_at && (
                      <>
                        <Separator orientation="vertical" className="h-4" />
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle className="h-3 w-3" />
                          {new Date(task.completed_at).toLocaleString("it-IT", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </>
                    )}
                  </div>

                  {task.status === 'in_progress' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 text-primary animate-spin" />
                        <p className="text-xs text-primary font-medium">
                          {task.result_summary || "Alessia sta lavorando..."}
                        </p>
                      </div>
                      <div className="h-1 bg-primary/10 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full animate-pulse" style={{
                          width: `${progressPercent}%`,
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  )}
                </div>

                {(task.ai_reasoning || (task.execution_plan && task.execution_plan.length > 0) || sortedActivity.length > 0) && (
                  <div className="rounded-xl border border-border shadow-sm bg-card p-5 space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Cog className="h-5 w-5 text-muted-foreground" />
                      Processo AI
                    </h3>

                    {task.ai_reasoning && (
                      <details className="group">
                        <summary className="cursor-pointer select-none flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-muted/50 transition-colors">
                          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          <span className="text-[15px] font-medium text-purple-700 dark:text-purple-300">Ragionamento AI</span>
                        </summary>
                        <div className="mt-2 ml-6 rounded-xl border border-purple-200 dark:border-purple-800/50 bg-purple-50/50 dark:bg-purple-950/20 p-4">
                          <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed whitespace-pre-wrap">
                            {task.ai_reasoning}
                          </p>
                        </div>
                      </details>
                    )}

                    {task.execution_plan && task.execution_plan.length > 0 && (
                      <details className="group">
                        <summary className="cursor-pointer select-none flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-muted/50 transition-colors">
                          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                          <ListTodo className="h-4 w-4 text-primary" />
                          <span className="text-[15px] font-medium">Piano di Esecuzione</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({task.execution_plan.filter(s => s.status === 'completed').length}/{task.execution_plan.length})
                          </span>
                        </summary>
                        <div className="mt-3 ml-6">
                          <div className="flex flex-wrap items-start gap-0">
                            {task.execution_plan.map((step, idx) => {
                              const isActive = step.status === 'in_progress';
                              const isCompleted = step.status === 'completed';
                              const isFailed = step.status === 'failed';
                              const isSkipped = step.status === 'skipped';
                              const isLast = idx === task.execution_plan!.length - 1;

                              return (
                                <div key={step.step} className="flex items-start">
                                  <div className="flex flex-col items-center" style={{ minWidth: '80px' }}>
                                    <div className={cn(
                                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2",
                                      isCompleted ? "bg-emerald-500 border-emerald-500 text-white shadow-sm" :
                                      isActive ? "bg-primary border-primary text-white shadow-sm animate-pulse" :
                                      isFailed ? "bg-red-500 border-red-500 text-white shadow-sm" :
                                      isSkipped ? "bg-muted border-muted-foreground/30 text-muted-foreground" :
                                      "bg-background border-border text-muted-foreground"
                                    )}>
                                      {isCompleted ? <CheckCircle className="h-4 w-4" /> :
                                       isActive ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                       isFailed ? <XCircle className="h-4 w-4" /> :
                                       isSkipped ? <Minus className="h-4 w-4" /> :
                                       step.step}
                                    </div>
                                    <p className={cn(
                                      "text-[10px] mt-1.5 text-center leading-tight max-w-[80px]",
                                      isActive ? "text-primary font-medium" :
                                      isCompleted ? "text-emerald-700 dark:text-emerald-400" :
                                      isFailed ? "text-red-600 dark:text-red-400" :
                                      "text-muted-foreground"
                                    )}>
                                      {getStepActionLabel(step.action).replace(/^[^\s]+\s/, '')}
                                    </p>
                                  </div>
                                  {!isLast && (
                                    <div className={cn(
                                      "h-[2px] mt-4 w-6 shrink-0",
                                      isCompleted ? "bg-emerald-500" : "bg-border"
                                    )} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </details>
                    )}

                    {sortedActivity.length > 0 && (
                      <details className="group">
                        <summary className="cursor-pointer select-none flex items-center gap-2 py-2 px-3 rounded-xl hover:bg-muted/50 transition-colors">
                          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          <span className="text-[15px] font-medium">Registro Attività</span>
                          <span className="text-xs text-muted-foreground ml-1">({sortedActivity.length})</span>
                        </summary>
                        <div className="mt-3 ml-6 space-y-1.5">
                          {(showAllActivity ? sortedActivity : sortedActivity.slice(0, 3)).map((act) => (
                            <div key={act.id} className="flex items-start gap-3 px-3 py-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                              <div className={cn(
                                "mt-0.5 p-1 rounded-full shrink-0",
                                act.severity === "error" ? "bg-red-50 text-red-500 dark:bg-red-950/30" :
                                act.severity === "warning" ? "bg-amber-50 text-amber-500 dark:bg-amber-950/30" :
                                act.severity === "success" ? "bg-emerald-50 text-emerald-500 dark:bg-emerald-950/30" :
                                "bg-primary/10 text-primary"
                              )}>
                                {getActivityIcon(act.icon)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{act.title}</p>
                                <p className="text-xs text-muted-foreground">{act.description}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap mt-0.5">
                                {formatTime(act.created_at)}
                              </span>
                            </div>
                          ))}
                          {sortedActivity.length > 3 && !showAllActivity && (
                            <button
                              onClick={() => setShowAllActivity(true)}
                              className="w-full text-center py-2 text-xs text-primary hover:text-primary/80 font-medium"
                            >
                              Mostra tutto ({sortedActivity.length})
                            </button>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                )}

                <div className="rounded-xl border border-border shadow-sm bg-card p-6">
                  {task.result_summary && task.status !== 'in_progress' && (
                    <div className="mb-6 rounded-xl bg-muted/40 border border-border p-5">
                      <p className="text-sm font-semibold text-foreground mb-2">Riepilogo</p>
                      <p className="text-[15px] text-muted-foreground leading-[1.8]">{task.result_summary}</p>
                    </div>
                  )}

                  {hasResults ? (
                    <DeepResearchResults results={task.result_data.results} />
                  ) : (
                    <div className="text-center py-10">
                      <div className="p-3 rounded-full bg-muted/50 w-fit mx-auto mb-3">
                        {task.status === 'in_progress' ? (
                          <Brain className="h-8 w-8 text-primary animate-pulse" />
                        ) : task.status === 'scheduled' ? (
                          <Clock className="h-8 w-8 text-muted-foreground" />
                        ) : task.status === 'failed' ? (
                          <AlertCircle className="h-8 w-8 text-red-500" />
                        ) : (
                          <Info className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <p className="text-[15px] font-medium text-foreground">
                        {task.status === 'in_progress' ? "Analisi in corso..." :
                         task.status === 'scheduled' ? "Analisi programmata" :
                         task.status === 'failed' ? "Analisi non completata" :
                         "Nessun risultato disponibile"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {task.status === 'in_progress' ? "I risultati appariranno qui al termine dell'elaborazione" :
                         task.status === 'scheduled' ? "L'analisi verrà eseguita all'orario programmato" :
                         task.status === 'failed' ? "Puoi riprovare l'esecuzione con il pulsante in basso" :
                         ""}
                      </p>
                    </div>
                  )}
                </div>

                {taskDetailData.follow_ups && taskDetailData.follow_ups.length > 0 && (
                  <div className="rounded-xl border border-border shadow-sm bg-card p-5 space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <GitBranch className="h-5 w-5 text-violet-500" />
                      Follow-up collegati
                      <Badge variant="outline" className="text-xs ml-1">{taskDetailData.follow_ups.length}</Badge>
                    </h3>
                    <div className="space-y-2">
                      {taskDetailData.follow_ups.map((fu) => (
                        <div key={fu.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                          <div className={cn(
                            "mt-0.5 p-1 rounded-full shrink-0",
                            fu.status === 'completed' ? "bg-emerald-50 text-emerald-500 dark:bg-emerald-950/30" :
                            fu.status === 'failed' ? "bg-red-50 text-red-500 dark:bg-red-950/30" :
                            fu.status === 'in_progress' ? "bg-primary/10 text-primary" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {fu.status === 'completed' ? <CheckCircle className="h-3.5 w-3.5" /> :
                             fu.status === 'failed' ? <XCircle className="h-3.5 w-3.5" /> :
                             fu.status === 'in_progress' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
                             <Clock className="h-3.5 w-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              {fu.contact_name && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                                  <User className="h-3 w-3" />
                                  {fu.contact_name}
                                </span>
                              )}
                              {fu.ai_role && (
                                <Badge variant="outline" className={cn("text-[10px] py-0 px-1.5", getRoleBadge(fu.ai_role))}>
                                  {fu.ai_role.charAt(0).toUpperCase() + fu.ai_role.slice(1)}
                                </Badge>
                              )}
                              <span className={cn(
                                "text-[10px] px-1.5 py-0 rounded-full border",
                                fu.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400" :
                                fu.status === 'failed' ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400" :
                                fu.status === 'in_progress' ? "bg-primary/10 text-primary border-primary/20" :
                                "bg-muted text-muted-foreground border-border"
                              )}>
                                {fu.status === 'completed' ? 'Completato' :
                                 fu.status === 'failed' ? 'Fallito' :
                                 fu.status === 'in_progress' ? 'In esecuzione' :
                                 fu.status === 'waiting_approval' ? 'Da approvare' :
                                 fu.status === 'scheduled' ? 'Programmato' :
                                 fu.status}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">{fu.ai_instruction}</p>
                            {fu.result_summary && (
                              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 leading-relaxed">
                                → {fu.result_summary}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap mt-0.5">
                            {new Date(fu.created_at).toLocaleDateString("it-IT", { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border shadow-sm bg-card p-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    {task.status === 'waiting_approval' && (
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => {
                          fetch(`/api/ai-autonomy/tasks/${task.id}/approve`, {
                            method: "PATCH",
                            headers: getAuthHeaders(),
                          }).then(res => {
                            if (res.ok) {
                              toast({ title: "Task approvato", description: "Il task verrà eseguito al prossimo ciclo" });
                              queryClient.invalidateQueries({ queryKey: [`/api/ai-autonomy/tasks/${selectedTaskId}`] });
                              queryClient.invalidateQueries({ queryKey: [tasksUrl] });
                              queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/tasks-stats"] });
                              queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/active-tasks"] });
                            } else {
                              toast({ title: "Errore", description: "Impossibile approvare il task", variant: "destructive" });
                            }
                          });
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1.5" />
                        Approva Task
                      </Button>
                    )}
                    {['scheduled', 'draft', 'waiting_approval', 'paused', 'approved'].includes(task.status) && (
                      <Button
                        variant="outline"
                        className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        onClick={() => handleMarkDone(task.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1.5" />
                        Già fatta
                      </Button>
                    )}
                    {(task.status === 'paused' || task.status === 'scheduled') && (
                      <Button
                        onClick={() => onExecuteTask(task.id)}
                      >
                        <Play className="h-4 w-4 mr-1.5" />
                        Esegui ora
                      </Button>
                    )}
                    {task.status === 'failed' && (
                      <Button
                        onClick={() => onExecuteTask(task.id)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <RefreshCw className="h-4 w-4 mr-1.5" />
                        Riprova
                      </Button>
                    )}
                    {task.status === 'completed' && (
                      <Button
                        onClick={() => onExecuteTask(task.id)}
                        variant="outline"
                      >
                        <RefreshCw className="h-4 w-4 mr-1.5" />
                        Rigenera Analisi
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => generateTaskPDF(task)}
                    >
                      <Save className="h-4 w-4 mr-1.5" />
                      Scarica PDF
                    </Button>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="py-12 text-center text-muted-foreground">
              <DialogHeader className="sr-only"><DialogTitle>Task non trovato</DialogTitle><DialogDescription>Il task richiesto non esiste</DialogDescription></DialogHeader>
              Task non trovato
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card className="border border-border rounded-xl shadow-sm border-l-4 border-l-red-400">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Database className="h-5 w-5 text-red-500" />
            Gestione Dati AI
          </CardTitle>
          <CardDescription>
            Visualizza e gestisci i task bloccati e lo storico. Puoi eliminare singoli record o fare un reset completo per ricominciare da zero.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={gestioneTab} onValueChange={setGestioneTab}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="blocks" className="gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Blocchi ({blocksData.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Storico Task ({tasksData?.total || 0})
                </TabsTrigger>
              </TabsList>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1.5" disabled={resettingAll}>
                    {resettingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Reset Totale
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="h-5 w-5" />
                      Reset Totale — Sei sicuro?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>Questa azione eliminerà <strong>permanentemente</strong>:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Tutti i task AI (attivi, completati, falliti, cancellati)</li>
                        <li>Tutti i blocchi / task rifiutati</li>
                        <li>Tutto il log delle attività AI</li>
                      </ul>
                      <p className="font-semibold text-red-600">Non è possibile annullare questa operazione.</p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetAll}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Sì, elimina tutto
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <TabsContent value="blocks" className="space-y-3">
              {blocksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : blocksData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nessun blocco attivo</p>
                  <p className="text-xs mt-1">Quando rifiuti un task, il blocco appare qui</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{blocksData.length} blocchi attivi</p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 text-red-600 hover:text-red-700" disabled={bulkDeleting}>
                          {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Svuota tutti
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminare tutti i blocchi?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Verranno rimossi tutti i {blocksData.length} blocchi. L'AI potrà proporre nuovamente task per questi clienti/categorie.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={handleBulkDeleteBlocks} className="bg-red-600 hover:bg-red-700">
                            Elimina tutti
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {blocksData.map((block) => (
                      <div key={block.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{block.contact_display_name || block.contact_name || "Contatto sconosciuto"}</span>
                            {block.ai_role && (
                              <Badge variant="outline" className={cn("text-xs", getRoleBadge(block.ai_role))}>
                                {block.ai_role.charAt(0).toUpperCase() + block.ai_role.slice(1)}
                              </Badge>
                            )}
                            {block.task_category && getCategoryBadge(block.task_category)}
                          </div>
                          {block.reason && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{block.reason}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {block.blocked_at ? new Date(block.blocked_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBlock(block.id)}
                          disabled={deletingBlockId === block.id}
                          className="shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                          {deletingBlockId === block.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-3">
              {loadingTasks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !tasksData?.tasks || tasksData.tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nessun task nello storico</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {tasksData.tasks.map((task) => {
                    const isExpanded = expandedHistoryIds.has(task.id);
                    return (
                      <div key={task.id} className="rounded-xl border border-border bg-card hover:bg-accent/30 transition-colors overflow-hidden">
                        <div
                          className="flex gap-3 p-3 cursor-pointer"
                          onClick={() => toggleHistoryExpand(task.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {getTaskStatusBadge(task.status)}
                              {task.contact_name && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {task.contact_name}
                                </span>
                              )}
                              {task.ai_role && (
                                <Badge variant="outline" className={cn("text-[10px]", getRoleBadge(task.ai_role))}>
                                  {task.ai_role.charAt(0).toUpperCase() + task.ai_role.slice(1)}
                                </Badge>
                              )}
                              {task.task_category && getCategoryBadge(task.task_category)}
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                {task.created_at ? new Date(task.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                              </span>
                            </div>
                            <p className={cn("text-sm text-foreground/80 leading-relaxed", !isExpanded && "line-clamp-2")}>
                              {task.ai_instruction}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 self-start mt-1">
                            <ChevronUp className={cn("h-4 w-4 text-muted-foreground transition-transform", !isExpanded && "rotate-180")} />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); setActionDialogTask(task); }}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <Cog className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!actionDialogTask} onOpenChange={(open) => { if (!open) setActionDialogTask(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gestisci Task</DialogTitle>
            <DialogDescription>
              Scegli cosa fare con questo task: ripristinarlo in coda o eliminarlo definitivamente dal database.
            </DialogDescription>
          </DialogHeader>
          {actionDialogTask && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border p-4 space-y-3 max-h-[300px] overflow-y-auto">
                <div className="flex items-center gap-2 flex-wrap">
                  {getTaskStatusBadge(actionDialogTask.status)}
                  {actionDialogTask.contact_name && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {actionDialogTask.contact_name}
                    </span>
                  )}
                  {actionDialogTask.ai_role && (
                    <Badge variant="outline" className={cn("text-xs", getRoleBadge(actionDialogTask.ai_role))}>
                      {actionDialogTask.ai_role.charAt(0).toUpperCase() + actionDialogTask.ai_role.slice(1)}
                    </Badge>
                  )}
                  {actionDialogTask.task_category && getCategoryBadge(actionDialogTask.task_category)}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {actionDialogTask.ai_instruction}
                </p>
                {actionDialogTask.created_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Creato: {new Date(actionDialogTask.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => handleRestoreTask(actionDialogTask.id)}
                  disabled={restoringTaskId === actionDialogTask.id || deletingTaskId === actionDialogTask.id}
                >
                  {restoringTaskId === actionDialogTask.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <RotateCcw className="h-4 w-4" />}
                  Ripristina in Coda
                </Button>
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={async () => {
                    await handleDeleteTask(actionDialogTask.id);
                    setActionDialogTask(null);
                  }}
                  disabled={deletingTaskId === actionDialogTask.id || restoringTaskId === actionDialogTask.id}
                >
                  {deletingTaskId === actionDialogTask.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                  Elimina Definitivamente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelDialogTask} onOpenChange={(open) => { if (!open) { setCancelDialogTask(null); setIsBlockCancel(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancella Task</DialogTitle>
            <DialogDescription>
              Scegli se cancellare semplicemente il task o se bloccarlo permanentemente.
            </DialogDescription>
          </DialogHeader>
          {cancelDialogTask && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border p-3 space-y-2">
                {cancelDialogTask.contact_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{cancelDialogTask.contact_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {getCategoryBadge(cancelDialogTask.task_category)}
                  {cancelDialogTask.ai_role && (
                    <Badge variant="outline" className="text-xs">
                      {cancelDialogTask.ai_role.charAt(0).toUpperCase() + cancelDialogTask.ai_role.slice(1)}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {cancelDialogTask.ai_instruction}
                </p>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/20 rounded-xl px-3 py-2 border border-amber-200 dark:border-amber-800/40">
                <Info className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <span>Il blocco permanente impedirà all'AI di proporre task simili per questo cliente in futuro.</span>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleCancelTask(cancelDialogTask.id, false)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Solo Cancella
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => handleCancelTask(cancelDialogTask.id, true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Cancella e Blocca Permanentemente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rescheduleTask} onOpenChange={(open) => { if (!open) setRescheduleTask(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-500" />
              Modifica orario esecuzione
            </DialogTitle>
            <DialogDescription>
              Scegli quando vuoi che questo task venga eseguito. Il task verrà approvato automaticamente.
            </DialogDescription>
          </DialogHeader>
          {rescheduleTask && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border p-3 space-y-1.5">
                <p className="text-sm font-medium line-clamp-2">{rescheduleTask.ai_instruction}</p>
                {rescheduleTask.scheduling_reason && (
                  <p className="text-xs text-purple-600 dark:text-purple-400 italic flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Motivo AI: {rescheduleTask.scheduling_reason}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reschedule-date">Data e ora</Label>
                <Input
                  id="reschedule-date"
                  type="datetime-local"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => {
                    if (!rescheduleDate || !rescheduleTask) return;
                    fetch(`/api/ai-autonomy/tasks/${rescheduleTask.id}/reschedule`, {
                      method: "PATCH",
                      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
                      body: JSON.stringify({ scheduled_at: new Date(rescheduleDate).toISOString(), approve: true }),
                    }).then(res => {
                      if (res.ok) {
                        toast({ title: "Orario aggiornato", description: "Il task è stato approvato con il nuovo orario" });
                        queryClient.invalidateQueries({ queryKey: [tasksUrl] });
                        queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/tasks-stats"] });
                        queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/active-tasks"] });
                        setRescheduleTask(null);
                      } else {
                        toast({ title: "Errore", description: "Impossibile aggiornare l'orario", variant: "destructive" });
                      }
                    });
                  }}
                >
                  <ThumbsUp className="h-4 w-4 mr-1.5" />
                  Approva con nuovo orario
                </Button>
                <Button variant="outline" onClick={() => setRescheduleTask(null)}>
                  Annulla
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!editTask} onOpenChange={(open) => { if (!open) setEditTask(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-500" />
              Modifica task
            </DialogTitle>
            <DialogDescription>
              Modifica l'istruzione e il contesto aggiuntivo prima dell'esecuzione.
            </DialogDescription>
          </DialogHeader>
          {editTask && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-instruction">Istruzione</Label>
                <Textarea
                  id="edit-instruction"
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-context" className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-amber-500" />
                  Contesto aggiuntivo
                </Label>
                <Textarea
                  id="edit-context"
                  value={editContext}
                  onChange={(e) => setEditContext(e.target.value)}
                  rows={3}
                  placeholder="Informazioni extra per l'agente..."
                  className="resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={savingEdit || !editInstruction.trim()}
                  onClick={async () => {
                    if (!editTask || !editInstruction.trim()) return;
                    setSavingEdit(true);
                    try {
                      const res = await fetch(`/api/ai-autonomy/tasks/${editTask.id}/edit`, {
                        method: "PATCH",
                        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
                        body: JSON.stringify({ ai_instruction: editInstruction.trim(), additional_context: editContext.trim() || null }),
                      });
                      if (res.ok) {
                        toast({ title: "Task aggiornato", description: "Istruzione e contesto modificati con successo" });
                        queryClient.invalidateQueries({ queryKey: [tasksUrl] });
                        setEditTask(null);
                      } else {
                        const err = await res.json().catch(() => ({}));
                        toast({ title: "Errore", description: err.error || "Impossibile modificare il task", variant: "destructive" });
                      }
                    } catch {
                      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
                    } finally {
                      setSavingEdit(false);
                    }
                  }}
                >
                  {savingEdit ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                  Salva modifiche
                </Button>
                <Button variant="outline" onClick={() => setEditTask(null)}>
                  Annulla
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!postponeTask} onOpenChange={(open) => { if (!open) { setPostponeTask(null); setPostponeNote(""); setPostponeHours("24"); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Rimanda task
            </DialogTitle>
            <DialogDescription>
              Il task verrà segnato come rimandato e riproposto automaticamente dopo il tempo scelto.
            </DialogDescription>
          </DialogHeader>
          {postponeTask && (
            <div className="space-y-4 pt-2">
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 border">
                {postponeTask.ai_instruction?.substring(0, 150)}{(postponeTask.ai_instruction?.length || 0) > 150 ? '...' : ''}
              </div>
              <div className="space-y-2">
                <Label>Quando riproporre?</Label>
                <Select value={postponeHours} onValueChange={setPostponeHours}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">Tra 4 ore</SelectItem>
                    <SelectItem value="8">Tra 8 ore</SelectItem>
                    <SelectItem value="24">Domani (24h)</SelectItem>
                    <SelectItem value="48">Tra 2 giorni</SelectItem>
                    <SelectItem value="72">Tra 3 giorni</SelectItem>
                    <SelectItem value="168">Tra una settimana</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nota (opzionale)</Label>
                <Textarea
                  value={postponeNote}
                  onChange={(e) => setPostponeNote(e.target.value)}
                  placeholder="Es: Non ho tempo oggi, vediamolo domani..."
                  rows={2}
                  className="resize-none"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={() => handlePostpone(postponeTask.id)}
                >
                  <Clock className="h-4 w-4 mr-1.5" />
                  Rimanda
                </Button>
                <Button variant="outline" onClick={() => { setPostponeTask(null); setPostponeNote(""); setPostponeHours("24"); }}>
                  Annulla
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {mergeMode && selectedMergeIds.size >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-3 bg-card border-2 border-purple-300 dark:border-purple-700 rounded-2xl shadow-2xl px-5 py-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-semibold">
                {selectedMergeIds.size} task selezionati
              </span>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <Button
              onClick={handleMergeTasks}
              disabled={isMerging}
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-md"
            >
              {isMerging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
              Aggrega selezionati
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => { setMergeMode(false); setSelectedMergeIds(new Set()); }}
            >
              Annulla
            </Button>
          </div>
        </motion.div>
      )}

    </div>
  );
}

export default DashboardTab;
