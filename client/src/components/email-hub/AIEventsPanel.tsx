import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  Send,
  FileText,
  Ticket,
  AlertCircle,
  Clock,
  Zap,
  TrendingUp,
  TrendingDown,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  RefreshCw,
  Download,
  Search,
  Sparkles,
  Calendar,
  Mail,
  Settings,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

interface EmailAccount {
  id: string;
  displayName: string;
  emailAddress: string;
}

interface AIEventsPanelProps {
  accounts?: EmailAccount[];
}

interface AIEvent {
  id: string;
  emailId: string;
  accountId: string;
  consultantId: string;
  eventType: string;
  classification?: {
    intent?: string;
    urgency?: string;
    sentiment?: string;
    category?: string;
    suggestedAction?: string;
    riskDetected?: boolean;
    escalationKeywords?: string[];
    urgencyReason?: string;
  };
  confidence?: number;
  confidenceThreshold?: number;
  decision?: string;
  decisionReason?: string;
  draftId?: string;
  draftPreview?: string;
  ticketId?: string;
  modelUsed?: string;
  tokensUsed?: number;
  processingTimeMs?: number;
  knowledgeDocsUsed?: string[];
  emailSubject?: string;
  emailFrom?: string;
  createdAt: string;
}

interface AISummary {
  byEventType: Record<string, number>;
  averages: {
    confidence: number;
    processingTimeMs: number;
  };
  period: number;
  previousPeriod?: {
    byEventType: Record<string, number>;
  };
  dailyBreakdown?: Array<{ date: string; count: number }>;
}

const COLORS = {
  background: "#0F172A",
  containers: "#1E293B",
  accentPrimary: "#6366F1",
  accentSecondary: "#14B8A6",
  warning: "#F59E0B",
  success: "#10B981",
  danger: "#F43F5E",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
};

const eventTypeLabels: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  classification: { label: "Classificazione", icon: Eye, color: COLORS.textSecondary, bgColor: "bg-slate-600" },
  draft_generated: { label: "Bozza generata", icon: FileText, color: COLORS.accentPrimary, bgColor: "bg-indigo-600" },
  auto_sent: { label: "Invio automatico", icon: Send, color: COLORS.success, bgColor: "bg-emerald-600" },
  held_for_review: { label: "In attesa di revisione", icon: Clock, color: COLORS.warning, bgColor: "bg-amber-600" },
  ticket_created: { label: "Ticket creato", icon: Ticket, color: COLORS.accentSecondary, bgColor: "bg-teal-600" },
  escalated: { label: "Escalation", icon: AlertTriangle, color: COLORS.danger, bgColor: "bg-rose-600" },
  skipped: { label: "Saltata", icon: CheckCircle, color: COLORS.textMuted, bgColor: "bg-slate-500" },
  error: { label: "Errore", icon: AlertCircle, color: COLORS.danger, bgColor: "bg-rose-700" },
};

const decisionLabels: Record<string, string> = {
  auto_send: "Invio automatico",
  create_draft: "Bozza creata",
  needs_review: "Richiede revisione",
  create_ticket: "Ticket creato",
  escalate: "Escalation",
  skip: "Saltata",
  error: "Errore",
};

const CHART_COLORS = [
  COLORS.success,
  COLORS.accentPrimary,
  COLORS.warning,
  COLORS.accentSecondary,
  COLORS.danger,
  COLORS.textMuted,
];

type DateRangePreset = "today" | "7days" | "30days" | "all";

export function AIEventsPanel({ accounts = [] }: AIEventsPanelProps) {
  const queryClient = useQueryClient();
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangePreset>("7days");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const limit = 20;

  const getDateFilters = () => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return { dateFrom: startOfDay(now).toISOString(), dateTo: endOfDay(now).toISOString() };
      case "7days":
        return { dateFrom: startOfDay(subDays(now, 7)).toISOString(), dateTo: endOfDay(now).toISOString() };
      case "30days":
        return { dateFrom: startOfDay(subDays(now, 30)).toISOString(), dateTo: endOfDay(now).toISOString() };
      default:
        return {};
    }
  };

  const { data: eventsData, isLoading: loadingEvents, refetch: refetchEvents } = useQuery({
    queryKey: ["ai-events", eventTypeFilter, accountFilter, dateRange, searchQuery, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(page * limit));
      if (eventTypeFilter !== "all") params.set("eventType", eventTypeFilter);
      if (accountFilter !== "all") params.set("accountId", accountFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      
      const dateFilters = getDateFilters();
      if (dateFilters.dateFrom) params.set("dateFrom", dateFilters.dateFrom);
      if (dateFilters.dateTo) params.set("dateTo", dateFilters.dateTo);
      
      const res = await fetch(`/api/email-hub/ai-events?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore nel caricamento degli eventi");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const summaryDays = dateRange === "today" ? 1 : dateRange === "7days" ? 7 : dateRange === "30days" ? 30 : 3650;
  
  const { data: summaryData, isLoading: loadingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ["ai-events-summary", summaryDays, accountFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("days", String(summaryDays));
      if (accountFilter !== "all") params.set("accountId", accountFilter);
      
      const res = await fetch(`/api/email-hub/ai-events/summary?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore nel caricamento del riepilogo");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const events: AIEvent[] = eventsData?.data || [];
  const total = eventsData?.total || 0;
  const summary: AISummary = summaryData?.data;
  const totalPages = Math.ceil(total / limit);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchEvents(), refetchSummary()]);
    setIsRefreshing(false);
  };

  const handleExportCSV = () => {
    if (events.length === 0) return;
    
    const headers = ["Data", "Tipo Evento", "Email", "Mittente", "Decisione", "Confidenza", "Motivo"];
    const rows = events.map(e => [
      format(new Date(e.createdAt), "dd/MM/yyyy HH:mm"),
      eventTypeLabels[e.eventType]?.label || e.eventType,
      e.emailSubject || "-",
      e.emailFrom || "-",
      decisionLabels[e.decision || ""] || e.decision || "-",
      e.confidence !== undefined ? `${(e.confidence * 100).toFixed(0)}%` : "-",
      e.decisionReason || "-",
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `eventi-ai-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleEventExpanded = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const getEventIcon = (eventType: string) => {
    const config = eventTypeLabels[eventType];
    if (!config) return <Zap className="h-4 w-4" />;
    const Icon = config.icon;
    return <Icon className="h-4 w-4" />;
  };

  const getEventBadge = (eventType: string) => {
    const config = eventTypeLabels[eventType];
    if (!config) return <Badge variant="secondary">{eventType}</Badge>;
    return (
      <Badge className={`${config.bgColor} text-white border-0`}>
        {config.label}
      </Badge>
    );
  };

  const formatConfidence = (confidence?: number) => {
    if (confidence === undefined || confidence === null) return "-";
    return `${(confidence * 100).toFixed(0)}%`;
  };

  const calculateTrend = (current: number, previous: number): { direction: "up" | "down" | "neutral"; percentage: number } => {
    if (previous === 0) return { direction: current > 0 ? "up" : "neutral", percentage: current > 0 ? 100 : 0 };
    const change = ((current - previous) / previous) * 100;
    return {
      direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
      percentage: Math.abs(change),
    };
  };

  const pieChartData = useMemo(() => {
    if (!summary?.byEventType) return [];
    return Object.entries(summary.byEventType)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => ({
        name: eventTypeLabels[type]?.label || type,
        value: count,
      }));
  }, [summary]);

  const lineChartData = useMemo(() => {
    if (!summary?.dailyBreakdown || summary.dailyBreakdown.length === 0) {
      return [];
    }
    return summary.dailyBreakdown.map(d => ({
      date: format(new Date(d.date), "dd/MM"),
      count: d.count,
    }));
  }, [summary]);

  const autoSentCount = summary?.byEventType?.auto_sent || 0;
  const draftsCount = (summary?.byEventType?.draft_generated || 0) + (summary?.byEventType?.held_for_review || 0);
  const escalationCount = summary?.byEventType?.escalated || 0;
  const ticketsCount = summary?.byEventType?.ticket_created || 0;

  const prevAutoSent = summary?.previousPeriod?.byEventType?.auto_sent || 0;
  const prevDrafts = (summary?.previousPeriod?.byEventType?.draft_generated || 0) + (summary?.previousPeriod?.byEventType?.held_for_review || 0);
  const prevEscalation = summary?.previousPeriod?.byEventType?.escalated || 0;
  const prevTickets = summary?.previousPeriod?.byEventType?.ticket_created || 0;

  const TrendBadge = ({ current, previous, inverseColors = false }: { current: number; previous: number; inverseColors?: boolean }) => {
    const trend = calculateTrend(current, previous);
    if (trend.direction === "neutral") return null;
    
    const isPositive = inverseColors ? trend.direction === "down" : trend.direction === "up";
    const color = isPositive ? "text-emerald-400" : "text-rose-400";
    const bgColor = isPositive ? "bg-emerald-500/20" : "bg-rose-500/20";
    
    return (
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${bgColor} ${color}`}>
        {trend.direction === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {trend.percentage.toFixed(0)}%
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4" style={{ backgroundColor: COLORS.background }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: COLORS.textPrimary }}>
            <div className="p-2 rounded-lg" style={{ background: `linear-gradient(135deg, ${COLORS.accentPrimary}, ${COLORS.accentSecondary})` }}>
              <Zap className="h-5 w-5 text-white" />
            </div>
            Cronologia AI
          </h2>
          <p className="text-sm mt-1" style={{ color: COLORS.textSecondary }}>
            Storico delle decisioni AI per le email elaborate
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="border-slate-600 hover:bg-slate-700"
            style={{ color: COLORS.textSecondary }}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
            Aggiorna
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={events.length === 0}
            className="border-slate-600 hover:bg-slate-700"
            style={{ color: COLORS.textSecondary }}
          >
            <Download className="h-4 w-4 mr-1" />
            Esporta CSV
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="border-0" style={{ backgroundColor: COLORS.containers }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4" style={{ color: COLORS.success }} />
                <span className="text-xs" style={{ color: COLORS.textSecondary }}>Invii automatici</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>{autoSentCount}</p>
                <TrendBadge current={autoSentCount} previous={prevAutoSent} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0" style={{ backgroundColor: COLORS.containers }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" style={{ color: COLORS.accentPrimary }} />
                <span className="text-xs" style={{ color: COLORS.textSecondary }}>Bozze generate</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>{draftsCount}</p>
                <TrendBadge current={draftsCount} previous={prevDrafts} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0" style={{ backgroundColor: COLORS.containers }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" style={{ color: COLORS.danger }} />
                <span className="text-xs" style={{ color: COLORS.textSecondary }}>Escalation</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>{escalationCount}</p>
                <TrendBadge current={escalationCount} previous={prevEscalation} inverseColors />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0" style={{ backgroundColor: COLORS.containers }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4" style={{ color: COLORS.accentSecondary }} />
                <span className="text-xs" style={{ color: COLORS.textSecondary }}>Ticket creati</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-bold" style={{ color: COLORS.textPrimary }}>{ticketsCount}</p>
                <TrendBadge current={ticketsCount} previous={prevTickets} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0" style={{ backgroundColor: COLORS.containers }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" style={{ color: COLORS.accentPrimary }} />
                <span className="text-xs" style={{ color: COLORS.textSecondary }}>Confidenza media</span>
              </div>
              <p className="text-2xl font-bold mt-1" style={{ color: COLORS.textPrimary }}>
                {formatConfidence(summary.averages.confidence)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-0" style={{ backgroundColor: COLORS.containers }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" style={{ color: COLORS.warning }} />
                <span className="text-xs" style={{ color: COLORS.textSecondary }}>Tempo medio</span>
              </div>
              <p className="text-2xl font-bold mt-1" style={{ color: COLORS.textPrimary }}>
                {summary.averages.processingTimeMs 
                  ? `${(summary.averages.processingTimeMs / 1000).toFixed(1)}s` 
                  : "-"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {summary && pieChartData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-0" style={{ backgroundColor: COLORS.containers }}>
            <CardContent className="p-4">
              <h3 className="text-sm font-medium mb-3" style={{ color: COLORS.textSecondary }}>Eventi ultimi 7 giorni</h3>
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.textMuted }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ backgroundColor: COLORS.containers, border: "none", borderRadius: 8 }}
                      labelStyle={{ color: COLORS.textPrimary }}
                      itemStyle={{ color: COLORS.accentPrimary }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={COLORS.accentPrimary}
                      strokeWidth={2}
                      dot={{ fill: COLORS.accentPrimary, strokeWidth: 0, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0" style={{ backgroundColor: COLORS.containers }}>
            <CardContent className="p-4">
              <h3 className="text-sm font-medium mb-3" style={{ color: COLORS.textSecondary }}>Distribuzione per tipo</h3>
              <div className="h-[120px] flex items-center">
                <ResponsiveContainer width="50%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: COLORS.containers, border: "none", borderRadius: 8 }}
                      labelStyle={{ color: COLORS.textPrimary }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1">
                  {pieChartData.slice(0, 4).map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                      <span style={{ color: COLORS.textSecondary }}>{entry.name}</span>
                      <span className="ml-auto font-medium" style={{ color: COLORS.textPrimary }}>{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: COLORS.containers }}>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" style={{ color: COLORS.textMuted }} />
          <div className="flex gap-1">
            {[
              { key: "today", label: "Oggi" },
              { key: "7days", label: "Ultimi 7 giorni" },
              { key: "30days", label: "Ultimo mese" },
              { key: "all", label: "Tutto" },
            ].map((opt) => (
              <Button
                key={opt.key}
                variant={dateRange === opt.key ? "default" : "ghost"}
                size="sm"
                onClick={() => { setDateRange(opt.key as DateRangePreset); setPage(0); }}
                className={dateRange === opt.key ? "" : "hover:bg-slate-700"}
                style={dateRange === opt.key ? { backgroundColor: COLORS.accentPrimary } : { color: COLORS.textSecondary }}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="h-6 w-px bg-slate-600 hidden md:block" />

        {accounts.length > 0 && (
          <Select value={accountFilter} onValueChange={(v) => { setAccountFilter(v); setPage(0); }}>
            <SelectTrigger className="w-48 border-slate-600" style={{ backgroundColor: COLORS.background, color: COLORS.textSecondary }}>
              <Mail className="h-4 w-4 mr-2" style={{ color: COLORS.textMuted }} />
              <SelectValue placeholder="Tutti gli account" />
            </SelectTrigger>
            <SelectContent style={{ backgroundColor: COLORS.containers }}>
              <SelectItem value="all">Tutti gli account</SelectItem>
              {accounts.map(acc => (
                <SelectItem key={acc.id} value={acc.id}>{acc.displayName || acc.emailAddress}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={eventTypeFilter} onValueChange={(v) => { setEventTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-48 border-slate-600" style={{ backgroundColor: COLORS.background, color: COLORS.textSecondary }}>
            <Filter className="h-4 w-4 mr-2" style={{ color: COLORS.textMuted }} />
            <SelectValue />
          </SelectTrigger>
          <SelectContent style={{ backgroundColor: COLORS.containers }}>
            <SelectItem value="all">Tutti gli eventi</SelectItem>
            <SelectItem value="auto_sent">Invii automatici</SelectItem>
            <SelectItem value="draft_generated">Bozze generate</SelectItem>
            <SelectItem value="held_for_review">In attesa revisione</SelectItem>
            <SelectItem value="escalated">Escalation</SelectItem>
            <SelectItem value="ticket_created">Ticket creati</SelectItem>
            <SelectItem value="error">Errori</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: COLORS.textMuted }} />
          <Input
            placeholder="Cerca per oggetto o mittente..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            className="pl-9 border-slate-600"
            style={{ backgroundColor: COLORS.background, color: COLORS.textPrimary }}
          />
        </div>

        <span className="text-xs ml-auto" style={{ color: COLORS.textMuted }}>
          {total} eventi totali
        </span>
      </div>

      <Card className="flex-1 border-0 overflow-hidden" style={{ backgroundColor: COLORS.containers }}>
        <ScrollArea className="h-full">
          {loadingEvents ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: COLORS.accentPrimary }} />
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 p-8">
              <div 
                className="p-6 rounded-full mb-6"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.accentPrimary}33, ${COLORS.accentSecondary}33)`,
                  boxShadow: `0 0 60px ${COLORS.accentPrimary}40, 0 0 100px ${COLORS.accentSecondary}20`,
                }}
              >
                <Sparkles className="h-12 w-12" style={{ color: COLORS.accentPrimary }} />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: COLORS.textPrimary }}>
                Nessun evento AI registrato
              </h3>
              <p className="text-center max-w-md mb-4" style={{ color: COLORS.textSecondary }}>
                Gli eventi appariranno qui quando l'intelligenza artificiale elaborerà le tue email.
              </p>
              <div className="flex flex-col gap-2 text-sm" style={{ color: COLORS.textMuted }}>
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" style={{ color: COLORS.accentSecondary }} />
                  <span>Configura le impostazioni AI per iniziare</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" style={{ color: COLORS.accentSecondary }} />
                  <span>Aggiungi un account email e attiva l'elaborazione automatica</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" style={{ color: COLORS.accentSecondary }} />
                  <span>L'AI analizzerà e risponderà alle email in arrivo</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {events.map((event) => (
                <Collapsible 
                  key={event.id} 
                  open={expandedEvents.has(event.id)}
                  onOpenChange={() => toggleEventExpanded(event.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="p-4 hover:bg-slate-700/30 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`p-2 rounded-lg ${eventTypeLabels[event.eventType]?.bgColor || 'bg-slate-600'} text-white shrink-0`}>
                            {getEventIcon(event.eventType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {getEventBadge(event.eventType)}
                              {event.decision && (
                                <span className="text-xs" style={{ color: COLORS.textMuted }}>
                                  → {decisionLabels[event.decision] || event.decision}
                                </span>
                              )}
                              <ChevronDown 
                                className={`h-4 w-4 ml-auto transition-transform ${expandedEvents.has(event.id) ? "rotate-180" : ""}`}
                                style={{ color: COLORS.textMuted }}
                              />
                            </div>
                            
                            {event.emailSubject && (
                              <p className="text-sm font-medium mt-1 truncate" style={{ color: COLORS.textPrimary }}>
                                {event.emailSubject}
                              </p>
                            )}
                            
                            {event.emailFrom && (
                              <p className="text-xs truncate" style={{ color: COLORS.textSecondary }}>
                                Da: {event.emailFrom}
                              </p>
                            )}

                            <div className="flex items-center gap-4 mt-2 text-xs flex-wrap" style={{ color: COLORS.textMuted }}>
                              {event.confidence !== undefined && (
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  Confidenza: {formatConfidence(event.confidence)}
                                </span>
                              )}
                              
                              {event.classification?.urgency && (
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs border ${
                                    event.classification.urgency === 'high' 
                                      ? 'border-rose-500 text-rose-400' 
                                      : event.classification.urgency === 'medium' 
                                        ? 'border-amber-500 text-amber-400'
                                        : 'border-slate-500 text-slate-400'
                                  }`}
                                >
                                  {event.classification.urgency === 'high' ? 'Alta urgenza' : event.classification.urgency === 'medium' ? 'Media urgenza' : 'Bassa urgenza'}
                                </Badge>
                              )}

                              {event.processingTimeMs && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {(event.processingTimeMs / 1000).toFixed(1)}s
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-xs shrink-0" style={{ color: COLORS.textMuted }}>
                          {format(new Date(event.createdAt), "dd MMM HH:mm", { locale: it })}
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="px-4 pb-4 pl-14 space-y-3">
                      {event.decisionReason && (
                        <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.background }}>
                          <p className="text-xs font-medium mb-1" style={{ color: COLORS.textSecondary }}>Motivazione decisione:</p>
                          <p className="text-sm" style={{ color: COLORS.textPrimary }}>{event.decisionReason}</p>
                        </div>
                      )}

                      {event.classification && (
                        <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.background }}>
                          <p className="text-xs font-medium mb-2" style={{ color: COLORS.textSecondary }}>Classificazione AI:</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            {event.classification.intent && (
                              <div>
                                <span style={{ color: COLORS.textMuted }}>Intent: </span>
                                <span style={{ color: COLORS.textPrimary }}>{event.classification.intent}</span>
                              </div>
                            )}
                            {event.classification.category && (
                              <div>
                                <span style={{ color: COLORS.textMuted }}>Categoria: </span>
                                <span style={{ color: COLORS.textPrimary }}>{event.classification.category}</span>
                              </div>
                            )}
                            {event.classification.sentiment && (
                              <div>
                                <span style={{ color: COLORS.textMuted }}>Sentiment: </span>
                                <span style={{ color: COLORS.textPrimary }}>{event.classification.sentiment}</span>
                              </div>
                            )}
                            {event.classification.suggestedAction && (
                              <div>
                                <span style={{ color: COLORS.textMuted }}>Azione suggerita: </span>
                                <span style={{ color: COLORS.textPrimary }}>{event.classification.suggestedAction}</span>
                              </div>
                            )}
                          </div>
                          {event.classification.urgencyReason && (
                            <div className="mt-2 pt-2 border-t border-slate-700">
                              <span className="text-xs" style={{ color: COLORS.textMuted }}>Motivo urgenza: </span>
                              <span className="text-xs" style={{ color: COLORS.textPrimary }}>{event.classification.urgencyReason}</span>
                            </div>
                          )}
                          {event.classification.riskDetected && (
                            <div className="mt-2 flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4" style={{ color: COLORS.danger }} />
                              <span className="text-xs font-medium" style={{ color: COLORS.danger }}>Rischio rilevato</span>
                              {event.classification.escalationKeywords && event.classification.escalationKeywords.length > 0 && (
                                <span className="text-xs" style={{ color: COLORS.textMuted }}>
                                  ({event.classification.escalationKeywords.join(", ")})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {event.draftPreview && (
                        <div className="p-3 rounded-lg" style={{ backgroundColor: COLORS.background }}>
                          <p className="text-xs font-medium mb-1" style={{ color: COLORS.textSecondary }}>Anteprima bozza:</p>
                          <p className="text-sm whitespace-pre-wrap" style={{ color: COLORS.textPrimary }}>{event.draftPreview}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-4 text-xs" style={{ color: COLORS.textMuted }}>
                        {event.modelUsed && (
                          <span>Modello: {event.modelUsed}</span>
                        )}
                        {event.tokensUsed && (
                          <span>Token: {event.tokensUsed}</span>
                        )}
                        {event.confidenceThreshold && (
                          <span>Soglia confidenza: {formatConfidence(event.confidenceThreshold)}</span>
                        )}
                        {event.knowledgeDocsUsed && event.knowledgeDocsUsed.length > 0 && (
                          <span>Documenti usati: {event.knowledgeDocsUsed.length}</span>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="border-slate-600 hover:bg-slate-700"
            style={{ color: COLORS.textSecondary }}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Precedente
          </Button>
          <span className="text-sm" style={{ color: COLORS.textSecondary }}>
            Pagina {page + 1} di {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="border-slate-600 hover:bg-slate-700"
            style={{ color: COLORS.textSecondary }}
          >
            Successivo
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
