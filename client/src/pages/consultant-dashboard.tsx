import { useState, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  CheckCircle, 
  PieChart, 
  CalendarDays, 
  Plus, 
  UserPlus, 
  CalendarPlus,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Play,
  Trophy,
  Medal,
  Star,
  MessageCircle,
  BarChart3,
  Activity,
  GraduationCap,
  Target,
  Calendar,
  AlertTriangle
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import ExerciseForm from "@/components/exercise-form";
import ActivityDashboard from "@/components/activity-dashboard";
import UniversityOverview from "@/components/university-overview";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { ClientsNeedAttention } from "@/components/ClientsNeedAttention";
import { TopPerformers } from "@/components/TopPerformers";
import { LeadPipelineView } from "@/components/LeadPipelineView";
import { StatsOverview } from "@/components/StatsOverview";
import { PageLoader } from "@/components/page-loader";
import { InteractiveIntroBanner } from "@/components/onboarding/InteractiveIntroBanner";
import { useClientPriorityScore } from "@/hooks/useClientPriorityScore";
import { apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoleSwitch } from "@/hooks/use-role-switch";
import { type Exercise, type ExerciseAssignment, type User } from "@shared/schema";
import { useLocation } from "wouter";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AnalyticsDashboard = lazy(() => import("@/components/analytics-dashboard"));


export default function ConsultantDashboard() {
  const isMobile = useIsMobile();
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("active");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();

  // Client-centric priority scoring system (3 livelli)
  const {
    highPriorityClients,
    mediumPriorityClients,
    lowPriorityClients,
    topPerformers,
    hasError: priorityError,
    error: priorityErrorDetails,
  } = useClientPriorityScore();

  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ["/api/stats/consultant"],
    queryFn: async () => {
      const response = await fetch("/api/stats/consultant", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  // Fetch consultant's exercises
  const { data: exercises = [] } = useQuery({
    queryKey: ["/api/exercises"],
    queryFn: async () => {
      const response = await fetch("/api/exercises", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch exercises");
      return response.json();
    },
  });

  // Fetch exercise assignments
  const { data: assignments = [] } = useQuery<any[]>({
    queryKey: ["/api/exercise-assignments/consultant"],
  });

  // Fetch clients
  const { data: clients = [], isLoading: clientsLoading } = useQuery<User[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  // Fetch university stats for all clients
  const { data: universityStats = [] } = useQuery<any[]>({
    queryKey: ["/api/university/stats/overview"],
  });

  // Fetch active sessions for real-time status
  const { data: activeSessions } = useQuery<any[]>({
    queryKey: ["/api/sessions/active"],
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Check interactive intro onboarding status
  const { data: interactiveIntroStatus } = useQuery<{
    success: boolean;
    data: { completed: boolean; completedAt: string | null; responses: any };
  }>({
    queryKey: ["/api/consultant/onboarding/interactive-intro/status"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const showInteractiveIntroBanner = interactiveIntroStatus?.data?.completed === false;

  // Create exercise mutation
  const createExerciseMutation = useMutation({
    mutationFn: async ({ exerciseData, files }: { exerciseData: any, files: File[] }) => {
      const formData = new FormData();

      // Add exercise data
      Object.entries(exerciseData).forEach(([key, value]) => {
        if (key === 'questions') {
          formData.append(key, JSON.stringify(value));
        } else if (key === 'selectedClients') {
          formData.append(key, JSON.stringify(value));
        } else if (key === 'attachments') {
          // Skip attachments here, they're handled separately
        } else if (value !== null && value !== undefined) {
          formData.append(key, value as string);
        }
      });

      // Add files
      files.forEach(file => {
        formData.append('attachments', file);
      });

      const response = await fetch("/api/exercises", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create exercise");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-assignments/consultant"] });
      setShowExerciseForm(false);
      toast({
        title: "Successo",
        description: data.message || "Esercizio creato e assegnato con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la creazione dell'esercizio",
        variant: "destructive",
      });
    },
  });

  const handleCreateExercise = (exerciseData: any, files: File[]) => {
    createExerciseMutation.mutate({ exerciseData, files });
  };

  // Get recent activity from assignments
  const recentActivity = assignments
    .sort((a: any, b: any) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime())
    .slice(0, 4);

  // Top performing clients
  const topClients = assignments.reduce((acc: any[], assignment: any) => {
    const existing = acc.find(c => c.id === assignment.client.id);
    if (existing) {
      existing.totalAssignments++;
      if (assignment.status === 'completed') existing.completedAssignments++;
    } else {
      acc.push({
        ...assignment.client,
        totalAssignments: 1,
        completedAssignments: assignment.status === 'completed' ? 1 : 0,
      });
    }
    return acc;
  }, [])
  .map((client: any) => ({
    ...client,
    completionRate: client.totalAssignments > 0 ? (client.completedAssignments / client.totalAssignments) * 100 : 0,
  }))
  .sort((a: any, b: any) => b.completionRate - a.completionRate)
  .slice(0, 3);

  // Filter clients based on search and status
  const filteredClients = clients.filter(client => {
    const matchesSearch = 
      client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      filterStatus === "all" ? true :
      filterStatus === "active" ? client.isActive :
      !client.isActive;

    return matchesSearch && matchesStatus;
  });

  // Check if client is currently active (based on activity sessions)
  const isClientActive = (clientId: string) => {
    const clientSession = activeSessions?.find(s => s.userId === clientId);
    if (!clientSession) return false;

    const lastActivity = new Date(clientSession.lastActivity);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

    return diffMinutes < 10; // Active if last activity was less than 10 minutes ago
  };

  if (showExerciseForm) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex h-[calc(100vh-80px)]">
          <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showRoleSwitch={showRoleSwitch} currentRole={currentRole} onRoleSwitch={handleRoleSwitch} />
          <div className="flex-1 p-4 md:p-6 overflow-y-auto">
            <div className="flex justify-center">
              <ExerciseForm
                onSubmit={handleCreateExercise}
                onCancel={() => setShowExerciseForm(false)}
                isLoading={createExerciseMutation.isPending}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="consultant-dashboard">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showRoleSwitch={showRoleSwitch} currentRole={currentRole} onRoleSwitch={handleRoleSwitch} />

        <div className="flex-1 p-6 overflow-y-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
              Dashboard Consulente
            </h1>
            <p className="text-muted-foreground">
              Monitora i progressi dei tuoi clienti e gestisci gli esercizi
            </p>
          </div>

          {/* Interactive Intro Banner - Shows if onboarding not completed */}
          {showInteractiveIntroBanner && <InteractiveIntroBanner />}

          {/* Main Dashboard Tabs */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="overview" className="flex items-center space-x-2" data-testid="tab-dashboard-overview">
                <Activity size={18} />
                <span>Panoramica</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center space-x-2" data-testid="tab-dashboard-activity">
                <Users size={18} />
                <span>Attività Clienti</span>
              </TabsTrigger>
              <TabsTrigger value="university" className="flex items-center space-x-2" data-testid="tab-dashboard-university">
                <Trophy size={18} />
                <span>Università</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab Content - CLIENT-CENTRIC */}
            <TabsContent value="overview" className="space-y-8">
              
              {/* Error state for priority scoring */}
              {priorityError && priorityErrorDetails && (
                <Card className="border-red-500/50 bg-red-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <p className="text-sm font-medium text-red-600">
                        Impossibile caricare dati priorità clienti: {priorityErrorDetails.source}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {priorityErrorDetails.message}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Clients Need Attention Section - 3 livelli */}
              <ClientsNeedAttention
                highPriorityClients={highPriorityClients}
                mediumPriorityClients={mediumPriorityClients}
                lowPriorityClients={lowPriorityClients}
              />

              {/* Grid: Top Performers + Lead Pipeline */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TopPerformers topPerformers={topPerformers} />
                <LeadPipelineView />
              </div>

              {/* Stats Overview at the bottom */}
              <StatsOverview />

              {/* Old Stats Cards - Keeping for reference but hidden */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 hidden">
            <Card data-testid="stat-active-clients">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Clienti Attivi</p>
                    <p className="text-3xl font-bold text-foreground" data-testid="text-active-clients">
                      {stats?.activeClients || clients.length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Users className="text-primary" size={24} />
                  </div>
                </div>
                <div className="flex items-center mt-4 text-sm">
                  <TrendingUp className="text-success mr-1" size={16} />
                  <span className="text-success">+2.5%</span>
                  <span className="text-muted-foreground ml-2">vs mese scorso</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="stat-completed-exercises">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Esercizi Completati</p>
                    <p className="text-3xl font-bold text-foreground" data-testid="text-completed-exercises">
                      {stats?.completedExercises || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                    <CheckCircle className="text-success" size={24} />
                  </div>
                </div>
                <div className="flex items-center mt-4 text-sm">
                  <TrendingUp className="text-success mr-1" size={16} />
                  <span className="text-success">+12%</span>
                  <span className="text-muted-foreground ml-2">questa settimana</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="stat-completion-rate">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tasso Completamento</p>
                    <p className="text-3xl font-bold text-foreground" data-testid="text-completion-rate">
                      {stats?.completionRate || 0}%
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                    <PieChart className="text-secondary" size={24} />
                  </div>
                </div>
                <div className="flex items-center mt-4 text-sm">
                  <TrendingUp className="text-success mr-1" size={16} />
                  <span className="text-success">+5%</span>
                  <span className="text-muted-foreground ml-2">vs media</span>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="stat-today-consultations">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Consulenze Oggi</p>
                    <p className="text-3xl font-bold text-foreground" data-testid="text-today-consultations">
                      {stats?.todayConsultations || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <CalendarDays className="text-accent" size={24} />
                  </div>
                </div>
                <div className="flex items-center mt-4 text-sm">
                  <span className="text-muted-foreground">2 in programma</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Client Activity */}
            <div className="lg:col-span-2">
              <Card data-testid="card-recent-activity">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-heading">Attività Recente Clienti</CardTitle>
                    <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                      Vedi tutto
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users size={48} className="mx-auto mb-4 opacity-50" />
                        <p>Nessuna attività recente</p>
                        <p className="text-sm">Le attività dei clienti appariranno qui</p>
                      </div>
                    ) : (
                      recentActivity.map((assignment: any, index: number) => (
                        <div 
                          key={assignment.id} 
                          className="flex items-center space-x-4 p-4 hover:bg-muted/50 rounded-lg transition-colors"
                          data-testid={`activity-item-${index}`}
                        >
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={assignment.client.avatar} />
                            <AvatarFallback>
                              {assignment.client.firstName[0]}{assignment.client.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {assignment.client.firstName} {assignment.client.lastName} ha ricevuto "{assignment.exercise.title}"
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(assignment.assignedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className={`${
                            assignment.status === 'completed' ? 'text-success' : 
                            assignment.status === 'in_progress' ? 'text-accent' : 'text-primary'
                          }`}>
                            {assignment.status === 'completed' ? <CheckCircle size={20} /> :
                             assignment.status === 'in_progress' ? <Play size={20} /> :
                             <MessageCircle size={20} />}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions & Top Clients */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <Card data-testid="card-quick-actions">
                <CardHeader>
                  <CardTitle className="text-lg font-heading">Azioni Rapide</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button 
                      className="w-full justify-center" 
                      onClick={() => setShowExerciseForm(true)}
                      data-testid="button-create-exercise"
                    >
                      <Plus size={18} className="mr-2" />
                      Crea Esercizio
                    </Button>

                    <Button variant="secondary" className="w-full justify-center" asChild>
                      <a href="/consultant/clients">
                        <Users size={18} className="mr-2" />
                        Visualizza Clienti
                      </a>
                    </Button>

                    <Button variant="outline" className="w-full justify-center" data-testid="button-schedule-consultation">
                      <CalendarPlus size={18} className="mr-2" />
                      Pianifica Consulenza
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Top Clients */}
              <Card data-testid="card-top-clients">
                <CardHeader>
                  <CardTitle className="text-lg font-heading">Top Clienti del Mese</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topClients.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        <Trophy size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nessun cliente attivo</p>
                      </div>
                    ) : (
                      topClients.map((client: any, index: number) => (
                        <div key={client.id} className="flex items-center space-x-3" data-testid={`top-client-${index}`}>
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={client.avatar} />
                            <AvatarFallback className="text-xs">
                              {client.firstName[0]}{client.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {client.firstName} {client.lastName[0]}.
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {Math.round(client.completionRate)}% completamento
                            </p>
                          </div>
                          <div className={`${
                            index === 0 ? 'text-success' : 
                            index === 1 ? 'text-secondary' : 'text-accent'
                          }`}>
                            {index === 0 ? <Trophy size={16} /> :
                             index === 1 ? <Medal size={16} /> :
                             <Star size={16} />}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

        </TabsContent>

        {/* University Tab Content */}
        <TabsContent value="university" className="space-y-6">
          <UniversityOverview />
        </TabsContent>

        {/* Activity Monitoring Tab Content */}
        <TabsContent value="activity">
          <ActivityDashboard />
        </TabsContent>
      </Tabs>
    </div>
  </div>
  <ConsultantAIAssistant />
</div>
);
}