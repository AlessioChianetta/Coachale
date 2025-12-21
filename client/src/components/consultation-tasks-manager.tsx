import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import it from "date-fns/locale/it";
import {
  Plus,
  Filter,
  Calendar,
  AlertCircle,
  Trash2,
  Edit,
  CheckCircle2,
  Circle,
  Clock,
  Flag,
  ArrowUpDown,
  X,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

interface ConsultationTask {
  id: string;
  consultationId: string;
  clientId: string;
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

interface ConsultationTasksManagerProps {
  clientId: string;
  consultantId: string;
  consultationId: string;
  transcript?: string;
  readonly?: boolean;
}

type FilterStatus = "all" | "completed" | "incomplete";
type SortBy = "dueDate" | "priority" | "createdAt";

const priorityConfig = {
  urgent: { variant: "destructive" as const, className: "" },
  high: { variant: "default" as const, className: "bg-orange-500 hover:bg-orange-600 text-white border-orange-500" },
  medium: { variant: "default" as const, className: "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500" },
  low: { variant: "default" as const, className: "bg-green-500 hover:bg-green-600 text-white border-green-500" },
};

const priorityLabels = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Bassa",
};

const categoryLabels = {
  preparation: "Preparazione",
  "follow-up": "Follow-up",
  exercise: "Esercizio",
  goal: "Obiettivo",
  reminder: "Promemoria",
};

const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };

export default function ConsultationTasksManager({ clientId, consultantId, consultationId, transcript, readonly = false }: ConsultationTasksManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // AI Task extraction mutation
  const extractTasksMutation = useMutation({
    mutationFn: async () => {
      if (!transcript || transcript.trim().length < 50) {
        throw new Error("La trascrizione deve contenere almeno 50 caratteri");
      }
      
      const response = await fetch("/api/echo/extract-tasks", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          consultationId,
          transcript: transcript.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nell'estrazione delle task");
      }

      return response.json();
    },
    onSuccess: async (data) => {
      const extractedTasks = data.tasks || [];
      
      if (extractedTasks.length === 0) {
        toast({
          title: "Nessuna task trovata",
          description: "L'AI non ha trovato azioni concrete nella trascrizione",
        });
        return;
      }

      // Create tasks one by one
      let createdCount = 0;
      for (const task of extractedTasks) {
        try {
          const response = await fetch("/api/consultation-tasks", {
            method: "POST",
            headers: {
              ...getAuthHeaders(),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: task.title,
              description: task.description || "",
              dueDate: task.dueDate ? new Date(task.dueDate).toISOString() : null,
              priority: task.priority || "medium",
              category: task.category || "follow-up",
              clientId,
              consultationId,
            }),
          });
          if (response.ok) createdCount++;
        } catch (e) {
          console.error("Error creating task:", e);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/consultation-tasks"] });
      
      toast({
        title: "Task estratte con successo",
        description: `Create ${createdCount} task dalla trascrizione`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // State
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("dueDate");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ConsultationTask | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<ConsultationTask | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "medium" as ConsultationTask["priority"],
    category: "reminder" as ConsultationTask["category"],
  });

  // Fetch tasks for this specific consultation
  const { data: tasks = [], isLoading } = useQuery<ConsultationTask[]>({
    queryKey: ["/api/consultation-tasks", consultationId, filterStatus, filterPriority],
    queryFn: async () => {
      const params = new URLSearchParams({ 
        clientId,
        consultationId // Filtra per questa consulenza specifica
      });
      if (filterStatus !== "all") {
        params.append("completed", String(filterStatus === "completed"));
      }
      if (filterPriority !== "all") {
        params.append("priority", filterPriority);
      }

      const response = await fetch(`/api/consultation-tasks?${params.toString()}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error("Failed to fetch tasks");
      const result = await response.json();
      return result.data || result;
    },
  });

  // Non serve più fetchare tutte le consultations perché stiamo guardando una consulenza specifica

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch("/api/consultation-tasks", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          clientId,
          consultationId, // Passa l'ID della consulenza specifica
          dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create task");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultation-tasks"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Task creata",
        description: "La task è stata creata con successo",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const response = await fetch(`/api/consultation-tasks/${id}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
        }),
      });

      if (!response.ok) throw new Error("Failed to update task");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultation-tasks"] });
      setIsEditDialogOpen(false);
      setSelectedTask(null);
      resetForm();
      toast({
        title: "Task aggiornata",
        description: "La task è stata aggiornata con successo",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la task",
        variant: "destructive",
      });
    },
  });

  // Toggle completed mutation
  const toggleCompletedMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const response = await fetch(`/api/consultation-tasks/${id}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ completed }),
      });

      if (!response.ok) throw new Error("Failed to toggle task");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultation-tasks"] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato della task",
        variant: "destructive",
      });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/consultation-tasks/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error("Failed to delete task");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultation-tasks"] });
      setIsDeleteDialogOpen(false);
      setTaskToDelete(null);
      toast({
        title: "Task eliminata",
        description: "La task è stata eliminata con successo",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la task",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      dueDate: "",
      priority: "medium",
      category: "reminder",
    });
  };

  const handleCreateTask = () => {
    if (!formData.title.trim()) {
      toast({
        title: "Errore",
        description: "Il titolo è obbligatorio",
        variant: "destructive",
      });
      return;
    }
    createTaskMutation.mutate(formData);
  };

  const handleEditTask = (task: ConsultationTask) => {
    setSelectedTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      dueDate: task.dueDate ? format(new Date(task.dueDate), "yyyy-MM-dd") : "",
      priority: task.priority,
      category: task.category,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateTask = () => {
    if (!selectedTask || !formData.title.trim()) {
      toast({
        title: "Errore",
        description: "Il titolo è obbligatorio",
        variant: "destructive",
      });
      return;
    }
    updateTaskMutation.mutate({ id: selectedTask.id, data: formData });
  };

  const handleDeleteTask = (task: ConsultationTask) => {
    setTaskToDelete(task);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (taskToDelete) {
      deleteTaskMutation.mutate(taskToDelete.id);
    }
  };

  const handleToggleCompleted = (task: ConsultationTask) => {
    toggleCompletedMutation.mutate({ id: task.id, completed: !task.completed });
  };

  // Sorted and filtered tasks
  const sortedTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      if (sortBy === "dueDate") {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else if (sortBy === "priority") {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return sorted;
  }, [tasks, sortBy]);

  // Render functions
  const renderPriorityBadge = (priority: ConsultationTask["priority"]) => {
    const config = priorityConfig[priority];
    return (
      <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
        <Flag className="w-3 h-3" />
        {priorityLabels[priority]}
      </Badge>
    );
  };

  const renderCategoryBadge = (category: ConsultationTask["category"]) => {
    return <Badge variant="outline">{categoryLabels[category]}</Badge>;
  };

  const renderDueDate = (dueDate: string | null) => {
    if (!dueDate) return null;

    const date = new Date(dueDate);
    const isOverdue = isPast(date) && !isToday(date);

    return (
      <div className={`flex items-center gap-1 text-sm ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
        {isOverdue && <AlertCircle className="w-4 h-4" />}
        <Calendar className="w-4 h-4" />
        <span>
          {isToday(date) ? "Oggi" : format(date, "dd MMM yyyy", { locale: it })}
          {!isOverdue && ` (${formatDistanceToNow(date, { locale: it, addSuffix: true })})`}
          {isOverdue && " - Scaduta"}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Task di Consulenza
              </CardTitle>
              <CardDescription>Gestisci le task assegnate al cliente</CardDescription>
            </div>
            {!readonly && (
              <div className="flex flex-col sm:flex-row gap-2">
                {transcript && transcript.trim().length >= 50 && (
                  <Button 
                    onClick={() => extractTasksMutation.mutate()}
                    disabled={extractTasksMutation.isPending}
                    className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    {extractTasksMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {extractTasksMutation.isPending ? "Estrazione AI..." : "✨ Genera Task con AI"}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nuova Task
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <Filter className="w-3 h-3" />
                Stato
              </Label>
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as FilterStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte</SelectItem>
                  <SelectItem value="completed">Completate</SelectItem>
                  <SelectItem value="incomplete">Da completare</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <Flag className="w-3 h-3" />
                Priorità
              </Label>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger>
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

            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" />
                Ordina per
              </Label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dueDate">Scadenza</SelectItem>
                  <SelectItem value="priority">Priorità</SelectItem>
                  <SelectItem value="createdAt">Data creazione</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tasks count */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Totale: {tasks.length}</span>
            <span>Completate: {tasks.filter((t) => t.completed).length}</span>
            <span>Da completare: {tasks.filter((t) => !t.completed).length}</span>
          </div>
        </CardContent>
      </Card>

      {/* Tasks list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sortedTasks.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Nessuna task trovata</h3>
            <p className="text-muted-foreground mb-4">
              {filterStatus !== "all" || filterPriority !== "all"
                ? "Prova a modificare i filtri"
                : readonly
                ? "Non ci sono task assegnate"
                : "Crea la prima task per iniziare"}
            </p>
            {!readonly && filterStatus === "all" && filterPriority === "all" && (
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Crea Task
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedTasks.map((task) => (
            <Card key={task.id} className={task.completed ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => handleToggleCompleted(task)}
                    className="mt-1"
                    disabled={readonly}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className={`font-semibold ${task.completed ? "line-through" : ""}`}>{task.title}</h3>
                      {!readonly && (
                        <div className="flex gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => handleEditTask(task)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteTask(task)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      {renderPriorityBadge(task.priority)}
                      {renderCategoryBadge(task.category)}
                      {renderDueDate(task.dueDate)}
                      {task.completed && task.completedAt && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span>Completata {formatDistanceToNow(new Date(task.completedAt), { locale: it, addSuffix: true })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
          setSelectedTask(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditDialogOpen ? "Modifica Task" : "Nuova Task"}</DialogTitle>
            <DialogDescription>
              {isEditDialogOpen ? "Modifica i dettagli della task" : "Crea una nuova task per il cliente"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">
                Titolo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Inserisci il titolo della task"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrizione</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrizione dettagliata (opzionale)"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priorità</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value as ConsultationTask["priority"] })}
                >
                  <SelectTrigger id="priority">
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

              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value as ConsultationTask["category"] })}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preparation">Preparazione</SelectItem>
                    <SelectItem value="follow-up">Follow-up</SelectItem>
                    <SelectItem value="exercise">Esercizio</SelectItem>
                    <SelectItem value="goal">Obiettivo</SelectItem>
                    <SelectItem value="reminder">Promemoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Data di scadenza</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setIsEditDialogOpen(false);
                setSelectedTask(null);
                resetForm();
              }}
            >
              Annulla
            </Button>
            <Button
              onClick={isEditDialogOpen ? handleUpdateTask : handleCreateTask}
              disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
            >
              {isEditDialogOpen ? "Salva modifiche" : "Crea task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare la task "{taskToDelete?.title}"? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
