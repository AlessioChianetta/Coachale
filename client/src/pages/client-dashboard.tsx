import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Flame,
  Calendar,
  Target,
  Play,
  Clock,
  BookOpen,
  Lightbulb,
  TrendingUp,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Award,
  FileText,
  Map,
  Library,
  GraduationCap,
  Sparkles,
  Zap,
  Menu,
  AlertCircle,
  Mail,
  LogOut
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { getAuthHeaders, getAuthUser, logout } from "@/lib/auth";
import { useLocation } from "wouter";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoleSwitch } from "@/hooks/use-role-switch";
import BadgeDisplay from "@/components/BadgeDisplay";
import { usePageContext } from "@/hooks/use-page-context";
import { triggerOpenAlessia } from "@/components/ai-assistant/ClientFloatingAssistant";
import { useToast } from "@/hooks/use-toast";
import { useTour } from "@/contexts/TourContext";
import { PlayCircle, RotateCcw } from "lucide-react";
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { driverConfig } from '@/lib/tour/driver-config';
import { dashboardTourSteps } from '@/components/interactive-tour/dashboard-tour-steps';

export default function ClientDashboard() {
  const isMobile = useIsMobile();
  const user = getAuthUser();
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const { toast } = useToast();
  const { startTour, hasCompletedTour } = useTour();
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();

  // Wrapper per startTour che apre la sidebar prima di iniziare
  const handleStartPlatformTour = () => {
    // Su mobile, apri la sidebar prima di iniziare il tour
    if (isMobile) {
      setSidebarOpen(true);
      // Piccolo delay per permettere alla sidebar di aprirsi completamente
      setTimeout(() => {
        startTour();
      }, 300);
    } else {
      // Su desktop la sidebar è sempre visibile
      startTour();
    }
  };

  // AI Assistant context
  const pageContext = usePageContext();

  // Fetch dashboard stats
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

  // Fetch assigned exercises (excluding exams)
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

  // Fetch consultations
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

  // Fetch daily tasks
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

  // Fetch reflections for today
  const { data: reflections = [] } = useQuery({
    queryKey: ["/api/daily-reflections"],
    queryFn: async () => {
      const response = await fetch("/api/daily-reflections", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch reflections");
      return response.json();
    },
  });

  const handleStartExercise = (exerciseId: string, assignmentId?: string) => {
    setLocation(`/exercise/${exerciseId}${assignmentId ? `?assignment=${assignmentId}` : ''}`);
  };

  // Get next action (most urgent item)
  const getNextAction = () => {
    const pending = assignments.filter((a: any) => a.status === 'pending' || a.status === 'in_progress');
    const todayTasks = dailyTasks.filter((t: any) => t.status !== 'completed');

    if (pending.length > 0) {
      const next = pending[0];
      return {
        type: 'exercise',
        title: next.exercise.title,
        description: next.exercise.description,
        duration: next.exercise.estimatedDuration,
        id: next.exercise.id,
        assignmentId: next.id,
        icon: '💪'
      };
    }

    if (todayTasks.length > 0) {
      return {
        type: 'task',
        title: todayTasks[0].title,
        description: todayTasks[0].description,
        id: todayTasks[0].id,
        icon: '✅'
      };
    }

    return null;
  };

  const nextAction = getNextAction();

  // Calculate today's progress
  const todayCompleted = assignments.filter((a: any) => {
    if (a.status !== 'completed' || !a.completedAt) return false;
    const completedDate = new Date(a.completedAt);
    const today = new Date();
    return completedDate.toDateString() === today.toDateString();
  }).length + dailyTasks.filter((t: any) => t.status === 'completed').length;

  const todayTotal = assignments.filter((a: any) =>
    a.status === 'pending' || a.status === 'in_progress' || a.status === 'completed'
  ).length + dailyTasks.length;

  const todayProgress = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

  // Get upcoming consultation
  const upcomingConsultations = consultations
    .filter((c: any) => new Date(c.scheduledAt) > new Date())
    .sort((a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const nextConsultation = upcomingConsultations[0];

  // Get today's reflection
  const todayReflection = reflections.find((r: any) => {
    const reflectionDate = new Date(r.date);
    const today = new Date();
    return reflectionDate.toDateString() === today.toDateString();
  });

  // Contextual greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buongiorno";
    if (hour < 18) return "Buon pomeriggio";
    return "Buonasera";
  };

  const getContextualMessage = () => {
    const hour = new Date().getHours();
    if (hour < 12 && nextAction) return "Ecco il tuo piano per oggi";
    if (hour >= 12 && hour < 18) return "Continua così, sei sulla buona strada!";
    if (hour >= 18 && todayCompleted > 0) return `Ottimo lavoro! Hai completato ${todayCompleted} attività`;
    if (!nextAction) return "Goditi questo momento di pausa";
    return "Scopri i tuoi progressi";
  };

  // Dashboard-specific tour (for dashboard cards)
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900" data-testid="client-dashboard">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showRoleSwitch={showRoleSwitch} currentRole={currentRole} onRoleSwitch={handleRoleSwitch} />

        <div className="flex-1 overflow-y-auto bg-transparent">
          {/* Integrated Header with Menu Button */}
          <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
            <div className="px-4 md:px-8 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                  className="hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg">
                    <GraduationCap className="h-5 w-5 text-white" />
                  </div>
                  <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
                    Dashboard
                  </h1>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={startDashboardTour}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="hidden md:inline">Guida Dashboard</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleStartPlatformTour}
                  className="gap-2"
                >
                  <PlayCircle className="h-4 w-4" />
                  <span className="hidden md:inline">Guida Tour</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-8">
            {/* Banner Account Non Attivo - SE NON ATTIVO MOSTRA SOLO QUESTO */}
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
                          Il tuo profilo è stato creato con successo ma necessita dell'attivazione da parte del tuo consulente per accedere a tutte le funzionalità della piattaforma.
                        </p>
                      </div>
                      <div className="flex flex-col gap-4 w-full max-w-md">
                        <div className="flex items-center gap-3 text-orange-700 dark:text-orange-300 bg-white/70 dark:bg-gray-800/30 px-6 py-4 rounded-xl shadow-md">
                          <Mail className="w-5 h-5 flex-shrink-0" />
                          <span className="font-medium">Contatta il tuo consulente per l'attivazione</span>
                        </div>
                        <div className="flex items-center gap-3 text-orange-700 dark:text-orange-300 bg-white/70 dark:bg-gray-800/30 px-6 py-4 rounded-xl shadow-md">
                          <Sparkles className="w-5 h-5 flex-shrink-0" />
                          <span className="font-medium">Una volta attivato, accederai a esercizi, università e molto altro</span>
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
                  <div className="bg-orange-100 dark:bg-orange-900/40 px-8 py-4 border-t border-orange-200 dark:border-orange-800">
                    <p className="text-center text-sm text-orange-700 dark:text-orange-300 font-medium">
                      📧 Nel frattempo, verifica la tua casella email per eventuali comunicazioni dal tuo consulente
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
            {/* Hero Greeting Migliorato */}
            <div className="mb-8">
              <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-6 lg:p-8 text-white shadow-2xl relative overflow-hidden" data-tour="dashboard-hero-greeting">
                <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
                <div className="relative z-10">
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-3">
                    {getGreeting()}, {user?.firstName}! 🌟
                  </h1>
                  <p className="text-white/90 text-base md:text-xl font-medium">
                    {getContextualMessage()}
                  </p>
                </div>
              </div>
            </div>


          {/* Tutorial Button - Prominente all'inizio */}
          <Card className="mb-6 overflow-hidden border-2 border-blue-500 shadow-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20" data-tour="dashboard-tutorial-card">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg">
                  <BookOpen className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    📚 Guida & Tutorial Completo
                  </h2>
                  <p className="text-gray-700 dark:text-gray-300 text-base md:text-lg mb-4">
                    Impara ad usare ogni funzionalità della piattaforma con guide dettagliate passo-passo. 
                    Tutorial completi per Università, Esercizi, AI Assistant, Task, Corsi e molto altro.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      size="lg"
                      onClick={() => setLocation('/client/faq')}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold shadow-xl hover:shadow-2xl transition-all duration-300"
                    >
                      <BookOpen className="mr-2 h-5 w-5" />
                      Vai al Tutorial Completo
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => setLocation('/client/faq')}
                      className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-semibold"
                    >
                      Scopri di più →
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <GraduationCap className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Università</p>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <FileText className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Esercizi</p>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <Sparkles className="h-6 w-6 mx-auto mb-2 text-pink-600" />
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">AI Assistant</p>
                </div>
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <Library className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">E altro...</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parla con Alessia - AI Assistant Card */}
          <Card className="mb-6 overflow-hidden border-2 border-pink-400 shadow-2xl bg-gradient-to-br from-pink-50 via-purple-50 to-fuchsia-50 dark:from-pink-950/20 dark:via-purple-950/20 dark:to-fuchsia-950/20" data-tour="dashboard-alessia-card">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl shadow-lg">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Parla con Alessia
                  </h2>
                  <p className="text-gray-700 dark:text-gray-300 text-base md:text-lg mb-4">
                    Hai domande? Alessia è la tua assistente AI personale, sempre disponibile per aiutarti 
                    con esercizi, consulenze, e qualsiasi dubbio sul tuo percorso.
                  </p>
                  <Button
                    size="lg"
                    onClick={triggerOpenAlessia}
                    className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold shadow-xl hover:shadow-2xl transition-all duration-300"
                  >
                    <MessageCircle className="mr-2 h-5 w-5" />
                    Chatta con Alessia
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hero Section - Next Action */}
          {nextAction ? (
            <Card className="mb-6 overflow-hidden border-0 shadow-xl bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 dark:from-purple-900/70 dark:via-pink-900/70 dark:to-orange-900/70" data-tour="dashboard-next-action">
              <CardContent className="p-6 md:p-8 text-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{nextAction.icon}</div>
                    <div>
                      <h3 className="text-sm font-medium opacity-90">LA TUA PROSSIMA AZIONE</h3>
                      <h2 className="text-2xl md:text-3xl font-bold mt-1">{nextAction.title}</h2>
                    </div>
                  </div>
                </div>

                <p className="text-white/90 mb-6 text-base">{nextAction.description}</p>

                <div className="flex flex-wrap items-center gap-4 mb-6">
                  {nextAction.duration && (
                    <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
                      <Clock size={18} />
                      <span className="font-medium">{nextAction.duration} min</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
                    <Flame size={18} />
                    <span className="font-medium">Streak: {stats?.streak || 0} giorni</span>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    if (nextAction.type === 'exercise') {
                      handleStartExercise(nextAction.id, nextAction.assignmentId);
                    } else {
                      setLocation('/client/daily-tasks');
                    }
                  }}
                  size="lg"
                  className="w-full md:w-auto bg-white text-purple-600 hover:bg-white/90 font-bold text-lg h-14 px-8 shadow-lg"
                >
                  Inizia Ora
                  <Play className="ml-2" size={20} />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-6 overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-500 to-cyan-500" data-tour="dashboard-next-action">
              <CardContent className="p-6 md:p-8 text-white text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl md:text-3xl font-bold mb-2">Fantastico!</h2>
                <p className="text-white/90 text-lg mb-6">Hai completato tutte le attività di oggi</p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Button
                    onClick={() => setLocation('/client/library')}
                    className="bg-white text-blue-600 hover:bg-white/90"
                  >
                    <BookOpen className="mr-2" size={18} />
                    Esplora Libreria
                  </Button>
                  <Button
                    onClick={() => setLocation('/client/roadmap')}
                    variant="outline"
                    className="bg-white/20 border-white/40 text-white hover:bg-white/30"
                  >
                    <Map className="mr-2" size={18} />
                    Vedi Roadmap
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Momentum Widget */}
          {pageContext.momentumData && (
            <Card className="mb-6 overflow-hidden border-0 shadow-xl relative" data-tour="dashboard-momentum-widget">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 opacity-95 dark:from-orange-900/70 dark:via-red-900/70 dark:to-pink-900/70" />
              <CardContent className="relative z-10 p-6 md:p-8 text-white">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
                    <Flame className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white text-sm font-medium opacity-90 uppercase tracking-wider">
                      MOMENTUM
                    </h3>
                    <p className="text-white text-2xl md:text-3xl font-bold">
                      {pageContext.momentumData.streak} giorni di streak 🔥
                    </p>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Check-ins Today */}
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="text-white/80 text-xs mb-1 font-medium">Check-ins Oggi</div>
                    <div className="text-white text-3xl font-bold">
                      {pageContext.momentumData.todayCheckins}
                    </div>
                  </div>

                  {/* Productivity */}
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="text-white/80 text-xs mb-1 font-medium">Produttività</div>
                    <div className="text-white text-3xl font-bold">
                      {pageContext.momentumData.productivityScore}%
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-white/80 mb-2">
                    <span>Progresso giornaliero</span>
                    <span>{pageContext.momentumData.productivityScore}%</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-white h-full rounded-full transition-all duration-500"
                      style={{ width: `${pageContext.momentumData.productivityScore}%` }}
                    />
                  </div>
                </div>

                {/* Active Goals Preview */}
                {pageContext.momentumData.activeGoals && pageContext.momentumData.activeGoals.length > 0 && (
                  <div className="mb-6 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="text-white/80 text-xs mb-3 font-medium">
                      Obiettivi Attivi ({pageContext.momentumData.activeGoals.length})
                    </div>
                    <div className="space-y-2">
                      {pageContext.momentumData.activeGoals.slice(0, 2).map((goal) => (
                        <div key={goal.id} className="text-sm">
                          <div className="flex justify-between text-white mb-1">
                            <span className="truncate">{goal.title}</span>
                            <span className="ml-2 flex-shrink-0">
                              {goal.currentValue}/{goal.targetValue} {goal.unit}
                            </span>
                          </div>
                          <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-white h-full rounded-full"
                              style={{ 
                                width: `${Math.min((goal.currentValue / goal.targetValue) * 100, 100)}%` 
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CTA Button */}
                <Button
                  onClick={() => setLocation('/client/calendar?tab=momentum')}
                  size="lg"
                  className="w-full bg-white text-orange-600 hover:bg-white/90 font-bold text-lg h-14 shadow-lg"
                >
                  <Zap className="mr-2" size={20} />
                  Registra Check-in
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Smart Progress Bar */}
          <Card className="mb-6" data-tour="dashboard-progress-bar">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-foreground">
                    {todayCompleted}/{todayTotal}
                  </div>
                  <span className="text-muted-foreground">task completati oggi</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Flame className={cn("text-orange-500", stats?.streak > 0 && "animate-pulse")} size={20} />
                    <span className="font-bold text-orange-600">{stats?.streak || 0} giorni</span>
                  </div>
                  {todayTotal - todayCompleted > 0 && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      🎯 {todayTotal - todayCompleted} al prossimo milestone
                    </Badge>
                  )}
                </div>
              </div>
              <Progress value={todayProgress} className="h-3" />
            </CardContent>
          </Card>

          {/* Timeline/Feed */}
          <Card className="mb-6" data-tour="dashboard-timeline">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="text-purple-600" size={24} />
                La Tua Giornata
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Completed exercises */}
              {assignments.filter((a: any) => {
                if (a.status !== 'completed' || !a.completedAt) return false;
                const completedDate = new Date(a.completedAt);
                const today = new Date();
                return completedDate.toDateString() === today.toDateString();
              }).map((assignment: any) => (
                <div key={assignment.id} className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                  <div className="flex-1">
                    <p className="font-medium text-green-800 dark:text-green-300">
                      {assignment.exercise.title}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-500">
                      Completato • {new Date(assignment.completedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-2xl">🎉</div>
                </div>
              ))}

              {/* In progress exercises */}
              {assignments.filter((a: any) => a.status === 'in_progress').map((assignment: any) => (
                <div key={assignment.id} className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-800 dark:text-blue-300">
                      {assignment.exercise.title}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-500">In corso</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleStartExercise(assignment.exercise.id, assignment.id)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Continua
                  </Button>
                </div>
              ))}

              {/* Pending exercises */}
              {assignments.filter((a: any) => a.status === 'pending').slice(0, 3).map((assignment: any) => (
                <div key={assignment.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">{assignment.exercise.title}</p>
                    <p className="text-sm text-muted-foreground">Da fare</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartExercise(assignment.exercise.id, assignment.id)}
                  >
                    Inizia
                  </Button>
                </div>
              ))}

              {/* Next consultation */}
              {nextConsultation && (
                <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border-2 border-purple-400 dark:border-purple-600">
                  <Calendar className="text-purple-600 flex-shrink-0" size={20} />
                  <div className="flex-1">
                    <p className="font-medium text-purple-800 dark:text-purple-300">
                      Consulenza con {nextConsultation.consultant.firstName}
                    </p>
                    <p className="text-sm text-purple-600 dark:text-purple-500">
                      {new Date(nextConsultation.scheduledAt).toLocaleDateString('it-IT')} • {new Date(nextConsultation.scheduledAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-xl">⚡</div>
                </div>
              )}

              {/* Today's reflection */}
              {!todayReflection && (
                <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <Lightbulb className="text-orange-600 flex-shrink-0" size={20} />
                  <div className="flex-1">
                    <p className="font-medium text-orange-800 dark:text-orange-300">
                      Riflessione Giornaliera
                    </p>
                    <p className="text-sm text-orange-600 dark:text-orange-500">Non ancora completata</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setLocation('/client/daily-tasks')}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    Scrivi
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="mb-6" data-tour="dashboard-quick-actions">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="text-yellow-600" size={24} />
                Azioni Rapide
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 p-4"
                onClick={() => setLocation('/client/library')}
              >
                <Library size={24} className="text-purple-600" />
                <span className="text-sm font-medium">Libreria</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 p-4"
                onClick={() => setLocation('/client/roadmap')}
              >
                <Map size={24} className="text-blue-600" />
                <span className="text-sm font-medium">Roadmap</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 p-4"
                onClick={() => setLocation('/client/daily-tasks')}
              >
                <FileText size={24} className="text-orange-600" />
                <span className="text-sm font-medium">Riflessioni</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto flex-col gap-2 p-4"
                onClick={() => setLocation('/client/consultations')}
              >
                <MessageCircle size={24} className="text-green-600" />
                <span className="text-sm font-medium">Consulenze</span>
              </Button>
              
            </CardContent>
          </Card>

          {/* Badge Display Section */}
          <div className="mb-6" data-tour="dashboard-badges">
            <BadgeDisplay />
          </div>

          {/* Collapsible Progress Section */}
          <Collapsible open={progressOpen} onOpenChange={setProgressOpen}>
            <Card data-tour="dashboard-progress-stats">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="text-indigo-600" size={24} />
                      I Tuoi Progressi
                    </CardTitle>
                    {progressOpen ? <ChevronUp /> : <ChevronDown />}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <div className="text-3xl font-bold text-green-600 mb-1">{stats?.completedExercises || 0}</div>
                      <p className="text-sm text-muted-foreground">Esercizi Completati</p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                      <div className="text-3xl font-bold text-orange-600 mb-1">{stats?.streak || 0}</div>
                      <p className="text-sm text-muted-foreground">Giorni Consecutivi</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                      <div className="text-3xl font-bold text-purple-600 mb-1">
                        {stats?.totalExercises > 0 ? Math.round((stats.completedExercises / stats.totalExercises) * 100) : 0}%
                      </div>
                      <p className="text-sm text-muted-foreground">Completamento</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <div className="text-3xl font-bold text-blue-600 mb-1">{consultations.length}</div>
                      <p className="text-sm text-muted-foreground">Consulenze</p>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}