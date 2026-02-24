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
  TrendingDown,
  CheckCircle,
  RotateCcw,
  Activity,
  Gift,
  ArrowRight,
  Zap,
  Star,
  GraduationCap,
  PlayCircle,
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
  gradient: string;
  shadow: string;
  trend: number;
  trendLabel: string;
}

const CSS = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse-ring {
    0% { box-shadow: 0 0 0 0 rgba(108,92,231,0.3); }
    70% { box-shadow: 0 0 0 8px rgba(108,92,231,0); }
    100% { box-shadow: 0 0 0 0 rgba(108,92,231,0); }
  }
  @keyframes glow {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
  .afu { animation: fadeInUp 0.5s ease-out forwards; }
  .afu-1 { animation: fadeInUp 0.5s ease-out 0.05s forwards; opacity: 0; }
  .afu-2 { animation: fadeInUp 0.5s ease-out 0.10s forwards; opacity: 0; }
  .afu-3 { animation: fadeInUp 0.5s ease-out 0.15s forwards; opacity: 0; }
  .afu-4 { animation: fadeInUp 0.5s ease-out 0.20s forwards; opacity: 0; }
  .afu-5 { animation: fadeInUp 0.5s ease-out 0.25s forwards; opacity: 0; }
  .afu-6 { animation: fadeInUp 0.5s ease-out 0.30s forwards; opacity: 0; }
  .afu-7 { animation: fadeInUp 0.5s ease-out 0.35s forwards; opacity: 0; }
  .shimmer-fx {
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%);
    background-size: 200% 100%;
    animation: shimmer 3s ease-in-out infinite;
  }
  .kpi-card:hover { transform: translateY(-2px); }
  .kpi-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .action-btn:hover { transform: translateY(-3px); }
  .action-btn { transition: transform 0.25s ease, box-shadow 0.25s ease; }
  .avatar-pulse { animation: pulse-ring 2.5s ease-in-out infinite; }
`;

function LessonCountBadge({ className }: { className?: string }) {
  const { data } = useQuery({ queryKey: ["academy-count"], queryFn: async () => {
    const res = await fetch("/api/consultant/academy/count");
    const json = await res.json();
    return json.count ?? 27;
  }, staleTime: 300_000 });
  return <span className={className}>{data ?? 27} lezioni</span>;
}

function MiniSparkline({ color, peakValue }: { color: string; peakValue: number }) {
  const base = Math.max(peakValue, 2);
  const pts = [
    Math.max(1, base - 3),
    Math.max(1, base - 1),
    Math.max(2, base - 2),
    Math.max(1, base),
    Math.max(3, base + 1),
    Math.max(2, base + 2),
    Math.max(4, base + 1),
  ];
  const max = Math.max(...pts, 1);
  const w = 80;
  const h = 28;
  const pad = 2;
  const coords = pts.map((v, i) => {
    const x = pad + (i / (pts.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v / max) * (h - pad * 2));
    return `${x},${y}`;
  });
  const path = `M ${coords.join(" L ")}`;
  const fillPath = path + ` L ${w - pad},${h} L ${pad},${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-70">
      <path d={fillPath} fill={color} fillOpacity="0.15" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CircularProgress({ percentage, size = 90, strokeWidth = 8, color = "#6C5CE7" }: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (percentage / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/40"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease" }}
      />
    </svg>
  );
}

export default function ConsultantDashboard() {
  const [, setLocation] = useLocation();
  const user = getAuthUser();

  const { highPriorityClients } = useClientPriorityScore();

  const { data: assignments = [] } = useQuery<any[]>({
    queryKey: ["/api/exercise-assignments/consultant"],
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const { data: appointments = [] } = useQuery<any[]>({
    queryKey: ["/api/appointments/upcoming"],
    queryFn: async () => {
      const res = await fetch("/api/appointments/upcoming", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return res.json();
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
      const res = await fetch("/api/dashboard/insights", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Buongiorno";
    if (h < 18) return "Buon pomeriggio";
    return "Buonasera";
  };

  const todayLabel = useMemo(() => {
    return format(new Date(), "EEEE d MMMM yyyy", { locale: it });
  }, []);

  const pendingExercises = useMemo(() =>
    assignments.filter((a: any) => a.status === "pending" || a.status === "returned"),
    [assignments]);

  const exercisesToReview = useMemo(() =>
    assignments.filter((a: any) => ["pending", "returned", "in_progress"].includes(a.status)),
    [assignments]);

  const completedExercises = useMemo(() =>
    assignments.filter((a: any) => a.status === "completed"),
    [assignments]);

  const weekConsultations = useMemo(() =>
    appointments.filter((apt: any) => {
      try {
        const d = apt.startTime ? parseISO(apt.startTime) : new Date(apt.date);
        return isThisWeek(d, { weekStartsOn: 1 });
      } catch { return false; }
    }),
    [appointments]);

  const recentClients = useMemo(() => {
    return [...clients]
      .sort((a: any, b: any) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime()
      )
      .slice(0, 4);
  }, [clients]);

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return appointments
      .filter((apt: any) => {
        const d = apt.startTime ? new Date(apt.startTime) : new Date(apt.date);
        return d > now;
      })
      .sort((a: any, b: any) => {
        const da = a.startTime ? new Date(a.startTime) : new Date(a.date);
        const db = b.startTime ? new Date(b.startTime) : new Date(b.date);
        return da.getTime() - db.getTime();
      })
      .slice(0, 4);
  }, [appointments]);

  const exerciseProgress = useMemo(() => {
    const total = assignments.length;
    const completed = completedExercises.length;
    const pending = exercisesToReview.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pending, percentage };
  }, [assignments.length, completedExercises.length, exercisesToReview.length]);

  const kpiCards: KPICard[] = useMemo(() => [
    {
      title: "Clienti Attivi",
      value: clients.length,
      icon: Users,
      gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
      shadow: "0 6px 24px rgba(59,130,246,0.35)",
      trend: 8,
      trendLabel: "vs mese scorso",
    },
    {
      title: "Da Revisionare",
      value: exercisesToReview.length,
      icon: FileText,
      gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
      shadow: "0 6px 24px rgba(245,158,11,0.35)",
      trend: exercisesToReview.length > 0 ? -5 : 0,
      trendLabel: "questa settimana",
    },
    {
      title: "Consulenze",
      value: weekConsultations.length,
      icon: Calendar,
      gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      shadow: "0 6px 24px rgba(16,185,129,0.35)",
      trend: 12,
      trendLabel: "questa settimana",
    },
    {
      title: "Lead Caldi",
      value: highPriorityClients?.length || 0,
      icon: Target,
      gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      shadow: "0 6px 24px rgba(239,68,68,0.35)",
      trend: highPriorityClients?.length || 0 > 0 ? 15 : 0,
      trendLabel: "da contattare",
    },
  ], [clients.length, exercisesToReview.length, weekConsultations.length, highPriorityClients]);

  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];
    pendingExercises.slice(0, 3).forEach((a: any) => {
      items.push({
        id: `exercise-${a.id}`,
        type: "exercise",
        title: `${a.exercise?.title || 'Esercizio'} in attesa`,
        description: `${a.client?.firstName || 'Cliente'} ${a.client?.lastName || ''}`,
        urgency: a.status === "pending" ? "high" : "medium",
        actionUrl: "/consultant/exercises",
        timeAgo: a.assignedAt ? format(new Date(a.assignedAt), "d MMM", { locale: it }) : undefined,
      });
    });
    highPriorityClients?.filter((c: any) => c?.id).slice(0, 2).forEach((client: any, i: number) => {
      items.push({
        id: `lead-${client.id || `fb-${i}`}`,
        type: "lead",
        title: `${client.firstName} ${client.lastName}`,
        description: "Richiede attenzione prioritaria",
        urgency: "high",
        actionUrl: "/consultant/clients",
      });
    });
    appointments?.slice(0, 2).forEach((apt: any) => {
      items.push({
        id: `apt-${apt.id}`,
        type: "appointment",
        title: apt.title || `Con ${apt.clientName || 'Cliente'}`,
        description: "Appuntamento in arrivo",
        urgency: "medium",
        actionUrl: "/consultant/appointments",
        timeAgo: apt.startTime ? format(new Date(apt.startTime), "d MMM HH:mm", { locale: it }) : undefined,
      });
    });
    return items.slice(0, 5);
  }, [pendingExercises, highPriorityClients, appointments]);

  const quickActions = [
    {
      name: "Chatta con AI",
      desc: "Genera insights",
      icon: MessageSquare,
      onClick: () => setLocation("/consultant/ai-assistant"),
      gradient: "linear-gradient(135deg, #6C5CE7 0%, #a78bfa 100%)",
      shadow: "0 8px 24px rgba(108,92,231,0.40)",
      glowColor: "rgba(108,92,231,0.3)",
    },
    {
      name: "Nuovo Cliente",
      desc: "Gestisci clienti",
      icon: UserPlus,
      onClick: () => setLocation("/consultant/clients"),
      gradient: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
      shadow: "0 8px 24px rgba(59,130,246,0.40)",
      glowColor: "rgba(59,130,246,0.3)",
    },
    {
      name: "Chiama Lead",
      desc: "Lead hub",
      icon: Phone,
      onClick: () => setLocation("/consultant/lead-hub"),
      gradient: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
      shadow: "0 8px 24px rgba(16,185,129,0.40)",
      glowColor: "rgba(16,185,129,0.3)",
    },
    {
      name: "Invia Email",
      desc: "AI configurata",
      icon: Mail,
      onClick: () => setLocation("/consultant/ai-config"),
      gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
      shadow: "0 8px 24px rgba(245,158,11,0.40)",
      glowColor: "rgba(245,158,11,0.3)",
    },
  ];

  const urgencyConfig = {
    high: {
      border: "border-l-red-400",
      bg: "bg-red-400/5 hover:bg-red-400/10",
      badge: "bg-red-400/15 text-red-400 border-red-400/30",
      label: "Urgente",
      dot: "bg-red-400",
    },
    medium: {
      border: "border-l-amber-400",
      bg: "bg-amber-400/5 hover:bg-amber-400/10",
      badge: "bg-amber-400/15 text-amber-400 border-amber-400/30",
      label: "Medio",
      dot: "bg-amber-400",
    },
    low: {
      border: "border-l-blue-400",
      bg: "bg-blue-400/5 hover:bg-blue-400/10",
      badge: "bg-blue-400/15 text-blue-400 border-blue-400/30",
      label: "Basso",
      dot: "bg-blue-400",
    },
  };

  const typeConfig = {
    exercise: { icon: FileText, color: "text-amber-500", bg: "bg-amber-500/10" },
    lead: { icon: Target, color: "text-red-500", bg: "bg-red-500/10" },
    appointment: { icon: Clock, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  };

  const formatAptTime = (apt: any) => {
    try {
      const d = apt.startTime ? new Date(apt.startTime) : new Date(apt.date);
      return format(d, "EEEE d MMM · HH:mm", { locale: it });
    } catch { return "Data non disponibile"; }
  };

  const formatAptDay = (apt: any) => {
    try {
      const d = apt.startTime ? new Date(apt.startTime) : new Date(apt.date);
      return format(d, "d", { locale: it });
    } catch { return "—"; }
  };

  const formatAptMonth = (apt: any) => {
    try {
      const d = apt.startTime ? new Date(apt.startTime) : new Date(apt.date);
      return format(d, "MMM", { locale: it }).toUpperCase();
    } catch { return "—"; }
  };

  const userInitials = useMemo(() => {
    const f = user?.firstName?.[0] || '';
    const l = user?.lastName?.[0] || '';
    return (f + l).toUpperCase() || 'C';
  }, [user]);

  const urgentCount = attentionItems.filter(i => i.urgency === "high").length;

  return (
    <PageLayout role="consultant">
      <style>{CSS}</style>

      {/* ── HERO ─────────────────────────────────────────── */}
      <div className="afu">
        <div
          className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
          style={{
            background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
            boxShadow: "0 8px 40px rgba(108,92,231,0.25)",
          }}
        >
          <div className="shimmer-fx absolute inset-0 pointer-events-none" />

          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="avatar-pulse rounded-full shrink-0">
                <Avatar className="h-14 w-14 ring-2 ring-white/20">
                  <AvatarFallback className="text-lg font-black bg-gradient-to-br from-violet-500 to-purple-700 text-white">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div>
                <p className="text-white/50 text-xs font-medium uppercase tracking-widest mb-0.5">{todayLabel}</p>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                  {getGreeting()}, {user?.firstName || 'Consulente'}
                </h1>
                <p className="text-white/60 text-sm mt-1">
                  {urgentCount > 0
                    ? `Hai ${urgentCount} priorit${urgentCount === 1 ? 'à urgente' : 'à urgenti'} da gestire oggi`
                    : "Tutto sotto controllo — ottimo lavoro!"}
                </p>
              </div>
            </div>

            <div className="hidden sm:flex flex-col items-end gap-2 shrink-0">
              {urgentCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-red-300 text-xs font-semibold">{urgentCount} urgenti</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15">
                <Zap className="h-3 w-3 text-yellow-300" />
                <span className="text-white/70 text-xs font-medium">{clients.length} clienti attivi</span>
              </div>
            </div>
          </div>

          {/* Academy inline */}
          <div
            className="relative mt-4 rounded-xl overflow-hidden cursor-pointer group"
            onClick={() => setLocation("/consultant/academy")}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-white/10 rounded-xl" />
            <div className="relative px-4 py-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/30 flex items-center justify-center border border-indigo-400/20 group-hover:scale-105 transition-transform shrink-0">
                <GraduationCap className="h-4 w-4 text-indigo-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-white">Accademia di Formazione</span>
                  <LessonCountBadge className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/15 text-white/70 hidden sm:inline" />
                </div>
                <p className="text-[11px] text-white/40 hidden sm:block">Video tutorial per configurare la piattaforma in autonomia</p>
              </div>
              <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/25 border border-indigo-400/20 text-indigo-200 text-xs font-medium group-hover:bg-indigo-500/35 transition-all">
                <PlayCircle className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Guarda Ora</span>
                <ChevronRight className="h-3 w-3 opacity-60" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ────────────────────────────────────── */}
      <div className="afu-1 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpiCards.map((kpi, idx) => {
          const Icon = kpi.icon;
          const isPositive = kpi.trend >= 0;
          return (
            <div
              key={idx}
              className="kpi-card relative overflow-hidden rounded-2xl p-5 text-white flex flex-col justify-between min-h-[130px]"
              style={{ background: kpi.gradient, boxShadow: kpi.shadow }}
            >
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 -translate-y-6 translate-x-6"
                style={{ background: "rgba(255,255,255,0.8)" }} />

              <div className="flex items-start justify-between">
                <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                  <Icon className="h-4 w-4" />
                </div>
                <div className={cn(
                  "flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full",
                  isPositive ? "bg-white/20" : "bg-black/20"
                )}>
                  {isPositive ? (
                    <TrendingUp className="h-2.5 w-2.5" />
                  ) : (
                    <TrendingDown className="h-2.5 w-2.5" />
                  )}
                  {Math.abs(kpi.trend)}%
                </div>
              </div>

              <div>
                <p className="text-4xl font-black tracking-tight leading-none mb-1">{kpi.value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75 leading-tight">{kpi.title}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] opacity-50">{kpi.trendLabel}</p>
                  <MiniSparkline color="rgba(255,255,255,0.8)" peakValue={Number(kpi.value) || 3} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── AI BRIEFING ──────────────────────────────────── */}
      <div className="afu-2">
        <div className="rounded-2xl overflow-hidden border border-border/40 shadow-lg bg-card">
          {/* Header */}
          <div
            className="relative flex items-center justify-between px-5 py-4 shimmer-fx"
            style={{ background: "linear-gradient(135deg, #4c1d95 0%, #6C5CE7 50%, #9b8cf5 100%)" }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/15 backdrop-blur-sm">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-black text-white leading-none">Briefing AI Giornaliero</h2>
                {aiInsights?.generatedAt && (
                  <p className="text-white/50 text-[11px] mt-0.5">
                    Aggiornato alle {format(new Date(aiInsights.generatedAt), "HH:mm", { locale: it })}
                  </p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => refetchInsights()}
              disabled={loadingInsights}
              className="h-8 text-xs bg-white/15 hover:bg-white/25 text-white border-0 gap-1.5 rounded-xl"
            >
              <RotateCcw className={cn("h-3 w-3", loadingInsights && "animate-spin")} />
              <span>Aggiorna</span>
            </Button>
          </div>

          {/* Body */}
          <div className="px-5 py-5">
            {loadingInsights ? (
              <div className="space-y-3">
                <div className="h-4 bg-muted animate-pulse rounded-full w-5/6" />
                <div className="h-3.5 bg-muted animate-pulse rounded-full w-4/6" />
                <div className="h-3.5 bg-muted animate-pulse rounded-full w-3/6" />
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />
                  ))}
                </div>
              </div>
            ) : aiInsights?.summary ? (
              <div className="space-y-5">
                <p className="text-base text-foreground/85 leading-relaxed font-medium">{aiInsights.summary}</p>

                {aiInsights.highlights?.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {aiInsights.highlights.map((h, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10">
                        <Star className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <p className="text-sm text-foreground/75 leading-snug">{h}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                <div className="p-4 rounded-2xl bg-primary/8">
                  <Sparkles className="h-8 w-8 text-primary/50" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground/70">Briefing AI pronto</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">Clicca "Aggiorna" per il tuo briefing personalizzato di oggi</p>
                </div>
              </div>
            )}
          </div>

          {/* Priorities */}
          {aiInsights?.priorities && aiInsights.priorities.length > 0 && (
            <div className="px-5 pb-5 border-t border-border/40">
              <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.15em] mb-3 pt-4">
                Priorità del giorno
              </p>
              <div className="space-y-2">
                {aiInsights.priorities.map((p, i) => {
                  const colors = [
                    { num: "bg-red-500", ring: "ring-red-400/30", text: "text-red-500" },
                    { num: "bg-amber-500", ring: "ring-amber-400/30", text: "text-amber-500" },
                    { num: "bg-primary", ring: "ring-primary/30", text: "text-primary" },
                  ];
                  const c = colors[i] || colors[2];
                  return (
                    <div key={i} className={cn(
                      "flex items-start gap-3 p-4 rounded-xl border transition-colors",
                      "bg-muted/30 hover:bg-muted/50 border-border/30"
                    )}>
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black text-white shrink-0 ring-2",
                        c.num, c.ring
                      )}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-bold leading-snug", c.text)}>{p.title}</p>
                        <p className="text-xs text-muted-foreground/65 mt-0.5 leading-snug">{p.reason}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 mt-0.5 shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ATTENTION + APPOINTMENTS ─────────────────────── */}
      <div className="afu-3 grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Attention */}
        <Card className="border border-border/40 shadow-md rounded-2xl overflow-hidden bg-card">
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-red-400/10">
                <Flame className="h-4 w-4 text-red-400" />
              </div>
              <CardTitle className="text-base font-bold">Richiede Attenzione</CardTitle>
              {attentionItems.length > 0 && (
                <Badge className="text-[10px] px-2 py-0.5 rounded-full bg-red-400/12 text-red-400 border border-red-400/25 ml-auto">
                  {attentionItems.length} item{attentionItems.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-5 space-y-2">
            {attentionItems.length > 0 ? (
              attentionItems.map((item) => {
                const urg = urgencyConfig[item.urgency];
                const typ = typeConfig[item.type];
                const TypeIcon = typ.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setLocation(item.actionUrl)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all duration-200",
                      "border-l-[3px] border-y-0 border-r-0",
                      urg.border, urg.bg
                    )}
                  >
                    <div className={cn("p-2 rounded-lg shrink-0", typ.bg)}>
                      <TypeIcon className={cn("h-4 w-4", typ.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground/65 truncate mt-0.5">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.timeAgo && (
                        <span className="text-[10px] text-muted-foreground/45 hidden sm:block">{item.timeAgo}</span>
                      )}
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 rounded-full", urg.badge)}>
                        {urg.label}
                      </Badge>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-10">
                <div className="p-4 rounded-2xl bg-emerald-500/8 w-fit mx-auto mb-3">
                  <CheckCircle className="h-8 w-8 text-emerald-500/60" />
                </div>
                <p className="text-sm font-semibold text-foreground/60">Tutto in ordine!</p>
                <p className="text-xs text-muted-foreground/50 mt-0.5">Nessun elemento richiede attenzione</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appointments Timeline */}
        <Card className="border border-border/40 shadow-md rounded-2xl overflow-hidden bg-card">
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10">
                  <Calendar className="h-4 w-4 text-emerald-500" />
                </div>
                <CardTitle className="text-base font-bold">Prossimi Appuntamenti</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground/60 hover:text-foreground gap-1"
                onClick={() => setLocation("/consultant/appointments")}
              >
                Vedi tutti <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {upcomingAppointments.length > 0 ? (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[22px] top-4 bottom-4 w-px bg-gradient-to-b from-emerald-400/40 via-emerald-400/20 to-transparent" />
                <div className="space-y-3">
                  {upcomingAppointments.map((apt: any, idx: number) => (
                    <div
                      key={apt.id}
                      className="flex items-start gap-4 cursor-pointer group"
                      onClick={() => setLocation("/consultant/appointments")}
                    >
                      {/* Date bubble */}
                      <div className={cn(
                        "shrink-0 w-11 flex flex-col items-center justify-center rounded-xl py-1.5 border transition-all duration-200",
                        idx === 0
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/30"
                          : "bg-muted/50 text-foreground/70 border-border/50 group-hover:border-emerald-400/50"
                      )}>
                        <span className="text-lg font-black leading-none">{formatAptDay(apt)}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wide opacity-75">{formatAptMonth(apt)}</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 py-1">
                        <p className="text-sm font-bold truncate text-foreground group-hover:text-emerald-500 transition-colors">
                          {apt.title || apt.clientName || "Appuntamento"}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Clock className="h-3 w-3 text-muted-foreground/50" />
                          <p className="text-xs text-muted-foreground/60 capitalize">{formatAptTime(apt)}</p>
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 mt-2 shrink-0 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <div className="p-4 rounded-2xl bg-emerald-500/8 w-fit mx-auto mb-3">
                  <Calendar className="h-8 w-8 text-emerald-500/50" />
                </div>
                <p className="text-sm font-semibold text-foreground/60">Agenda libera</p>
                <p className="text-xs text-muted-foreground/50 mt-0.5">Nessun appuntamento in programma</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── QUICK ACTIONS ────────────────────────────────── */}
      <div className="afu-4">
        <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-[0.15em] mb-4">Azioni Rapide</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              onClick={action.onClick}
              className="action-btn group relative overflow-hidden rounded-2xl text-white text-left"
              style={{ background: action.gradient, boxShadow: action.shadow }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 36px ${action.glowColor}`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = action.shadow; }}
            >
              <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10 -translate-y-4 translate-x-4"
                style={{ background: "rgba(255,255,255,0.8)" }} />
              <div className="relative p-5">
                <div className="p-2.5 rounded-xl bg-white/20 w-fit mb-3">
                  <action.icon className="h-5 w-5" />
                </div>
                <p className="font-bold text-sm leading-tight">{action.name}</p>
                <p className="text-[11px] opacity-65 mt-0.5">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── PROGRESS RING + RECENT CLIENTS ───────────────── */}
      <div className="afu-5 grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Progress Ring */}
        <Card className="lg:col-span-2 border border-border/40 shadow-md rounded-2xl overflow-hidden bg-card">
          <CardHeader className="pb-2 pt-5 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-base font-bold">Esercizi</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground/60 hover:text-foreground gap-1"
                onClick={() => setLocation("/consultant/exercises")}
              >
                Dettagli <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex items-center gap-5">
              {/* Ring */}
              <div className="relative shrink-0">
                <CircularProgress percentage={exerciseProgress.percentage} size={90} strokeWidth={8} color="#6C5CE7" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-foreground">{exerciseProgress.percentage}%</span>
                </div>
              </div>
              {/* Stats */}
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
                      <CheckCircle className="h-3 w-3 text-emerald-500" /> Completati
                    </span>
                    <span className="text-sm font-black text-emerald-500">{exerciseProgress.completed}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${exerciseProgress.percentage}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
                      <RotateCcw className="h-3 w-3 text-amber-400" /> In revisione
                    </span>
                    <span className="text-sm font-black text-amber-400">{exerciseProgress.pending}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-700"
                      style={{ width: exerciseProgress.total > 0 ? `${(exerciseProgress.pending / exerciseProgress.total) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
                <div className="pt-1 border-t border-border/30">
                  <span className="text-[11px] text-muted-foreground/50">{exerciseProgress.total} totali assegnati</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Clients */}
        <Card className="lg:col-span-3 border border-border/40 shadow-md rounded-2xl overflow-hidden bg-card">
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10">
                  <Activity className="h-4 w-4 text-blue-500" />
                </div>
                <CardTitle className="text-base font-bold">Clienti Recenti</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground/60 hover:text-foreground gap-1"
                onClick={() => setLocation("/consultant/clients")}
              >
                Vedi tutti <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-5">
            {recentClients.length > 0 ? (
              <div className="space-y-2">
                {recentClients.map((client: any) => {
                  const initials = `${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}`.toUpperCase();
                  const isActive = !client.deactivatedAt;
                  return (
                    <div
                      key={client.id}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-all duration-200 cursor-pointer group"
                      onClick={() => setLocation("/consultant/clients")}
                    >
                      <Avatar className="h-10 w-10 shadow-sm shrink-0">
                        <AvatarFallback className="text-sm font-bold bg-gradient-to-br from-primary to-violet-500 text-white">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-foreground">
                          {client.firstName} {client.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground/60 truncate">{client.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={cn(
                          "text-[9px] px-2 py-0 rounded-full border",
                          isActive
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25"
                            : "bg-muted text-muted-foreground border-border/50"
                        )}>
                          {isActive ? "Attivo" : "Inattivo"}
                        </Badge>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground/60 text-sm">
                Nessun cliente recente
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── REFERRAL BANNER ──────────────────────────────── */}
      <button
        onClick={() => setLocation("/consultant/referrals")}
        className="afu-6 w-full group flex items-center justify-between p-5 rounded-2xl transition-all duration-300 hover:shadow-lg border border-pink-400/20"
        style={{
          background: "linear-gradient(135deg, rgba(236,72,153,0.06) 0%, rgba(239,68,68,0.04) 50%, rgba(251,191,36,0.03) 100%)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-pink-500/12 border border-pink-400/20">
            <Gift className="h-5 w-5 text-pink-500" />
          </div>
          <div className="text-left">
            <span className="text-sm font-bold text-foreground block">Invita un Amico</span>
            <span className="text-xs text-muted-foreground/60 mt-0.5 block">Guadagna bonus per ogni cliente portato</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-pink-500/70 group-hover:text-pink-500 transition-colors">
          <span className="text-xs font-semibold hidden sm:block">Scopri di più</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </button>

    </PageLayout>
  );
}
