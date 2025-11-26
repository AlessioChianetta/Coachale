
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isPast, isToday } from "date-fns";
import it from "date-fns/locale/it";
import {
  Calendar,
  AlertCircle,
  CheckCircle2,
  Circle,
  Flag,
  ChevronDown,
  ChevronRight,
  User,
  ListTodo,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { getAuthHeaders } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

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
  consultation?: {
    id: string;
    scheduledAt: string;
    consultant: {
      firstName: string;
      lastName: string;
    };
  };
}

interface ClientConsultationTasksViewerProps {
  clientId: string;
}

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

export default function ClientConsultationTasksViewer({ clientId }: ClientConsultationTasksViewerProps) {
  const [expandedConsultations, setExpandedConsultations] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch tasks for client
  const { data: tasks = [], isLoading } = useQuery<ConsultationTask[]>({
    queryKey: ["/api/consultations/tasks/my"],
    queryFn: async () => {
      const response = await fetch("/api/consultations/tasks/my", {
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error("Failed to fetch tasks");
      const result = await response.json();
      return result.data || result;
    },
  });

  // Mutation per completare/scompletare una task
  const toggleTaskMutation = useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const response = await fetch(`/api/consultation-tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ completed }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nel completamento della task");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultations/tasks/my"] });
      toast({
        title: "✅ Task aggiornata",
        description: "Lo stato della task è stato aggiornato con successo",
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

  // Group tasks by consultation
  const tasksByConsultation = useMemo(() => {
    const grouped = tasks.reduce((acc, task) => {
      const key = task.consultationId;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(task);
      return acc;
    }, {} as Record<string, ConsultationTask[]>);

    return Object.entries(grouped).sort(([, a], [, b]) => {
      const dateA = a[0]?.consultation?.scheduledAt || a[0]?.createdAt;
      const dateB = b[0]?.consultation?.scheduledAt || b[0]?.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [tasks]);

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
          {isOverdue && " - Scaduta"}
        </span>
      </div>
    );
  };

  if (isLoading) {
    return (
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
    );
  }

  if (tasksByConsultation.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="p-12 text-center">
          <ListTodo className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Nessuna task assegnata</h3>
          <p className="text-muted-foreground">Il tuo consulente non ti ha ancora assegnato task</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="w-5 h-5" />
            Le Mie Task per Consulenza
          </CardTitle>
          <CardDescription>Task organizzate per ogni consulenza</CardDescription>
        </CardHeader>
      </Card>

      {tasksByConsultation.map(([consultationId, consultationTasks]) => {
        const isExpanded = expandedConsultations.has(consultationId);
        const firstTask = consultationTasks[0];
        const completedCount = consultationTasks.filter(t => t.completed).length;
        const totalCount = consultationTasks.length;
        const consultation = firstTask.consultation;

        return (
          <Card key={consultationId} className="bg-white dark:bg-slate-800 border-0 shadow-lg overflow-hidden">
            <div
              className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 cursor-pointer hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50 transition-all"
              onClick={() => toggleConsultation(consultationId)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-blue-600" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    {consultation ? (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-5 h-5 text-blue-600" />
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {format(new Date(consultation.scheduledAt), "EEEE dd MMMM yyyy", { locale: it })}
                          </h3>
                        </div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Clock className="w-4 h-4 text-blue-700 dark:text-blue-300" />
                            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                              Ore {format(new Date(consultation.scheduledAt), "HH:mm", { locale: it })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                            <User className="w-4 h-4 text-indigo-700 dark:text-indigo-300" />
                            <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                              {consultation.consultant.firstName} {consultation.consultant.lastName}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-3">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                          Consulenza senza dettagli
                        </h3>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <ListTodo className="w-3.5 h-3.5" />
                        <span>{completedCount}/{totalCount} completate</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round((completedCount / totalCount) * 100)}%
                    </div>
                    <div className="text-xs text-slate-500">completamento</div>
                  </div>
                </div>
              </div>
            </div>

            {isExpanded && (
              <CardContent className="p-5 space-y-3 bg-slate-50 dark:bg-slate-900/50">
                {consultationTasks.map((task) => (
                  <Card key={task.id} className={`${task.completed ? "opacity-60" : ""} border-0 shadow-sm`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={task.completed}
                          disabled={toggleTaskMutation.isPending}
                          onCheckedChange={(checked) => {
                            toggleTaskMutation.mutate({
                              taskId: task.id,
                              completed: checked as boolean,
                            });
                          }}
                          className="mt-1"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h3 className={`font-semibold text-base ${task.completed ? "line-through" : ""}`}>
                              {task.title}
                            </h3>
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
                                <span>Completata {format(new Date(task.completedAt), "dd MMM yyyy", { locale: it })}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
