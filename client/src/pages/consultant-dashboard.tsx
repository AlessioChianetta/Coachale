import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  Calendar,
  MessageSquare,
  Mail,
  UserPlus,
  Phone,
  Sparkles,
  Target,
  GraduationCap,
  BookOpen,
  Settings,
  Bell,
  Search,
  ArrowRight,
  AlertCircle,
  Clock,
  FileText,
  Bot,
  FileSearch,
  Flame,
  ChevronRight,
  TrendingUp,
  CheckCircle,
  RotateCcw,
  Activity,
  Gift
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders, getAuthUser } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoleSwitch } from "@/hooks/use-role-switch";
import { useClientPriorityScore } from "@/hooks/useClientPriorityScore";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { format, isThisWeek, parseISO } from "date-fns";
import { it } from "date-fns/locale";

interface AttentionItem {
  id: string;
  type: "exercise" | "lead" | "appointment";
  title: string;
  description: string;
  urgency: "high" | "medium" | "low";
  actionUrl: string;
  timeAgo?: string;
}

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
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
}

export default function ConsultantDashboard() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();
  const user = getAuthUser();

  const {
    highPriorityClients,
  } = useClientPriorityScore();

  const { data: assignments = [] } = useQuery<any[]>({
    queryKey: ["/api/exercise-assignments/consultant"],
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  const { data: appointments = [] } = useQuery<any[]>({
    queryKey: ["/api/appointments/upcoming"],
    queryFn: async () => {
      const response = await fetch("/api/appointments/upcoming", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: consultantStats } = useQuery<{
    activeClients: number;
    completedExercises: number;
    completionRate: number;
    todayConsultations: number;
  }>({
    queryKey: ["/api/stats/consultant"],
    queryFn: async () => {
      const response = await fetch("/api/stats/consultant", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { activeClients: 0, completedExercises: 0, completionRate: 0, todayConsultations: 0 };
      return response.json();
    },
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buongiorno";
    if (hour < 18) return "Buon pomeriggio";
    return "Buonasera";
  };

  const pendingExercises = useMemo(() => {
    return assignments.filter((a: any) => a.status === "pending" || a.status === "returned");
  }, [assignments]);

  const exercisesToReview = useMemo(() => {
    return assignments.filter((a: any) => a.status === "pending" || a.status === "returned" || a.status === "in_progress");
  }, [assignments]);

  const completedExercises = useMemo(() => {
    return assignments.filter((a: any) => a.status === "completed");
  }, [assignments]);

  const weekConsultations = useMemo(() => {
    return appointments.filter((apt: any) => {
      try {
        const aptDate = apt.startTime ? parseISO(apt.startTime) : new Date(apt.date);
        return isThisWeek(aptDate, { weekStartsOn: 1 });
      } catch {
        return false;
      }
    });
  }, [appointments]);

  const recentClients = useMemo(() => {
    const sortedClients = [...clients].sort((a: any, b: any) => {
      const dateA = a.updatedAt || a.createdAt || 0;
      const dateB = b.updatedAt || b.createdAt || 0;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    return sortedClients.slice(0, 3);
  }, [clients]);

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return appointments
      .filter((apt: any) => {
        const aptDate = apt.startTime ? new Date(apt.startTime) : new Date(apt.date);
        return aptDate > now;
      })
      .sort((a: any, b: any) => {
        const dateA = a.startTime ? new Date(a.startTime) : new Date(a.date);
        const dateB = b.startTime ? new Date(b.startTime) : new Date(b.date);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 3);
  }, [appointments]);

  const kpiCards: KPICard[] = useMemo(() => [
    {
      title: "Clienti Attivi",
      value: clients.length,
      icon: Users,
      color: "text-blue-600",
      bgGradient: "from-blue-500/10 via-blue-500/5 to-transparent",
    },
    {
      title: "Esercizi da Revisionare",
      value: exercisesToReview.length,
      icon: FileText,
      color: "text-amber-600",
      bgGradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    },
    {
      title: "Consulenze Settimana",
      value: weekConsultations.length,
      icon: Calendar,
      color: "text-emerald-600",
      bgGradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    },
    {
      title: "Lead Prioritari",
      value: highPriorityClients?.length || 0,
      icon: Target,
      color: "text-red-600",
      bgGradient: "from-red-500/10 via-red-500/5 to-transparent",
    },
  ], [clients.length, exercisesToReview.length, weekConsultations.length, highPriorityClients]);

  const exerciseProgress = useMemo(() => {
    const total = assignments.length;
    const completed = completedExercises.length;
    const pending = exercisesToReview.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, percentage };
  }, [assignments.length, completedExercises.length, exercisesToReview.length]);

  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];
    
    pendingExercises.slice(0, 3).forEach((assignment: any) => {
      items.push({
        id: `exercise-${assignment.id}`,
        type: "exercise",
        title: `Esercizio in attesa`,
        description: `${assignment.client?.firstName || 'Cliente'} - ${assignment.exercise?.title || 'Esercizio'}`,
        urgency: assignment.status === "pending" ? "high" : "medium",
        actionUrl: "/consultant/exercises",
        timeAgo: assignment.assignedAt ? new Date(assignment.assignedAt).toLocaleDateString('it-IT') : undefined
      });
    });

    highPriorityClients?.filter((c: any) => c?.id).slice(0, 2).forEach((client: any, index: number) => {
      items.push({
        id: `lead-${client.id || `fallback-${index}`}`,
        type: "lead",
        title: "Cliente prioritario",
        description: `${client.firstName} ${client.lastName} richiede attenzione`,
        urgency: "high",
        actionUrl: `/consultant/clients`,
      });
    });

    appointments?.slice(0, 2).forEach((apt: any) => {
      items.push({
        id: `apt-${apt.id}`,
        type: "appointment",
        title: "Appuntamento in arrivo",
        description: apt.title || `Con ${apt.clientName || 'Cliente'}`,
        urgency: "medium",
        actionUrl: "/consultant/appointments",
        timeAgo: apt.startTime ? new Date(apt.startTime).toLocaleDateString('it-IT') : undefined
      });
    });

    return items.slice(0, 5);
  }, [pendingExercises, highPriorityClients, appointments]);

  const navigationSections: NavigationSection[] = [
    { 
      name: "AI Assistant", 
      href: "/consultant/ai-assistant", 
      icon: Sparkles, 
      color: "text-fuchsia-500",
      bgColor: "bg-fuchsia-500/10 hover:bg-fuchsia-500/20",
      badge: "AI"
    },
    { 
      name: "Clienti", 
      href: "/consultant/clients", 
      icon: Users, 
      color: "text-blue-500",
      bgColor: "bg-blue-500/10 hover:bg-blue-500/20",
      count: clients.length
    },
    { 
      name: "Calendario", 
      href: "/consultant/appointments", 
      icon: Calendar, 
      color: "text-orange-500",
      bgColor: "bg-orange-500/10 hover:bg-orange-500/20",
    },
    { 
      name: "Email Journey", 
      href: "/consultant/ai-config", 
      icon: Mail, 
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20",
    },
    { 
      name: "Lead Hub", 
      href: "/consultant/lead-hub", 
      icon: Target, 
      color: "text-red-500",
      bgColor: "bg-red-500/10 hover:bg-red-500/20",
      badge: "HUB"
    },
    { 
      name: "Agent Setup", 
      href: "/consultant/whatsapp", 
      icon: Bot, 
      color: "text-green-500",
      bgColor: "bg-green-500/10 hover:bg-green-500/20",
    },
    { 
      name: "Formazione", 
      href: "/consultant/university", 
      icon: GraduationCap, 
      color: "text-amber-500",
      bgColor: "bg-amber-500/10 hover:bg-amber-500/20",
    },
    { 
      name: "Knowledge Base", 
      href: "/consultant/knowledge-documents", 
      icon: BookOpen, 
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10 hover:bg-indigo-500/20",
    },
    { 
      name: "File Search", 
      href: "/consultant/file-search-analytics", 
      icon: FileSearch, 
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10 hover:bg-cyan-500/20",
      badge: "RAG"
    },
    { 
      name: "Impostazioni", 
      href: "/consultant/api-keys-unified", 
      icon: Settings, 
      color: "text-gray-500",
      bgColor: "bg-gray-500/10 hover:bg-gray-500/20",
    },
  ];

  const quickActions = [
    { 
      name: "Chatta con AI", 
      icon: MessageSquare, 
      onClick: () => setLocation("/consultant/ai-assistant"),
      gradient: "from-fuchsia-500 to-purple-600"
    },
    { 
      name: "Nuovo Cliente", 
      icon: UserPlus, 
      onClick: () => setLocation("/consultant/clients"),
      gradient: "from-blue-500 to-cyan-600"
    },
    { 
      name: "Chiama Lead", 
      icon: Phone, 
      onClick: () => setLocation("/consultant/lead-hub"),
      gradient: "from-green-500 to-emerald-600"
    },
    { 
      name: "Invia Email", 
      icon: Mail, 
      onClick: () => setLocation("/consultant/ai-config"),
      gradient: "from-orange-500 to-red-600"
    },
    { 
      name: "Invita Amico", 
      icon: Gift, 
      onClick: () => setLocation("/consultant/referrals"),
      gradient: "from-pink-500 to-rose-600"
    },
  ];

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "high": return "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400";
      case "medium": return "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400";
      default: return "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "exercise": return FileText;
      case "lead": return Target;
      case "appointment": return Clock;
      default: return AlertCircle;
    }
  };

  const formatAppointmentTime = (apt: any) => {
    try {
      const date = apt.startTime ? new Date(apt.startTime) : new Date(apt.date);
      return format(date, "dd MMM, HH:mm", { locale: it });
    } catch {
      return "Data non disponibile";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20" data-testid="consultant-dashboard">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar 
          role="consultant" 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
          showRoleSwitch={showRoleSwitch} 
          currentRole={currentRole} 
          onRoleSwitch={handleRoleSwitch} 
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">👋</span>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                    {getGreeting()}, {user?.firstName || 'Consulente'}
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Ecco cosa succede oggi nel tuo business
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative"
                  onClick={() => setLocation("/consultant/ai-config")}
                >
                  <Bell className="h-5 w-5" />
                  {attentionItems.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                      {attentionItems.length}
                    </span>
                  )}
                </Button>
                <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                  <AvatarImage src={user?.avatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-white font-semibold">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            {/* KPI Header Strip */}
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

            {/* Search/AI Bar */}
            <div className="relative group">
              <div 
                className="w-full cursor-pointer"
                onClick={() => setLocation("/consultant/ai-assistant")}
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

            {/* Quick Actions */}
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

            {/* Requires Attention */}
            {attentionItems.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Richiede Attenzione
                  </h2>
                  <Badge variant="secondary" className="text-xs">
                    {attentionItems.length}
                  </Badge>
                </div>
                <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent">
                  <CardContent className="p-4 space-y-2">
                    {attentionItems.map((item) => {
                      const IconComponent = getTypeIcon(item.type);
                      return (
                        <button
                          key={item.id}
                          onClick={() => setLocation(item.actionUrl)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 hover:scale-[1.01] text-left",
                            getUrgencyColor(item.urgency)
                          )}
                        >
                          <div className="p-2 rounded-lg bg-background/50">
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.title}</p>
                            <p className="text-xs opacity-80 truncate">{item.description}</p>
                          </div>
                          {item.timeAgo && (
                            <span className="text-xs opacity-60 whitespace-nowrap">{item.timeAgo}</span>
                          )}
                          <ChevronRight className="h-4 w-4 opacity-50" />
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Operational Panels Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Recent Clients */}
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
                      onClick={() => setLocation("/consultant/clients")}
                    >
                      Vedi tutti
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentClients.length > 0 ? (
                    recentClients.map((client: any) => (
                      <div 
                        key={client.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-colors cursor-pointer"
                        onClick={() => setLocation(`/consultant/clients`)}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-blue-500/10 text-blue-600 text-sm font-medium">
                            {client.firstName?.[0]}{client.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {client.firstName} {client.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {client.email}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      Nessun cliente recente
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Appointments */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-500/5 to-transparent">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-emerald-500" />
                      Prossimi Appuntamenti
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs"
                      onClick={() => setLocation("/consultant/appointments")}
                    >
                      Vedi tutti
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {upcomingAppointments.length > 0 ? (
                    upcomingAppointments.map((apt: any) => (
                      <div 
                        key={apt.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-colors cursor-pointer"
                        onClick={() => setLocation("/consultant/appointments")}
                      >
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                          <Clock className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {apt.title || apt.clientName || "Appuntamento"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatAppointmentTime(apt)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      Nessun appuntamento in programma
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Exercise Trends */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500/5 to-transparent">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-500" />
                      Trend Esercizi
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs"
                      onClick={() => setLocation("/consultant/exercises")}
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

            {/* Navigation Sections Grid */}
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
                    {section.count !== undefined && (
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

            {/* Footer spacer */}
            <div className="h-8" />
          </div>
        </div>
      </div>
    </div>
  );
}
