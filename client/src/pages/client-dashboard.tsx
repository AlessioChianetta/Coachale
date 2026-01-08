import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CheckCircle,
  Flame,
  Calendar,
  Target,
  Play,
  Clock,
  BookOpen,
  TrendingUp,
  FileText,
  Map,
  Library,
  GraduationCap,
  Sparkles,
  Menu,
  AlertCircle,
  Mail,
  LogOut,
  Search,
  Bell,
  ArrowRight,
  ChevronRight,
  Award,
  MessageCircle,
  Activity,
  RotateCcw,
  Settings,
  Gift
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders, getAuthUser, logout } from "@/lib/auth";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoleSwitch } from "@/hooks/use-role-switch";
import BadgeDisplay from "@/components/BadgeDisplay";
import { usePageContext } from "@/hooks/use-page-context";
import { useToast } from "@/hooks/use-toast";
import { useTour } from "@/contexts/TourContext";
import { PlayCircle } from "lucide-react";
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { driverConfig } from '@/lib/tour/driver-config';
import { dashboardTourSteps } from '@/components/interactive-tour/dashboard-tour-steps';
import { AlessiaCard } from "@/components/alessia/AlessiaCard";
import { format, parseISO, isThisWeek } from "date-fns";
import { it } from "date-fns/locale";

interface NavigationSection {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  count?: number;
  badge?: string;
}

interface KPICard {
  title: string;
  value: number | string;
  icon: React.ComponentType<any>;
  color: string;
  bgGradient: string;
}

export default function ClientDashboard() {
  const isMobile = useIsMobile();
  const user = getAuthUser();
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const { toast } = useToast();
  const { startTour, hasCompletedTour } = useTour();
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();
  const pageContext = usePageContext();

  const handleStartPlatformTour = () => {
    if (isMobile) {
      setSidebarOpen(true);
      setTimeout(() => {
        startTour();
      }, 300);
    } else {
      startTour();
    }
  };

  const { data: stats } = useQuery({
    queryKey: ["/api/stats/client"],
    queryFn: async () => {
      const response = await fetch("/api/stats/client", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["/api/exercise-assignments/client", { isExam: false }],
    queryFn: async () => {
      const response = await fetch("/api/exercise-assignments/client?isExam=false", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch assignments");
      return response.json();
    },
  });

  const { data: consultations = [] } = useQuery({
    queryKey: ["/api/consultations/client"],
    queryFn: async () => {
      const response = await fetch("/api/consultations/client", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch consultations");
      return response.json();
    },
  });

  const { data: dailyTasks = [] } = useQuery({
    queryKey: ["/api/daily-tasks/client"],
    queryFn: async () => {
      const response = await fetch("/api/daily-tasks/client", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch daily tasks");
      return response.json();
    },
  });

  const { data: badges = [] } = useQuery({
    queryKey: ["/api/badges/client"],
    queryFn: async () => {
      const response = await fetch("/api/badges/client", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const handleStartExercise = (exerciseId: string, assignmentId?: string) => {
    setLocation(`/exercise/${exerciseId}${assignmentId ? `?assignment=${assignmentId}` : ''}`);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buongiorno";
    if (hour < 18) return "Buon pomeriggio";
    return "Buonasera";
  };

  const completedExercises = useMemo(() => {
    return assignments.filter((a: any) => a.status === 'completed');
  }, [assignments]);

  const pendingExercises = useMemo(() => {
    return assignments.filter((a: any) => a.status === 'pending' || a.status === 'in_progress');
  }, [assignments]);

  const upcomingConsultations = useMemo(() => {
    const now = new Date();
    return consultations
      .filter((c: any) => new Date(c.scheduledAt) > now)
      .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [consultations]);

  const nextConsultation = upcomingConsultations[0];

  const exerciseProgress = useMemo(() => {
    const total = assignments.length;
    const completed = completedExercises.length;
    const pending = pendingExercises.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, percentage };
  }, [assignments.length, completedExercises.length, pendingExercises.length]);

  const recentCompletedExercises = useMemo(() => {
    return completedExercises
      .filter((a: any) => a.completedAt)
      .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, 3);
  }, [completedExercises]);

  const kpiCards: KPICard[] = useMemo(() => [
    {
      title: "Esercizi Completati",
      value: completedExercises.length,
      icon: CheckCircle,
      color: "text-emerald-600",
      bgGradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    },
    {
      title: "Streak Attuale",
      value: `${stats?.streak || 0} giorni`,
      icon: Flame,
      color: "text-orange-600",
      bgGradient: "from-orange-500/10 via-orange-500/5 to-transparent",
    },
    {
      title: "Prossima Consulenza",
      value: nextConsultation 
        ? format(new Date(nextConsultation.scheduledAt), "dd MMM", { locale: it })
        : "Nessuna",
      icon: Calendar,
      color: "text-blue-600",
      bgGradient: "from-blue-500/10 via-blue-500/5 to-transparent",
    },
    {
      title: "Badge Guadagnati",
      value: badges.length || 0,
      icon: Award,
      color: "text-purple-600",
      bgGradient: "from-purple-500/10 via-purple-500/5 to-transparent",
    },
  ], [completedExercises.length, stats?.streak, nextConsultation, badges.length]);

  const quickActions = [
    { 
      name: "Esercizi", 
      icon: FileText, 
      onClick: () => setLocation("/client/exercises"),
      gradient: "from-purple-500 to-pink-600"
    },
    { 
      name: "Libreria", 
      icon: Library, 
      onClick: () => setLocation("/client/library"),
      gradient: "from-blue-500 to-cyan-600"
    },
    { 
      name: "Roadmap", 
      icon: Map, 
      onClick: () => setLocation("/client/roadmap"),
      gradient: "from-green-500 to-emerald-600"
    },
    { 
      name: "Consulenze", 
      icon: MessageCircle, 
      onClick: () => setLocation("/client/consultations"),
      gradient: "from-orange-500 to-red-600"
    },
  ];

  const navigationSections: NavigationSection[] = [
    { 
      name: "Università", 
      href: "/client/university", 
      icon: GraduationCap, 
      color: "text-blue-500",
      bgColor: "bg-blue-500/10 hover:bg-blue-500/20",
    },
    { 
      name: "Esercizi", 
      href: "/client/exercises", 
      icon: FileText, 
      color: "text-purple-500",
      bgColor: "bg-purple-500/10 hover:bg-purple-500/20",
      count: pendingExercises.length
    },
    { 
      name: "Libreria", 
      href: "/client/library", 
      icon: Library, 
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20",
    },
    { 
      name: "Roadmap", 
      href: "/client/roadmap", 
      icon: Map, 
      color: "text-orange-500",
      bgColor: "bg-orange-500/10 hover:bg-orange-500/20",
    },
    { 
      name: "Calendario", 
      href: "/client/calendar", 
      icon: Calendar, 
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10 hover:bg-cyan-500/20",
    },
    { 
      name: "AI Assistant", 
      href: "/client/ai-assistant", 
      icon: Sparkles, 
      color: "text-fuchsia-500",
      bgColor: "bg-fuchsia-500/10 hover:bg-fuchsia-500/20",
      badge: "AI"
    },
    { 
      name: "Consulenze", 
      href: "/client/consultations", 
      icon: MessageCircle, 
      color: "text-pink-500",
      bgColor: "bg-pink-500/10 hover:bg-pink-500/20",
    },
    { 
      name: "FAQ & Guide", 
      href: "/client/faq", 
      icon: BookOpen, 
      color: "text-amber-500",
      bgColor: "bg-amber-500/10 hover:bg-amber-500/20",
    },
    { 
      name: "Impostazioni", 
      href: "/client/settings", 
      icon: Settings, 
      color: "text-gray-500",
      bgColor: "bg-gray-500/10 hover:bg-gray-500/20",
    },
  ];

  const formatAppointmentTime = (consultation: any) => {
    try {
      const date = new Date(consultation.scheduledAt);
      return format(date, "dd MMM, HH:mm", { locale: it });
    } catch {
      return "Data non disponibile";
    }
  };

  const startDashboardTour = () => {
    setIsTourActive(true);
    const driverObj = driver({
      ...driverConfig,
      onDestroyed: () => {
        setIsTourActive(false);
      },
    });
    driverObj.setSteps(dashboardTourSteps);
    driverObj.drive();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20" data-testid="client-dashboard">
      <div className="flex h-screen">
        <Sidebar 
          role="client" 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
          showRoleSwitch={showRoleSwitch} 
          currentRole={currentRole} 
          onRoleSwitch={handleRoleSwitch} 
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            
            {user?.isActive === false ? (
              <div className="max-w-4xl mx-auto mt-12">
                <div className="rounded-2xl overflow-hidden shadow-2xl border-2 border-orange-400 bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 dark:from-orange-950/20 dark:via-amber-950/20 dark:to-yellow-950/20">
                  <div className="p-8 md:p-12">
                    <div className="flex flex-col items-center text-center gap-6">
                      <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-600 rounded-3xl flex items-center justify-center shadow-2xl">
                        <AlertCircle className="w-12 h-12 text-white" />
                      </div>
                      <div>
                        <h2 className="text-3xl md:text-4xl font-bold text-orange-900 dark:text-orange-100 mb-4">
                          Account in Attesa di Attivazione
                        </h2>
                        <p className="text-orange-800 dark:text-orange-200 text-lg md:text-xl leading-relaxed max-w-2xl">
                          Il tuo profilo è stato creato con successo ma necessita dell'attivazione da parte del tuo consulente.
                        </p>
                      </div>
                      <div className="flex flex-col gap-4 w-full max-w-md">
                        <div className="flex items-center gap-3 text-orange-700 dark:text-orange-300 bg-white/70 dark:bg-gray-800/30 px-6 py-4 rounded-xl shadow-md">
                          <Mail className="w-5 h-5 flex-shrink-0" />
                          <span className="font-medium">Contatta il tuo consulente per l'attivazione</span>
                        </div>
                        <Button
                          onClick={logout}
                          variant="outline"
                          className="w-full border-2 border-orange-300 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-300 font-semibold gap-2"
                        >
                          <LogOut className="w-5 h-5" />
                          Esci dall'Account
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSidebarOpen(true)}
                      className="md:hidden"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                    <span className="text-3xl">👋</span>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                        {getGreeting()}, {user?.firstName || 'Utente'}
                      </h1>
                      <p className="text-muted-foreground text-sm">
                        Ecco il tuo percorso di crescita personale
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="relative"
                      onClick={() => setLocation("/client/faq")}
                    >
                      <Bell className="h-5 w-5" />
                    </Button>
                    <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                      <AvatarImage src={user?.avatar || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-white font-semibold">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>

                {/* Referral Banner */}
                <button
                  onClick={() => setLocation("/client/referral")}
                  className="w-full group relative overflow-hidden rounded-xl p-4 text-left transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 opacity-90 group-hover:opacity-100 transition-opacity" />
                  <div className="relative z-10 flex items-center justify-between text-white">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white/20">
                        <Gift className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">Invita un Amico</p>
                        <p className="text-sm text-white/80">Condividi il tuo percorso e ottieni vantaggi esclusivi</p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </button>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {kpiCards.map((kpi, index) => (
                    <Card 
                      key={index}
                      className={cn(
                        "relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]",
                        `bg-gradient-to-br ${kpi.bgGradient}`
                      )}
                    >
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="text-xs sm:text-sm font-medium text-muted-foreground">{kpi.title}</p>
                            <p className="text-2xl sm:text-3xl font-bold tracking-tight">{kpi.value}</p>
                          </div>
                          <div className={cn(
                            "p-2 sm:p-3 rounded-xl bg-background/50 backdrop-blur-sm shadow-sm",
                          )}>
                            <kpi.icon className={cn("h-5 w-5 sm:h-6 sm:w-6", kpi.color)} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="relative group">
                  <div 
                    className="w-full cursor-pointer"
                    onClick={() => setLocation("/client/ai-assistant")}
                  >
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/20 via-purple-500/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="relative bg-card border border-border/50 rounded-2xl p-4 sm:p-5 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-primary/30">
                        <p className="text-base sm:text-lg text-muted-foreground mb-2">
                          Cosa vuoi fare oggi?
                        </p>
                        <div className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3 border border-border/50">
                          <Search className="h-5 w-5 text-muted-foreground" />
                          <span className="text-muted-foreground flex-1">Cerca o chiedi all'AI...</span>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded-lg border">
                            <Sparkles className="h-3 w-3 text-fuchsia-500" />
                            <span>AI</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <AlessiaCard />

                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Azioni Rapide
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {quickActions.map((action, index) => (
                      <button
                        key={index}
                        onClick={action.onClick}
                        className="group relative overflow-hidden rounded-xl p-4 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <div className={cn(
                          "absolute inset-0 bg-gradient-to-br opacity-90 group-hover:opacity-100 transition-opacity",
                          action.gradient
                        )} />
                        <div className="relative z-10 text-white">
                          <action.icon className="h-6 w-6 mb-2" />
                          <p className="font-medium text-sm">{action.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500/5 to-transparent">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <Activity className="h-4 w-4 text-blue-500" />
                          Attività Recente
                        </CardTitle>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs"
                          onClick={() => setLocation("/client/exercises")}
                        >
                          Vedi tutti
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {recentCompletedExercises.length > 0 ? (
                        recentCompletedExercises.map((assignment: any) => (
                          <div 
                            key={assignment.id}
                            className="flex items-center gap-3 p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-colors"
                          >
                            <div className="p-2 rounded-lg bg-green-500/10">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {assignment.exercise?.title || 'Esercizio'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Completato
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nessuna attività recente</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500/5 to-transparent">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-purple-500" />
                          Prossimi Appuntamenti
                        </CardTitle>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs"
                          onClick={() => setLocation("/client/consultations")}
                        >
                          Vedi tutti
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {upcomingConsultations.length > 0 ? (
                        upcomingConsultations.slice(0, 3).map((consultation: any) => (
                          <div 
                            key={consultation.id}
                            className="flex items-center gap-3 p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-colors cursor-pointer"
                            onClick={() => setLocation("/client/consultations")}
                          >
                            <div className="p-2 rounded-lg bg-purple-500/10">
                              <Calendar className="h-4 w-4 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                Consulenza con {consultation.consultant?.firstName || 'Consulente'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatAppointmentTime(consultation)}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nessun appuntamento in programma</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500/5 to-transparent">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                          Trend Esercizi
                        </CardTitle>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs"
                          onClick={() => setLocation("/client/exercises")}
                        >
                          Dettagli
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Completamento</span>
                          <span className="font-semibold">{exerciseProgress.percentage}%</span>
                        </div>
                        <Progress value={exerciseProgress.percentage} className="h-2" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-emerald-500/10">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                            <span className="text-xs text-muted-foreground">Completati</span>
                          </div>
                          <p className="text-xl font-bold text-emerald-600">{exerciseProgress.completed}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-500/10">
                          <div className="flex items-center gap-2 mb-1">
                            <RotateCcw className="h-4 w-4 text-amber-600" />
                            <span className="text-xs text-muted-foreground">In Attesa</span>
                          </div>
                          <p className="text-xl font-bold text-amber-600">{exerciseProgress.pending}</p>
                        </div>
                      </div>

                      <div className="text-center pt-2">
                        <p className="text-xs text-muted-foreground">
                          Totale: <span className="font-medium">{exerciseProgress.total}</span> esercizi assegnati
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="mb-6">
                  <BadgeDisplay />
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Tutte le Sezioni
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {navigationSections.map((section, index) => (
                      <button
                        key={index}
                        onClick={() => setLocation(section.href)}
                        className={cn(
                          "group relative flex flex-col items-center justify-center p-4 sm:p-5 rounded-xl border border-border/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
                          section.bgColor
                        )}
                      >
                        <div className={cn(
                          "p-3 rounded-xl mb-2 transition-transform duration-300 group-hover:scale-110",
                          section.bgColor.replace("hover:", "")
                        )}>
                          <section.icon className={cn("h-6 w-6", section.color)} />
                        </div>
                        <span className="text-sm font-medium text-center">{section.name}</span>
                        {section.count !== undefined && section.count > 0 && (
                          <Badge variant="secondary" className="mt-1.5 text-xs">
                            {section.count}
                          </Badge>
                        )}
                        {section.badge && (
                          <Badge className="mt-1.5 text-xs bg-gradient-to-r from-primary to-primary/80">
                            {section.badge}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-8" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
