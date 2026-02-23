import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Users, 
  Calendar,
  MessageSquare,
  Mail,
  UserPlus,
  Phone,
  Sparkles,
  Target,
  AlertCircle,
  Clock,
  FileText,
  Flame,
  ChevronRight,
  TrendingUp,
  CheckCircle,
  RotateCcw,
  Activity,
  Gift,
  ArrowRight
} from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { getAuthHeaders, getAuthUser } from "@/lib/auth";
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
  const [, setLocation] = useLocation();
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

  const { data: aiInsights, isLoading: loadingInsights, refetch: refetchInsights } = useQuery<{
    summary: string;
    highlights: string[];
    priorities: Array<{ title: string; reason: string; type: string }>;
    generatedAt: string;
  }>({
    queryKey: ["/api/dashboard/insights"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard/insights", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed");
      return response.json();
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
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
  ];

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "high": return "border-l-red-400";
      case "medium": return "border-l-yellow-400";
      default: return "border-l-blue-400";
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "high": return "bg-red-400/10 text-red-400 border-red-400/20";
      case "medium": return "bg-yellow-400/10 text-yellow-400 border-yellow-400/20";
      default: return "bg-blue-500/10 text-blue-500 border-blue-500/20";
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

  const sparklinePoints = useMemo(() => {
    const base = exerciseProgress.completed || 3;
    return [
      Math.max(1, base - 2),
      Math.max(1, base - 1),
      Math.max(2, base),
      Math.max(1, base - 1),
      Math.max(3, base + 1),
      Math.max(2, base + 2),
      Math.max(4, base + 1),
    ];
  }, [exerciseProgress.completed]);

  const sparklinePath = useMemo(() => {
    const max = Math.max(...sparklinePoints, 1);
    const width = 120;
    const height = 40;
    const padding = 4;
    const points = sparklinePoints.map((val, i) => {
      const x = padding + (i / (sparklinePoints.length - 1)) * (width - padding * 2);
      const y = height - padding - ((val / max) * (height - padding * 2));
      return `${x},${y}`;
    });
    return `M ${points.join(" L ")}`;
  }, [sparklinePoints]);

  const userInitials = useMemo(() => {
    const first = user?.firstName?.[0] || '';
    const last = user?.lastName?.[0] || '';
    return (first + last).toUpperCase() || 'C';
  }, [user]);

  return (
    <PageLayout role="consultant">
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .animate-fadeInUp { animation: fadeInUp 0.4s ease-out forwards; }
        .animate-fadeInUp-1 { animation: fadeInUp 0.4s ease-out 0.04s forwards; opacity: 0; }
        .animate-fadeInUp-2 { animation: fadeInUp 0.4s ease-out 0.08s forwards; opacity: 0; }
        .animate-fadeInUp-3 { animation: fadeInUp 0.4s ease-out 0.12s forwards; opacity: 0; }
        .animate-fadeInUp-4 { animation: fadeInUp 0.4s ease-out 0.16s forwards; opacity: 0; }
        .animate-fadeInUp-5 { animation: fadeInUp 0.4s ease-out 0.20s forwards; opacity: 0; }
        .animate-fadeInUp-6 { animation: fadeInUp 0.4s ease-out 0.24s forwards; opacity: 0; }
        .animate-fadeInUp-7 { animation: fadeInUp 0.4s ease-out 0.28s forwards; opacity: 0; }
        .shimmer-bg {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
        }
      `}</style>
            
            {/* Hero Section - Glassmorphism */}
            <div className="animate-fadeInUp relative overflow-hidden rounded-2xl p-6 sm:p-8"
              style={{
                background: 'linear-gradient(135deg, rgba(108,92,231,0.08) 0%, rgba(0,184,148,0.06) 50%, rgba(253,203,110,0.04) 100%)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div className="absolute inset-0 shimmer-bg pointer-events-none" style={{ opacity: 0.5 }} />
              <div className="relative flex items-center gap-4 sm:gap-6">
                <Avatar className="h-14 w-14 sm:h-16 sm:w-16 ring-2 ring-primary/30 ring-offset-2 ring-offset-background shadow-lg">
                  <AvatarFallback
                    className="text-lg sm:text-xl font-bold bg-gradient-to-br from-primary to-violet-400 text-white"
                  >
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text">
                    {getGreeting()}, {user?.firstName || 'Consulente'}
                  </h1>
                  <p className="text-muted-foreground/60 text-sm mt-1">
                    Ecco cosa succede oggi nel tuo business
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-500">↑ +12% rispetto a ieri</span>
                </div>
              </div>
            </div>

            {/* KPI Bubbles */}
            <div className="animate-fadeInUp-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {kpiCards.map((kpi, index) => {
                const bubbleGradients = [
                  'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                ];
                const bubbleShadows = [
                  '0 8px 24px rgba(59,130,246,0.35)',
                  '0 8px 24px rgba(245,158,11,0.35)',
                  '0 8px 24px rgba(16,185,129,0.35)',
                  '0 8px 24px rgba(239,68,68,0.35)',
                ];
                const IconComponent = kpi.icon;
                return (
                  <div key={index} className="flex flex-col items-center gap-2.5 py-1">
                    <div
                      className="relative w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20 rounded-full flex flex-col items-center justify-center text-white"
                      style={{ background: bubbleGradients[index], boxShadow: bubbleShadows[index] }}
                    >
                      <IconComponent className="h-3.5 w-3.5 opacity-75 mb-0.5" />
                      <span className="text-xl sm:text-2xl font-black leading-none tracking-tight">{kpi.value}</span>
                    </div>
                    <p className="text-[11px] text-center text-muted-foreground/70 font-medium leading-tight px-1">{kpi.title}</p>
                  </div>
                );
              })}
            </div>

            {/* AI Briefing - Compact, dark-mode-friendly */}
            <div className="animate-fadeInUp-2 rounded-2xl overflow-hidden border border-border/50 shadow-sm bg-card">
              {/* Gradient header strip */}
              <div
                className="flex items-center justify-between px-4 py-2.5 shimmer-bg"
                style={{ background: 'linear-gradient(135deg, #6C5CE7 0%, #9b8cf5 60%, #c084fc 100%)' }}
              >
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-lg bg-white/15">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white leading-none">Briefing AI Giornaliero</h2>
                    {aiInsights?.generatedAt && (
                      <p className="text-white/50 text-[10px] mt-0.5">
                        Aggiornato alle {format(new Date(aiInsights.generatedAt), 'HH:mm', { locale: it })}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-white/15 hover:bg-white/25 text-white border-0 gap-1.5 rounded-lg"
                  onClick={() => refetchInsights()}
                  disabled={loadingInsights}
                >
                  <RotateCcw className={cn("h-3 w-3", loadingInsights && "animate-spin")} />
                  <span className="hidden sm:inline">Aggiorna</span>
                </Button>
              </div>

              {/* Content body — uses card bg, dark mode safe */}
              <div className="px-4 py-3">
                {loadingInsights ? (
                  <div className="space-y-2">
                    <div className="h-3.5 bg-muted animate-pulse rounded-full w-4/5" />
                    <div className="h-3 bg-muted animate-pulse rounded-full w-3/5" />
                    <div className="flex gap-1.5 mt-3">
                      <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
                      <div className="h-5 w-28 bg-muted animate-pulse rounded-full" />
                      <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
                    </div>
                  </div>
                ) : aiInsights?.summary ? (
                  <div className="space-y-2.5">
                    <p className="text-sm text-foreground/80 leading-relaxed">{aiInsights.summary}</p>
                    {aiInsights.highlights?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {aiInsights.highlights.map((h, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/8 dark:bg-primary/15 text-primary text-[11px] font-medium border border-primary/15">
                            <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                            {h}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 py-1 text-muted-foreground/60">
                    <Sparkles className="h-4 w-4 shrink-0 text-primary/50" />
                    <p className="text-sm">Clicca "Aggiorna" per il tuo briefing AI personalizzato</p>
                  </div>
                )}
              </div>

              {/* Priorities - compact, inside card */}
              {aiInsights?.priorities && aiInsights.priorities.length > 0 && (
                <div className="px-4 pb-3 border-t border-border/40">
                  <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-2 pt-2.5">Priorità del giorno</p>
                  <div className="space-y-1.5">
                    {aiInsights.priorities.map((p, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                        <div className={cn(
                          "mt-0.5 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black text-white shrink-0",
                          i === 0 ? "bg-red-400" : i === 1 ? "bg-amber-400" : "bg-primary/70"
                        )}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground/90 leading-snug">{p.title}</p>
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-snug">{p.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Attention Items + Appointments (2 cols) */}
            <div className="animate-fadeInUp-3 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Requires Attention */}
              <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="pb-3 pt-5 px-5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-red-400/10">
                      <Flame className="h-4 w-4 text-red-400" />
                    </div>
                    <CardTitle className="text-base font-bold">Richiede Attenzione</CardTitle>
                    {attentionItems.length > 0 && (
                      <Badge className="text-[10px] px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 border-red-400/20 hover:bg-red-400/15">{attentionItems.length}</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-2">
                  {attentionItems.length > 0 ? (
                    attentionItems.map((item) => {
                      const IconComponent = getTypeIcon(item.type);
                      return (
                        <button
                          key={item.id}
                          onClick={() => setLocation(item.actionUrl)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl bg-card hover:bg-muted/50 transition-all duration-200 text-left border-l-[3px] border-0 shadow-sm hover:shadow-md",
                            getUrgencyColor(item.urgency)
                          )}
                        >
                          <div className="p-2 rounded-lg bg-muted/50 shrink-0">
                            <IconComponent className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground/60 truncate">{item.description}</p>
                          </div>
                          {item.timeAgo && (
                            <span className="text-[10px] text-muted-foreground/40 whitespace-nowrap">{item.timeAgo}</span>
                          )}
                          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 rounded-full shrink-0", getUrgencyBadge(item.urgency))}>
                            {item.urgency === 'high' ? 'Urgente' : item.urgency === 'medium' ? 'Medio' : 'Basso'}
                          </Badge>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground/60 text-sm">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-500/40" />
                      Nessun elemento richiede attenzione
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Appointments */}
              <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
                <CardHeader className="pb-3 pt-5 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10">
                        <Calendar className="h-4 w-4 text-emerald-500" />
                      </div>
                      <CardTitle className="text-base font-bold">Prossimi Appuntamenti</CardTitle>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs text-muted-foreground/60 hover:text-foreground"
                      onClick={() => setLocation("/consultant/appointments")}
                    >
                      Vedi tutti
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-2">
                  {upcomingAppointments.length > 0 ? (
                    upcomingAppointments.map((apt: any) => (
                      <div 
                        key={apt.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-card hover:bg-muted/50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md border-l-[3px] border-l-emerald-500"
                        onClick={() => setLocation("/consultant/appointments")}
                      >
                        <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                          <Clock className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">
                            {apt.title || apt.clientName || "Appuntamento"}
                          </p>
                          <p className="text-xs text-muted-foreground/60">
                            {formatAppointmentTime(apt)}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground/60 text-sm">
                      <Calendar className="h-8 w-8 mx-auto mb-2 text-emerald-500/30" />
                      Nessun appuntamento in programma
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="animate-fadeInUp-4">
              <h2 className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-4">
                Azioni Rapide
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className="group relative overflow-hidden rounded-2xl p-5 sm:p-6 text-center transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] backdrop-blur-sm"
                    style={{
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 8px 32px rgba(108,92,231,0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
                    }}
                  >
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-90 group-hover:opacity-100 transition-opacity",
                      action.gradient
                    )} />
                    <div className="relative z-10 text-white flex flex-col items-center gap-2.5">
                      <action.icon className="h-7 w-7 sm:h-8 sm:w-8" />
                      <p className="font-bold text-sm">{action.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Clients */}
            <Card className="animate-fadeInUp-5 border-0 shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="pb-3 pt-5 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                      <Activity className="h-4 w-4 text-blue-500" />
                    </div>
                    <CardTitle className="text-base font-bold">Clienti Recenti</CardTitle>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-muted-foreground/60 hover:text-foreground"
                    onClick={() => setLocation("/consultant/clients")}
                  >
                    Vedi tutti
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {recentClients.length > 0 ? (
                    recentClients.map((client: any) => (
                      <div 
                        key={client.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-card hover:bg-muted/50 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
                        onClick={() => setLocation(`/consultant/clients`)}
                      >
                        <Avatar className="h-10 w-10 shadow-sm">
                          <AvatarFallback className="text-sm font-bold bg-gradient-to-br from-primary to-violet-400 text-white">
                            {client.firstName?.[0]}{client.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">
                            {client.firstName} {client.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground/60 truncate">
                            {client.email}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                      </div>
                    ))
                  ) : (
                    <div className="col-span-3 text-center py-8 text-muted-foreground/60 text-sm">
                      Nessun cliente recente
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Exercise Trends with Sparkline */}
            <Card className="animate-fadeInUp-6 border-0 shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="pb-3 pt-5 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-base font-bold">Trend Esercizi</CardTitle>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-muted-foreground/60 hover:text-foreground"
                    onClick={() => setLocation("/consultant/exercises")}
                  >
                    Dettagli
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="flex items-center gap-6 sm:gap-8">
                  <div className="flex-1">
                    <div className="flex items-end gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-1">Completamento</p>
                        <p className="text-3xl font-bold text-primary">{exerciseProgress.percentage}%</p>
                      </div>
                      <svg width="120" height="40" viewBox="0 0 120 40" className="mb-1">
                        <defs>
                          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6C5CE7" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#6C5CE7" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path
                          d={sparklinePath + ` L 116,40 L 4,40 Z`}
                          fill="url(#sparkGrad)"
                        />
                        <path
                          d={sparklinePath}
                          fill="none"
                          stroke="#6C5CE7"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {sparklinePoints.map((val, i) => {
                          const max = Math.max(...sparklinePoints, 1);
                          const x = 4 + (i / (sparklinePoints.length - 1)) * 112;
                          const y = 40 - 4 - ((val / max) * 32);
                          return i === sparklinePoints.length - 1 ? (
                            <circle key={i} cx={x} cy={y} r="3" fill="#6C5CE7" stroke="white" strokeWidth="1.5" />
                          ) : null;
                        })}
                      </svg>
                    </div>
                  </div>
                  <div className="flex gap-5">
                    <div className="text-center">
                      <div className="flex items-center gap-1.5 mb-1">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Completati</span>
                      </div>
                      <p className="text-2xl font-bold text-emerald-500">{exerciseProgress.completed}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1.5 mb-1">
                        <RotateCcw className="h-3.5 w-3.5 text-yellow-400" />
                        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">In Attesa</span>
                      </div>
                      <p className="text-2xl font-bold text-yellow-400">{exerciseProgress.pending}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Referral Link */}
            <button
              onClick={() => setLocation("/consultant/referrals")}
              className="animate-fadeInUp-7 w-full group flex items-center justify-between p-4 rounded-2xl border-0 shadow-md hover:shadow-lg transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, rgba(253,121,168,0.08) 0%, rgba(255,118,117,0.06) 50%, rgba(253,203,110,0.04) 100%)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-pink-500/10">
                  <Gift className="h-5 w-5 text-pink-500" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold block">Invita un Amico</span>
                  <span className="text-xs text-muted-foreground/60">Guadagna bonus per ogni cliente portato</span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:translate-x-1 group-hover:text-pink-500 transition-all" />
            </button>

    </PageLayout>
  );
}
