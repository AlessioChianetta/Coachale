import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek } from "date-fns";
import Sidebar from "@/components/sidebar";
import TaskCalendar from "@/components/task-calendar";
import DailyReflectionForm from "@/components/daily-reflection-form";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DailyTask, DailyReflection } from "@shared/schema";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { usePageContext } from "@/hooks/use-page-context";
import { Button } from "@/components/ui/button";
import { Menu, CheckSquare, HelpCircle } from "lucide-react";
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { driverConfig } from '@/lib/tour/driver-config';
import { dailyTasksTourSteps } from '@/components/interactive-tour/daily-tasks-tour-steps';

export default function ClientDailyTasks() {
  const pageContext = usePageContext();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [isTourActive, setIsTourActive] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  // Fetch tasks for current week
  const { data: tasks = [] } = useQuery<DailyTask[]>({
    queryKey: ["/api/daily-tasks", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const response = await fetch(
        `/api/daily-tasks?startDate=${format(weekStart, "yyyy-MM-dd")}&endDate=${format(weekEnd, "yyyy-MM-dd")}`,
        {
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error("Failed to fetch tasks");
      return response.json();
    },
  });

  // Fetch reflection for selected date
  const { data: reflection } = useQuery<DailyReflection>({
    queryKey: ["/api/daily-reflections", format(selectedDate, "yyyy-MM-dd")],
    queryFn: async () => {
      const response = await fetch(
        `/api/daily-reflections/${format(selectedDate, "yyyy-MM-dd")}`,
        {
          headers: getAuthHeaders(),
        }
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("Failed to fetch reflection");
      return response.json();
    },
  });

  // Fetch all reflections for current week to show indicators
  const { data: weekReflections = [] } = useQuery<DailyReflection[]>({
    queryKey: ["/api/daily-reflections", "week", format(weekStart, "yyyy-MM-dd"), format(weekEnd, "yyyy-MM-dd")],
    queryFn: async () => {
      const response = await fetch(
        `/api/daily-reflections?startDate=${format(weekStart, "yyyy-MM-dd")}&endDate=${format(weekEnd, "yyyy-MM-dd")}`,
        {
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch reflections");
      }
      return response.json();
    },
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (data: { description: string; date: string }) => {
      const response = await fetch("/api/daily-tasks", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create task");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-tasks"] });
      toast({
        title: "Task creata",
        description: "La task è stata aggiunta con successo",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile creare la task",
        variant: "destructive",
      });
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DailyTask> }) => {
      const response = await fetch(`/api/daily-tasks/${id}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update task");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-tasks"] });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/daily-tasks/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete task");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-tasks"] });
      toast({
        title: "Task eliminata",
        description: "La task è stata rimossa",
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

  // Save reflection mutation
  const saveReflectionMutation = useMutation({
    mutationFn: async (data: any) => {
      const method = reflection ? "PATCH" : "POST";
      const url = reflection 
        ? `/api/daily-reflections/${reflection.id}` 
        : "/api/daily-reflections";

      const response = await fetch(url, {
        method,
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save reflection");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-reflections"] });
      toast({
        title: "Riflessione salvata",
        description: "La tua riflessione giornaliera è stata salvata",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile salvare la riflessione",
        variant: "destructive",
      });
    },
  });

  // Delete reflection mutation
  const deleteReflectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/daily-reflections/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete reflection");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-reflections"] });
      toast({
        title: "Riflessione eliminata",
        description: "La riflessione è stata cancellata",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la riflessione",
        variant: "destructive",
      });
    },
  });

  const handleAddTask = (description: string, date: string) => {
    // Date is already in YYYY-MM-DD format from the calendar
    // Only send required fields to avoid validation errors
    createTaskMutation.mutate({ 
      description: description.trim(), 
      date 
    });
  };

  const handleToggleTask = (taskId: string, completed: boolean, completedAt?: Date) => {
    updateTaskMutation.mutate({
      id: taskId,
      data: { completed },
    });
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTaskMutation.mutate(taskId);
  };

  const handleEditTask = (taskId: string, description: string) => {
    updateTaskMutation.mutate({
      id: taskId,
      data: { description: description.trim() },
    });
  };

  const handleSaveReflection = (data: any) => {
    saveReflectionMutation.mutate(data);
  };

  const handleDeleteReflection = (reflectionId: string) => {
    if (reflectionId) {
      deleteReflectionMutation.mutate(reflectionId);
    }
  };

  const startDailyTasksTour = () => {
    setIsTourActive(true);
    const driverObj = driver({
      ...driverConfig,
      onDestroyed: () => setIsTourActive(false),
    });
    driverObj.setSteps(dailyTasksTourSteps);
    driverObj.drive();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 overflow-y-auto">
          {/* Integrated Header with Menu Button */}
          <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
            <div className="px-4 md:px-8 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                  className="h-11 w-11 min-h-[44px] min-w-[44px] hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
                    <CheckSquare className="h-5 w-5 text-white" />
                  </div>
                  <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
                    Task & Riflessioni
                  </h1>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={startDailyTasksTour} className="gap-2">
                <HelpCircle className="h-4 w-4" />
                <span className="hidden md:inline">Guida</span>
              </Button>
            </div>
          </div>

          <div className="p-4 md:p-6">
            {/* Enhanced Hero Section */}
            <div className="mb-6 lg:mb-8 relative overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 opacity-10"></div>
              <div className="relative bg-gradient-to-br from-background/95 to-muted/50 backdrop-blur-sm border border-border/50 p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h1 className="text-2xl md:text-3xl font-heading font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent">
                          Task & Riflessioni Giornaliere
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-base">
                      Organizza le tue attività quotidiane e rifletti sui tuoi progressi
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 min-w-[200px]">
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Task Oggi</span>
                      <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {tasks.filter(t => t.date === format(selectedDate, "yyyy-MM-dd")).length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200 dark:border-green-800">
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">Completate</span>
                      <span className="text-xl font-bold text-green-600 dark:text-green-400">
                        {tasks.filter(t => t.date === format(selectedDate, "yyyy-MM-dd") && t.completed).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 max-w-[1400px] mx-auto">
              <div className="w-full">
                <TaskCalendar
                  tasks={tasks}
                  reflections={weekReflections}
                  onAddTask={handleAddTask}
                  onToggleTask={handleToggleTask}
                  onDeleteTask={handleDeleteTask}
                  onEditTask={handleEditTask}
                  onDateSelect={setSelectedDate}
                  selectedDate={selectedDate}
                  currentWeek={currentWeek}
                  onWeekChange={setCurrentWeek}
                />
              </div>

              <div className="w-full" data-tour="reflections-section">
                <DailyReflectionForm
                  reflection={reflection || undefined}
                  onSave={handleSaveReflection}
                  onDelete={handleDeleteReflection}
                  selectedDate={selectedDate}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Assistant */}
      <AIAssistant pageContext={pageContext} />
    </div>
  );
}