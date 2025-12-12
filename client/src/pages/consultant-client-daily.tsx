import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Target, CheckSquare } from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import ClientTasksView from "@/components/consultant-client-tasks";
import ReflectionHistory from "@/components/consultant-reflection-history";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { NavigationTabs } from "@/components/ui/navigation-tabs";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DailyTask, DailyReflection } from "@shared/schema";

export default function ConsultantClientDaily() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const { toast } = useToast();

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients", "active"],
    queryFn: async () => {
      const response = await fetch("/api/clients?activeOnly=true", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  // Fetch ALL tasks for selected client (no date filtering - let client-side handle it)
  const { data: tasks = [] } = useQuery<DailyTask[]>({
    queryKey: [
      "/api/daily-tasks/consultant",
      selectedClientId,
    ],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const params = new URLSearchParams({
        clientId: selectedClientId,
      });
      const response = await fetch(`/api/daily-tasks/consultant?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch tasks");
      return response.json();
    },
    enabled: !!selectedClientId,
  });

  // Fetch ALL reflections for selected client (no date filtering - let client-side handle it)
  const { data: reflections = [] } = useQuery<DailyReflection[]>({
    queryKey: [
      "/api/daily-reflections/consultant",
      selectedClientId,
    ],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const params = new URLSearchParams({
        clientId: selectedClientId,
      });
      const response = await fetch(`/api/daily-reflections/consultant?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch reflections");
      return response.json();
    },
    enabled: !!selectedClientId,
  });

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}

      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
          {/* Navigation Tabs */}
          <NavigationTabs
            tabs={[
              { label: "Clienti", href: "/consultant/clients", icon: Users },
              { label: "Stato Cliente", href: "/consultant/client-state", icon: Target },
              { label: "Feedback", href: "/consultant/client-daily", icon: CheckSquare },
            ]}
          />

          {/* Enhanced Hero Section */}
          <div className="mb-8 relative overflow-hidden rounded-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 opacity-10"></div>
            <div className="relative bg-gradient-to-br from-background/95 to-muted/50 backdrop-blur-sm border border-border/50 p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-2xl md:text-3xl font-heading font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 bg-clip-text text-transparent">
                        Task & Feedback Clienti
                      </h1>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-base">
                    Monitora in tempo reale le attività e le riflessioni giornaliere dei tuoi clienti
                  </p>
                </div>

                <div className="flex flex-col gap-2 min-w-[200px]">
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">Clienti Attivi</span>
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">{clients.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Task Monitorate</span>
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{tasks.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ClientTasksView
              clients={clients}
              tasks={tasks}
              selectedClientId={selectedClientId}
              onClientChange={setSelectedClientId}
            />

            <ReflectionHistory
              clients={clients}
              reflections={reflections}
              selectedClientId={selectedClientId}
              onClientChange={setSelectedClientId}
            />
          </div>
        </main>
      </div>
      <ConsultantAIAssistant />
    </div>
  );
}