import { useState } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import it from "date-fns/locale/it";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, Circle, Users, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyTask } from "@shared/schema";

interface ClientTasksViewProps {
  clients: Array<{ id: string; firstName: string; lastName: string }>;
  tasks: DailyTask[];
  selectedClientId?: string;
  onClientChange: (clientId: string) => void;
}

export default function ClientTasksView({
  clients,
  tasks,
  selectedClientId,
  onClientChange,
}: ClientTasksViewProps) {
  const [dateFilter, setDateFilter] = useState<"week" | "month" | "all">("week");

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const getFilteredTasks = () => {
    if (!selectedClientId) return [];

    let filteredTasks = tasks.filter(t => t.clientId === selectedClientId);

    if (dateFilter === "week") {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
      filteredTasks = filteredTasks.filter(t => {
        const taskDate = new Date(t.date);
        return taskDate >= weekStart && taskDate <= weekEnd;
      });
    } else if (dateFilter === "month") {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      filteredTasks = filteredTasks.filter(t => {
        const taskDate = new Date(t.date);
        return taskDate >= monthStart && taskDate <= monthEnd;
      });
    }

    return filteredTasks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const filteredTasks = getFilteredTasks();
  const completedCount = filteredTasks.filter(t => t.completed).length;
  const totalCount = filteredTasks.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const groupTasksByDate = () => {
    const grouped: Record<string, DailyTask[]> = {};
    filteredTasks.forEach(task => {
      if (!grouped[task.date]) {
        grouped[task.date] = [];
      }
      grouped[task.date].push(task);
    });
    return grouped;
  };

  const groupedTasks = groupTasksByDate();

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-md">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl md:text-2xl font-heading bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Task Cliente
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Monitora le attività giornaliere
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={selectedClientId || ""} onValueChange={onClientChange}>
              <SelectTrigger className="w-full sm:w-[250px] border-2 hover:border-blue-400 transition-colors">
                <SelectValue placeholder="Seleziona cliente">
                  {selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : "Seleziona cliente"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.firstName} {client.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
              <SelectTrigger className="w-full sm:w-[180px] border-2 hover:border-blue-400 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Questa settimana</SelectItem>
                <SelectItem value="month">Questo mese</SelectItem>
                <SelectItem value="all">Tutte le task</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedClientId && totalCount > 0 && (
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-700 px-3 py-1.5">
                📋 {totalCount} task totali
              </Badge>
              <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 px-3 py-1.5 shadow-sm">
                ✓ {completedCount} completate
              </Badge>
              <Badge className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 px-3 py-1.5 shadow-sm">
                <TrendingUp className="h-3 w-3 mr-1" />
                {completionRate}%
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {!selectedClientId ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900 dark:to-cyan-900 rounded-full mb-4">
              <Users className="h-12 w-12 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Seleziona un cliente</h3>
            <p className="text-muted-foreground">Scegli un cliente dal menu sopra per visualizzare le sue task</p>
          </div>
        ) : Object.keys(groupedTasks).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-gradient-to-br from-gray-100 to-slate-100 dark:from-gray-900 dark:to-slate-900 rounded-full mb-4">
              <Circle className="h-12 w-12 text-gray-600 dark:text-gray-400" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Nessuna task trovata</h3>
            <p className="text-muted-foreground">Non ci sono task per questo periodo</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedTasks).map(([date, dateTasks]) => {
              const dateTasksCompleted = dateTasks.filter(t => t.completed).length;
              const dateTasksTotal = dateTasks.length;
              const isAllCompleted = dateTasksCompleted === dateTasksTotal;

              return (
                <div key={date} className="space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b-2 border-gray-200 dark:border-gray-800">
                    <h3 className="font-semibold text-lg capitalize">
                      {format(new Date(date), "EEEE d MMMM yyyy", { locale: it })}
                    </h3>
                    <Badge className={cn(
                      "px-3 py-1",
                      isAllCompleted 
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" 
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    )}>
                      {dateTasksCompleted}/{dateTasksTotal}
                    </Badge>
                  </div>

                  <div className="space-y-2.5">
                    {dateTasks.map(task => (
                      <div
                        key={task.id}
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-xl border-2 transition-all duration-200",
                          task.completed 
                            ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-900" 
                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700"
                        )}
                      >
                        {task.completed ? (
                          <div className="p-1 bg-green-500 rounded-full mt-0.5">
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          </div>
                        ) : (
                          <div className="p-1 border-2 border-gray-300 dark:border-gray-700 rounded-full mt-0.5">
                            <Circle className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium",
                            task.completed && "line-through text-muted-foreground"
                          )}>
                            {task.description}
                          </p>
                          {task.completedAt && (
                            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mt-1.5">
                              <Clock className="h-3 w-3" />
                              <span>Completata alle {format(new Date(task.completedAt), "HH:mm", { locale: it })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
