import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import it from "date-fns/locale/it";
import {
  ListTodo,
  Filter,
  Calendar,
  User,
  CheckCircle2,
  Circle,
  Clock,
  Flag,
  Search,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { useIsMobile } from "@/hooks/use-mobile";
import { getAuthHeaders } from "@/lib/auth";
import ConsultationTasksManager from "@/components/consultation-tasks-manager";

interface ConsultationTask {
  id: string;
  consultationId: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  category: "preparation" | "follow-up" | "exercise" | "goal" | "reminder";
  createdAt: string;
  updatedAt: string;
}

const priorityConfig = {
  urgent: { variant: "destructive" as const, label: "Urgente", color: "text-red-600" },
  high: { variant: "default" as const, label: "Alta", color: "text-orange-600" },
  medium: { variant: "default" as const, label: "Media", color: "text-yellow-600" },
  low: { variant: "default" as const, label: "Bassa", color: "text-green-600" },
};

const categoryLabels = {
  preparation: "Preparazione",
  "follow-up": "Follow-up",
  exercise: "Esercizio",
  goal: "Obiettivo",
  reminder: "Promemoria",
};

export default function ConsultantTasks() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Filtri
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedConsultations, setExpandedConsultations] = useState<Set<string>>(new Set());
  
  // Dialog creazione task
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [selectedClientForTask, setSelectedClientForTask] = useState<{ id: string; name: string; consultationId: string } | null>(null);

  // Fetch all tasks for consultant
  const { data: tasks = [], isLoading } = useQuery<ConsultationTask[]>({
    queryKey: ["/api/consultation-tasks/consultant", filterStatus, filterPriority, filterCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") {
        params.append("completed", String(filterStatus === "completed"));
      }
      if (filterPriority !== "all") {
        params.append("priority", filterPriority);
      }
      if (filterCategory !== "all") {
        params.append("category", filterCategory);
      }

      const response = await fetch(`/api/consultation-tasks/consultant?${params.toString()}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error("Failed to fetch tasks");
      const result = await response.json();
      return result.data || result;
    },
  });

  // Fetch clients list
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  // Fetch consultations
  const { data: consultations = [] } = useQuery({
    queryKey: ["/api/consultations"],
    queryFn: async () => {
      const response = await fetch("/api/consultations", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch consultations");
      return response.json();
    },
  });

  // Filtra per search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const query = searchQuery.toLowerCase();
    return tasks.filter(task => 
      task.title.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query) ||
      task.clientName.toLowerCase().includes(query)
    );
  }, [tasks, searchQuery]);

  // Raggruppa task per consulenza
  const tasksByConsultation = useMemo(() => {
    const grouped = new Map<string, ConsultationTask[]>();
    
    filteredTasks.forEach(task => {
      const consultationId = task.consultationId;
      if (!grouped.has(consultationId)) {
        grouped.set(consultationId, []);
      }
      grouped.get(consultationId)!.push(task);
    });

    // Ordina per data di creazione più recente
    return Array.from(grouped.entries())
      .sort(([, tasksA], [, tasksB]) => {
        const dateA = new Date(tasksA[0]?.createdAt || 0);
        const dateB = new Date(tasksB[0]?.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
  }, [filteredTasks]);

  const toggleConsultation = (consultationId: string) => {
    setExpandedConsultations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(consultationId)) {
        newSet.delete(consultationId);
      } else {
        newSet.add(consultationId);
      }
      return newSet;
    });
  };

  // Statistiche
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const urgent = tasks.filter(t => t.priority === "urgent" && !t.completed).length;
    
    return { total, completed, pending, urgent };
  }, [tasks]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-blue-950 dark:to-indigo-950">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 p-8 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Card className="p-8 shadow-2xl bg-white/80 backdrop-blur-sm border-0">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                  <p className="mt-6 text-slate-700 font-semibold text-lg">Caricamento task...</p>
                </div>
              </Card>
            </div>
          ) : (
            <>
          {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                    <ListTodo className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      Task Clienti
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 text-lg">
                      Gestisci tutte le task assegnate ai tuoi clienti
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setIsCreateTaskDialogOpen(true)}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Nuova Task
                </Button>
              </div>
            </div>

          {/* Statistiche */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-white dark:bg-slate-800 border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Totale Task</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                  </div>
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <ListTodo className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-800 border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Completate</p>
                    <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-800 border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">In Sospeso</p>
                    <p className="text-3xl font-bold text-orange-600">{stats.pending}</p>
                  </div>
                  <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                    <Circle className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-800 border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Urgenti</p>
                    <p className="text-3xl font-bold text-red-600">{stats.urgent}</p>
                  </div>
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtri */}
          <Card className="mb-8 bg-white dark:bg-slate-800 border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtri
              </CardTitle>
              <CardDescription>Filtra e cerca le task dei tuoi clienti</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Stato
                  </label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte</SelectItem>
                      <SelectItem value="completed">Completate</SelectItem>
                      <SelectItem value="incomplete">In Sospeso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Priorità
                  </label>
                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="low">Bassa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Categoria
                  </label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte</SelectItem>
                      <SelectItem value="preparation">Preparazione</SelectItem>
                      <SelectItem value="follow-up">Follow-up</SelectItem>
                      <SelectItem value="exercise">Esercizio</SelectItem>
                      <SelectItem value="goal">Obiettivo</SelectItem>
                      <SelectItem value="reminder">Promemoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                    Cerca
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Cerca task o cliente..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-11 bg-slate-50 dark:bg-slate-900"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista Task raggruppate per consulenza */}
          <div className="space-y-6">
            {tasksByConsultation.length === 0 ? (
              <Card className="bg-white dark:bg-slate-800 border-0 shadow-xl">
                <CardContent className="p-16 text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <ListTodo className="w-12 h-12 text-blue-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Nessuna task trovata
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {searchQuery ? "Prova a modificare i filtri di ricerca" : "Non ci sono task da visualizzare"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              tasksByConsultation.map(([consultationId, consultationTasks]) => {
                const isExpanded = expandedConsultations.has(consultationId);
                const firstTask = consultationTasks[0];
                const completedCount = consultationTasks.filter(t => t.completed).length;
                const totalCount = consultationTasks.length;

                return (
                  <Card key={consultationId} className="bg-white dark:bg-slate-800 border-0 shadow-xl overflow-hidden">
                    <div
                      className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 cursor-pointer hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/50 dark:hover:to-purple-900/50 transition-all"
                      onClick={() => toggleConsultation(consultationId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                            {isExpanded ? (
                              <ChevronDown className="w-5 h-5 text-indigo-600" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-indigo-600" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <User className="w-5 h-5 text-indigo-600" />
                              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {firstTask.clientName}
                              </h3>
                              <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50">
                                Consulenza #{consultationId.slice(0, 8)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <ListTodo className="w-4 h-4" />
                                {totalCount} task totali
                              </span>
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                {completedCount} completate
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4 text-orange-600" />
                                {totalCount - completedCount} in sospeso
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            Progresso
                          </div>
                          <div className="text-2xl font-bold text-indigo-600">
                            {Math.round((completedCount / totalCount) * 100)}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <CardContent className="p-6">
                        <div className="space-y-3">
                          {consultationTasks.map(task => (
                            <div
                              key={task.id}
                              className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:shadow-md transition-all"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className="mt-1">
                                    {task.completed ? (
                                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    ) : (
                                      <Circle className="w-5 h-5 text-slate-400" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className={`font-semibold mb-1 ${task.completed ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
                                      {task.title}
                                    </h4>
                                    {task.description && (
                                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                        {task.description}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <Badge className={`${priorityConfig[task.priority].variant === "destructive" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>
                                        <Flag className="w-3 h-3 mr-1" />
                                        {priorityConfig[task.priority].label}
                                      </Badge>
                                      <Badge variant="outline" className="text-xs">
                                        {categoryLabels[task.category]}
                                      </Badge>
                                      {task.dueDate && (
                                        <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                          <Calendar className="w-3 h-3" />
                                          Scadenza: {format(new Date(task.dueDate), "dd MMM yyyy", { locale: it })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}
            </div>
          </>
          )}
        </div>
      </div>
      <ConsultantAIAssistant />

      {/* Dialog per creare nuova task */}
      <Dialog open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crea Nuova Task per Cliente</DialogTitle>
          </DialogHeader>
          
          {!selectedClientForTask ? (
            <div className="py-6">
              <p className="text-sm text-muted-foreground mb-4">
                Seleziona un cliente per cui creare una task:
              </p>
              <div className="grid gap-3">
                {clients.map((client: any) => {
                  // Trova la consulenza più recente per questo cliente
                  const clientConsultations = consultations.filter(
                    (c: any) => c.clientId === client.id
                  );
                  const latestConsultation = clientConsultations.sort(
                    (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  )[0];

                  return (
                    <Button
                      key={client.id}
                      variant="outline"
                      className="justify-start h-auto p-4 hover:bg-blue-50 dark:hover:bg-blue-950"
                      onClick={() => {
                        if (latestConsultation) {
                          setSelectedClientForTask({
                            id: client.id,
                            name: `${client.firstName} ${client.lastName}`,
                            consultationId: latestConsultation.id,
                          });
                        }
                      }}
                      disabled={!latestConsultation}
                    >
                      <div className="text-left">
                        <div className="font-semibold">
                          {client.firstName} {client.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {client.email}
                        </div>
                        {!latestConsultation && (
                          <div className="text-xs text-red-500 mt-1">
                            Nessuna consulenza disponibile
                          </div>
                        )}
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <p className="text-sm font-medium">
                  Cliente selezionato: <span className="font-bold">{selectedClientForTask.name}</span>
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedClientForTask(null)}
                  className="mt-2"
                >
                  Cambia cliente
                </Button>
              </div>
              <ConsultationTasksManager
                clientId={selectedClientForTask.id}
                consultantId={""} 
                consultationId={selectedClientForTask.consultationId}
                readonly={false}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
