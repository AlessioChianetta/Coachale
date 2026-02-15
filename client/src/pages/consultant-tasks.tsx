import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  ListTodo,
  CheckCircle2,
  Circle,
  Clock,
  Flag,
  Search,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Plus,
  Trash2,
  User,
  Calendar,
  Tag,
  Sparkles,
  Lightbulb,
  CalendarClock,
  MessageSquareText,
  Loader2,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoleSwitch } from "@/hooks/use-role-switch";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: "Urgente", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/40" },
  high: { label: "Alta", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/40" },
  medium: { label: "Media", color: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-900/40" },
  low: { label: "Bassa", color: "text-green-700 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/40" },
};

const personalCategoryLabels: Record<string, string> = {
  business: "Business",
  marketing: "Marketing",
  operations: "Operazioni",
  learning: "Formazione",
  finance: "Finanza",
  other: "Altro",
};

const clientCategoryLabels: Record<string, string> = {
  preparation: "Preparazione",
  "follow-up": "Follow-up",
  exercise: "Esercizio",
  goal: "Obiettivo",
  reminder: "Promemoria",
};

export default function ConsultantTasks() {
  const isMobile = useIsMobile();
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("personal");

  const [personalStatusFilter, setPersonalStatusFilter] = useState("all");
  const [personalPriorityFilter, setPersonalPriorityFilter] = useState("all");
  const [personalSearch, setPersonalSearch] = useState("");

  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newCategory, setNewCategory] = useState("business");
  const [newDueDate, setNewDueDate] = useState("");

  const [clientStatusFilter, setClientStatusFilter] = useState("all");
  const [clientPriorityFilter, setClientPriorityFilter] = useState("all");
  const [clientSearch, setClientSearch] = useState("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  const [aiInput, setAiInput] = useState("");
  const [aiMode, setAiMode] = useState<"ideas" | "schedule" | "freetext">("freetext");
  const [aiGeneratedTasks, setAiGeneratedTasks] = useState<any[]>([]);
  const [showAiResults, setShowAiResults] = useState(false);

  const [isCreateClientTaskOpen, setIsCreateClientTaskOpen] = useState(false);
  const [ctClientId, setCtClientId] = useState("");
  const [ctTitle, setCtTitle] = useState("");
  const [ctDescription, setCtDescription] = useState("");
  const [ctPriority, setCtPriority] = useState("medium");
  const [ctCategory, setCtCategory] = useState("follow-up");
  const [ctDueDate, setCtDueDate] = useState("");

  const { data: personalTasks = [] } = useQuery({
    queryKey: ["/api/consultant-personal-tasks"],
    queryFn: async () => {
      const res = await fetch("/api/consultant-personal-tasks", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed");
      const result = await res.json();
      return result.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/consultant-personal-tasks", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant-personal-tasks"] });
      setNewTitle("");
      setNewPriority("medium");
      setNewCategory("business");
      setNewDueDate("");
      toast({ title: "Task creata", description: "La task è stata creata con successo" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile creare la task", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/consultant-personal-tasks/${id}/toggle`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/consultant-personal-tasks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/consultant-personal-tasks/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant-personal-tasks"] });
      toast({ title: "Eliminata", description: "Task eliminata con successo" });
    },
  });

  const { data: clientTasks = [] } = useQuery({
    queryKey: ["/api/consultation-tasks/consultant"],
    queryFn: async () => {
      const res = await fetch("/api/consultation-tasks/consultant", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed");
      const result = await res.json();
      return result.data || result || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const createClientTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/consultation-tasks", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultation-tasks/consultant"] });
      setIsCreateClientTaskOpen(false);
      setCtClientId("");
      setCtTitle("");
      setCtDescription("");
      setCtPriority("medium");
      setCtCategory("follow-up");
      setCtDueDate("");
      toast({ title: "Task creata", description: "Task cliente creata con successo" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile creare la task", variant: "destructive" });
    },
  });

  const toggleClientTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/consultation-tasks/${taskId}/complete`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/consultation-tasks/consultant"] }),
  });

  const aiGenerateMutation = useMutation({
    mutationFn: async (data: { input: string; mode: string }) => {
      const res = await fetch("/api/consultant-personal-tasks/ai-generate", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore nella generazione");
      }
      return res.json();
    },
    onSuccess: (result) => {
      const tasks = result.data || [];
      if (tasks.length === 0) {
        toast({ title: "Nessuna task generata", description: "L'AI non ha trovato attività concrete nel testo. Prova con più dettagli." });
        return;
      }
      setAiGeneratedTasks(tasks);
      setShowAiResults(true);
      toast({ title: "Task generate!", description: `L'AI ha generato ${tasks.length} task. Rivedi e conferma.` });
    },
    onError: (error: Error) => {
      toast({ title: "Errore AI", description: error.message, variant: "destructive" });
    },
  });

  const handleAiGenerate = () => {
    if (!aiInput.trim()) return;
    aiGenerateMutation.mutate({ input: aiInput.trim(), mode: aiMode });
  };

  const handleConfirmAiTask = async (task: any, index: number) => {
    try {
      const res = await fetch("/api/consultant-personal-tasks", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
      if (!res.ok) throw new Error("Failed");
      setAiGeneratedTasks(prev => prev.filter((_, i) => i !== index));
      queryClient.invalidateQueries({ queryKey: ["/api/consultant-personal-tasks"] });
      toast({ title: "Task confermata", description: `"${task.title}" aggiunta alle tue task` });
    } catch {
      toast({ title: "Errore", description: "Impossibile salvare la task", variant: "destructive" });
    }
  };

  const handleConfirmAllAiTasks = async () => {
    let created = 0;
    const failed: any[] = [];
    for (let i = 0; i < aiGeneratedTasks.length; i++) {
      try {
        const res = await fetch("/api/consultant-personal-tasks", {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(aiGeneratedTasks[i]),
        });
        if (res.ok) created++;
        else failed.push(aiGeneratedTasks[i]);
      } catch {
        failed.push(aiGeneratedTasks[i]);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/consultant-personal-tasks"] });
    if (failed.length > 0) {
      setAiGeneratedTasks(failed);
      toast({ title: "Salvate parzialmente", description: `${created} task salvate, ${failed.length} non riuscite. Riprova.`, variant: "destructive" });
    } else {
      setAiGeneratedTasks([]);
      setShowAiResults(false);
      setAiInput("");
      toast({ title: "Task salvate!", description: `${created} task aggiunte con successo` });
    }
  };

  const handleDismissAiTask = (index: number) => {
    setAiGeneratedTasks(prev => prev.filter((_, i) => i !== index));
    if (aiGeneratedTasks.length <= 1) setShowAiResults(false);
  };

  const filteredPersonalTasks = useMemo(() => {
    let result = personalTasks as any[];
    if (personalStatusFilter === "completed") result = result.filter((t: any) => t.completed);
    else if (personalStatusFilter === "pending") result = result.filter((t: any) => !t.completed);
    if (personalPriorityFilter !== "all") result = result.filter((t: any) => t.priority === personalPriorityFilter);
    if (personalSearch.trim()) {
      const q = personalSearch.toLowerCase();
      result = result.filter((t: any) => t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }
    return result;
  }, [personalTasks, personalStatusFilter, personalPriorityFilter, personalSearch]);

  const personalStats = useMemo(() => {
    const all = personalTasks as any[];
    const total = all.length;
    const completed = all.filter((t: any) => t.completed).length;
    const pending = total - completed;
    const urgent = all.filter((t: any) => t.priority === "urgent" && !t.completed).length;
    return { total, completed, pending, urgent };
  }, [personalTasks]);

  const filteredClientTasks = useMemo(() => {
    let result = clientTasks as any[];
    if (clientStatusFilter === "completed") result = result.filter((t: any) => t.completed);
    else if (clientStatusFilter === "pending") result = result.filter((t: any) => !t.completed);
    if (clientPriorityFilter !== "all") result = result.filter((t: any) => t.priority === clientPriorityFilter);
    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase();
      result = result.filter((t: any) => t.title?.toLowerCase().includes(q) || t.clientName?.toLowerCase().includes(q));
    }
    return result;
  }, [clientTasks, clientStatusFilter, clientPriorityFilter, clientSearch]);

  const clientStats = useMemo(() => {
    const all = clientTasks as any[];
    const total = all.length;
    const completed = all.filter((t: any) => t.completed).length;
    const pending = total - completed;
    const urgent = all.filter((t: any) => t.priority === "urgent" && !t.completed).length;
    return { total, completed, pending, urgent };
  }, [clientTasks]);

  const tasksByClient = useMemo(() => {
    const grouped = new Map<string, { clientName: string; tasks: any[] }>();
    filteredClientTasks.forEach((task: any) => {
      const key = task.clientId || "unknown";
      if (!grouped.has(key)) {
        grouped.set(key, { clientName: task.clientName || "Cliente sconosciuto", tasks: [] });
      }
      grouped.get(key)!.tasks.push(task);
    });
    return Array.from(grouped.entries());
  }, [filteredClientTasks]);

  const toggleClient = (clientId: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const handleCreatePersonalTask = () => {
    if (!newTitle.trim()) return;
    createMutation.mutate({
      title: newTitle.trim(),
      priority: newPriority,
      category: newCategory,
      dueDate: newDueDate || undefined,
    });
  };

  const handleCreateClientTask = () => {
    if (!ctClientId || !ctTitle.trim()) return;
    createClientTaskMutation.mutate({
      clientId: ctClientId,
      title: ctTitle.trim(),
      description: ctDescription.trim() || undefined,
      priority: ctPriority,
      category: ctCategory,
      dueDate: ctDueDate || undefined,
    });
  };

  const renderStatsRow = (stats: { total: number; completed: number; pending: number; urgent: number }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {[
        { label: "Totale", value: stats.total, gradient: "from-blue-500 to-blue-600", icon: <ListTodo className="w-5 h-5 text-blue-600" />, iconBg: "bg-blue-100 dark:bg-blue-900/30" },
        { label: "Completate", value: stats.completed, gradient: "from-emerald-500 to-emerald-600", icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />, iconBg: "bg-emerald-100 dark:bg-emerald-900/30" },
        { label: "In Sospeso", value: stats.pending, gradient: "from-amber-500 to-orange-500", icon: <Clock className="w-5 h-5 text-amber-600" />, iconBg: "bg-amber-100 dark:bg-amber-900/30" },
        { label: "Urgenti", value: stats.urgent, gradient: "from-red-500 to-rose-600", icon: <AlertCircle className="w-5 h-5 text-red-600" />, iconBg: "bg-red-100 dark:bg-red-900/30" },
      ].map((stat) => (
        <div key={stat.label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-md transition-all duration-300">
          <div className={`h-1.5 bg-gradient-to-r ${stat.gradient}`} />
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            </div>
            <div className={cn("p-2.5 rounded-xl", stat.iconBg)}>
              {stat.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderPriorityBadge = (priority: string) => {
    const config = priorityConfig[priority] || priorityConfig.medium;
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", config.bg, config.color)}>
        <Flag className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const renderCategoryBadge = (category: string, labels: Record<string, string>) => (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
      <Tag className="w-3 h-3" />
      {labels[category] || category}
    </span>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-950">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showRoleSwitch={showRoleSwitch} currentRole={currentRole} onRoleSwitch={handleRoleSwitch} />
        <div className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-6">

            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 lg:p-8 text-white shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
              <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-3">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                    <ListTodo className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold">Task Manager</h1>
                    <p className="text-blue-200 text-sm lg:text-base">Gestisci le tue task personali e quelle dei tuoi clienti</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-sm border border-white/10">
                    <ListTodo className="w-3.5 h-3.5" />
                    {personalStats.total} task personali
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-sm border border-white/10">
                    <User className="w-3.5 h-3.5" />
                    {clientStats.total} task clienti
                  </span>
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-2 h-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-1">
                <TabsTrigger value="personal" className="rounded-xl text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white">
                  Task Consulente
                </TabsTrigger>
                <TabsTrigger value="clients" className="rounded-xl text-sm font-medium data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white">
                  Task Clienti
                </TabsTrigger>
              </TabsList>

              <TabsContent value="personal" className="mt-6 space-y-6">
                {renderStatsRow(personalStats)}

                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 px-4 lg:px-6 py-3 flex items-center gap-2">
                    <div className="p-1.5 bg-white/20 rounded-lg">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">AI Task Generator</h3>
                    <span className="text-xs text-white/70 ml-auto">Gemini 3 Flash Preview</span>
                  </div>
                  <div className="p-4 lg:p-6 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {([
                        { value: "freetext" as const, icon: <MessageSquareText className="w-3.5 h-3.5" />, label: "Testo libero" },
                        { value: "ideas" as const, icon: <Lightbulb className="w-3.5 h-3.5" />, label: "Idee" },
                        { value: "schedule" as const, icon: <CalendarClock className="w-3.5 h-3.5" />, label: "Schedula lista" },
                      ]).map(m => (
                        <button
                          key={m.value}
                          onClick={() => setAiMode(m.value)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                            aiMode === m.value
                              ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                          )}
                        >
                          {m.icon}
                          {m.label}
                        </button>
                      ))}
                    </div>

                    <Textarea
                      placeholder={
                        aiMode === "ideas"
                          ? "Scrivi le tue idee... Es: Vorrei lanciare un webinar sulla pianificazione finanziaria, creare una newsletter mensile, espandere il portfolio clienti..."
                          : aiMode === "schedule"
                          ? "Scrivi la lista di cose da fare... Es:\n- Preparare presentazione Q1\n- Chiamare 5 prospect\n- Aggiornare CRM\n- Scrivere articolo blog\n- Analisi portafoglio clienti"
                          : "Scrivi qualsiasi cosa... idee, note, appunti dalla riunione, cose da fare... L'AI estrarrà task concrete con date e priorità."
                      }
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      className="min-h-[100px] bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 resize-none text-sm"
                    />

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {aiMode === "ideas" ? "L'AI trasformerà le tue idee in task concrete con obiettivi misurabili"
                          : aiMode === "schedule" ? "L'AI schedulerà ogni elemento con date realistiche"
                          : "L'AI analizzerà il testo ed estrarrà tutte le attività"}
                      </p>
                      <Button
                        onClick={handleAiGenerate}
                        disabled={!aiInput.trim() || aiGenerateMutation.isPending}
                        className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md"
                      >
                        {aiGenerateMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            Genero...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-1.5" />
                            Genera Task
                          </>
                        )}
                      </Button>
                    </div>

                    {showAiResults && aiGeneratedTasks.length > 0 && (
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-violet-500" />
                            Task generate ({aiGeneratedTasks.length})
                          </h4>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setShowAiResults(false); setAiGeneratedTasks([]); }}
                              className="h-8 text-xs"
                            >
                              Scarta tutte
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleConfirmAllAiTasks}
                              className="h-8 text-xs bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              Conferma tutte
                            </Button>
                          </div>
                        </div>
                        {aiGeneratedTasks.map((task: any, idx: number) => (
                          <div key={idx} className="bg-violet-50/50 dark:bg-violet-950/20 rounded-xl border border-violet-200 dark:border-violet-800/50 p-3 hover:shadow-sm transition-all">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 flex flex-col gap-1 mt-0.5">
                                <button
                                  onClick={() => handleConfirmAiTask(task, idx)}
                                  className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 transition-colors"
                                  title="Conferma"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDismissAiTask(idx)}
                                  className="p-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                                  title="Scarta"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 dark:text-white text-sm">{task.title}</p>
                                {task.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{task.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  {renderPriorityBadge(task.priority)}
                                  {renderCategoryBadge(task.category, personalCategoryLabels)}
                                  {task.dueDate && (
                                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                      <Calendar className="w-3 h-3" />
                                      {format(new Date(task.dueDate), "d MMM yyyy", { locale: it })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 lg:p-6">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Nuova Task Manuale
                  </h3>
                  <div className="flex flex-col lg:flex-row gap-3">
                    <Input
                      placeholder="Titolo della task..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="flex-1 h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreatePersonalTask(); }}
                    />
                    <Select value={newPriority} onValueChange={setNewPriority}>
                      <SelectTrigger className="w-full lg:w-[130px] h-10 bg-gray-50 dark:bg-gray-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Bassa</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger className="w-full lg:w-[140px] h-10 bg-gray-50 dark:bg-gray-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(personalCategoryLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full lg:w-[160px] h-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    />
                    <Button
                      onClick={handleCreatePersonalTask}
                      disabled={!newTitle.trim() || createMutation.isPending}
                      className="h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Crea
                    </Button>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex flex-col md:flex-row gap-3">
                    <Select value={personalStatusFilter} onValueChange={setPersonalStatusFilter}>
                      <SelectTrigger className="w-full md:w-[150px] h-9 bg-gray-50 dark:bg-gray-800 text-sm">
                        <SelectValue placeholder="Stato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutte</SelectItem>
                        <SelectItem value="completed">Completate</SelectItem>
                        <SelectItem value="pending">In Sospeso</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={personalPriorityFilter} onValueChange={setPersonalPriorityFilter}>
                      <SelectTrigger className="w-full md:w-[150px] h-9 bg-gray-50 dark:bg-gray-800 text-sm">
                        <SelectValue placeholder="Priorità" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutte</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="low">Bassa</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Cerca task..."
                        value={personalSearch}
                        onChange={(e) => setPersonalSearch(e.target.value)}
                        className="pl-9 h-9 bg-gray-50 dark:bg-gray-800 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredPersonalTasks.length === 0 ? (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <ListTodo className="w-8 h-8 text-blue-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">Nessuna task trovata</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Crea la tua prima task personale</p>
                    </div>
                  ) : (
                    filteredPersonalTasks.map((task: any) => (
                      <div
                        key={task.id}
                        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 hover:shadow-md transition-all duration-300 group"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleMutation.mutate(task.id)}
                            className="mt-0.5 flex-shrink-0"
                          >
                            {task.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 hover:text-blue-500 transition-colors" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={cn("font-medium text-gray-900 dark:text-white", task.completed && "line-through text-gray-400 dark:text-gray-500")}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {renderPriorityBadge(task.priority)}
                              {renderCategoryBadge(task.category, personalCategoryLabels)}
                              {task.dueDate && (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                  <Calendar className="w-3 h-3" />
                                  {format(new Date(task.dueDate), "d MMM yyyy", { locale: it })}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteMutation.mutate(task.id)}
                            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="clients" className="mt-6 space-y-6">
                {renderStatsRow(clientStats)}

                <div className="flex items-center justify-between">
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 flex flex-col md:flex-row gap-3 flex-1">
                    <Select value={clientStatusFilter} onValueChange={setClientStatusFilter}>
                      <SelectTrigger className="w-full md:w-[150px] h-9 bg-gray-50 dark:bg-gray-800 text-sm">
                        <SelectValue placeholder="Stato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutte</SelectItem>
                        <SelectItem value="completed">Completate</SelectItem>
                        <SelectItem value="pending">In Sospeso</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={clientPriorityFilter} onValueChange={setClientPriorityFilter}>
                      <SelectTrigger className="w-full md:w-[150px] h-9 bg-gray-50 dark:bg-gray-800 text-sm">
                        <SelectValue placeholder="Priorità" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutte</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="medium">Media</SelectItem>
                        <SelectItem value="low">Bassa</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Cerca task o cliente..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="pl-9 h-9 bg-gray-50 dark:bg-gray-800 text-sm"
                      />
                    </div>
                    <Button
                      onClick={() => setIsCreateClientTaskOpen(true)}
                      className="h-9 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Nuova Task
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {tasksByClient.length === 0 ? (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <User className="w-8 h-8 text-blue-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">Nessuna task trovata</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Crea una task per un cliente</p>
                    </div>
                  ) : (
                    tasksByClient.map(([clientId, { clientName, tasks }]) => {
                      const isExpanded = expandedClients.has(clientId);
                      const completedCount = tasks.filter((t: any) => t.completed).length;
                      return (
                        <div key={clientId} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-md transition-all duration-300">
                          <button
                            onClick={() => toggleClient(clientId)}
                            className="w-full p-4 flex items-center justify-between bg-gradient-to-r from-gray-50 to-blue-50/50 dark:from-gray-800/50 dark:to-blue-950/30 hover:from-gray-100 hover:to-blue-100/50 dark:hover:from-gray-800 dark:hover:to-blue-950/50 transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-blue-600" />}
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-blue-600" />
                                <span className="font-semibold text-gray-900 dark:text-white">{clientName}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                              <span>{tasks.length} task</span>
                              <span className="text-emerald-600">{completedCount} completate</span>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="p-4 space-y-3 border-t border-gray-100 dark:border-gray-800">
                              {tasks.map((task: any) => (
                                <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                  <button
                                    onClick={() => toggleClientTaskMutation.mutate(task.id)}
                                    className="mt-0.5 flex-shrink-0"
                                  >
                                    {task.completed ? (
                                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    ) : (
                                      <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 hover:text-blue-500 transition-colors" />
                                    )}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <p className={cn("font-medium text-gray-900 dark:text-white text-sm", task.completed && "line-through text-gray-400 dark:text-gray-500")}>
                                      {task.title}
                                    </p>
                                    {task.description && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                      {renderPriorityBadge(task.priority)}
                                      {renderCategoryBadge(task.category, clientCategoryLabels)}
                                      {task.dueDate && (
                                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                          <Calendar className="w-3 h-3" />
                                          {format(new Date(task.dueDate), "d MMM yyyy", { locale: it })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <Dialog open={isCreateClientTaskOpen} onOpenChange={setIsCreateClientTaskOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Nuova Task Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Cliente</label>
              <Select value={ctClientId} onValueChange={setCtClientId}>
                <SelectTrigger className="h-10 bg-gray-50 dark:bg-gray-800">
                  <SelectValue placeholder="Seleziona un cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {(clients as any[]).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Titolo</label>
              <Input
                placeholder="Titolo della task..."
                value={ctTitle}
                onChange={(e) => setCtTitle(e.target.value)}
                className="h-10 bg-gray-50 dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Descrizione</label>
              <Textarea
                placeholder="Descrizione opzionale..."
                value={ctDescription}
                onChange={(e) => setCtDescription(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800 min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Priorità</label>
                <Select value={ctPriority} onValueChange={setCtPriority}>
                  <SelectTrigger className="h-10 bg-gray-50 dark:bg-gray-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Bassa</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Categoria</label>
                <Select value={ctCategory} onValueChange={setCtCategory}>
                  <SelectTrigger className="h-10 bg-gray-50 dark:bg-gray-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(clientCategoryLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Scadenza</label>
              <Input
                type="date"
                value={ctDueDate}
                onChange={(e) => setCtDueDate(e.target.value)}
                className="h-10 bg-gray-50 dark:bg-gray-800"
              />
            </div>
            <Button
              onClick={handleCreateClientTask}
              disabled={!ctClientId || !ctTitle.trim() || createClientTaskMutation.isPending}
              className="w-full h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
            >
              <Plus className="w-4 h-4 mr-1" />
              Crea Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConsultantAIAssistant />
    </div>
  );
}