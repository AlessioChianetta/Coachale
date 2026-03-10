import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Mail, 
  Eye, 
  Filter,
  Calendar,
  TrendingUp,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MailOpen,
  MailX,
  TestTube,
  Sparkles,
  History,
  Inbox,
  Monitor,
  Smartphone,
  MousePointerClick,
  BarChart3,
  Users,
  ArrowUpRight,
  Timer,
  Target,
  Route,
  FileText,
  Bell
} from "lucide-react";
import { NavigationTabs } from "@/components/ui/navigation-tabs";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, formatDistanceToNow } from "date-fns";
import it from "date-fns/locale/it";

interface EmailLog {
  id: string;
  clientId: string;
  clientName: string;
  subject: string;
  body: string;
  status: "sent" | "failed" | "pending";
  emailType: string;
  sentAt: string;
  openedAt?: string | null;
  openCount?: number;
  lastOpenedAt?: string | null;
  deviceCount?: number;
  isTest?: boolean;
  errorMessage?: string;
}

type TabCategory = "lead365" | "journey" | "riepilogo" | "system";

const TAB_TYPE_MAP: Record<TabCategory, string[]> = {
  lead365: ["nurturing"],
  journey: [
    "motivational", "custom", "feedback", "motivation_reminder",
    "recap_obiettivi", "esercizi", "corsi", "momentum", "urgenza",
    "follow_up", "recap", "motivazione", "celebrazione", "libreria",
    "suggerimento", "roadmap", "sprint_finale", "push_finale",
    "preparazione_chiusura", "chiusura_mese", "pianificazione", "obiettivi"
  ],
  riepilogo: ["consultation_summary"],
  system: ["welcome", "reminder", "onboarding", "system_update"],
};

function getTimeBetween(start: string, end: string): string {
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "< 1 min";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ${diffMin % 60}m`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}g ${diffH % 24}h`;
}

function getEmailTypeLabel(type: string): { label: string; color: string } {
  switch (type) {
    case "motivational": return { label: "Motivazionale", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" };
    case "motivation_reminder": return { label: "Reminder", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" };
    case "consultation_summary": return { label: "Riepilogo", color: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300" };
    case "welcome": return { label: "Benvenuto", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" };
    case "reminder": return { label: "Promemoria", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" };
    case "feedback": return { label: "Feedback", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" };
    case "custom": return { label: "Personalizzata", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300" };
    case "onboarding": return { label: "Onboarding", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" };
    case "nurturing": return { label: "Lead 365", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" };
    case "system_update": return { label: "Aggiornamento", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" };
    case "urgenza": return { label: "Urgenza", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" };
    case "sprint_finale": return { label: "Sprint Finale", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" };
    case "push_finale": return { label: "Push Finale", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" };
    case "celebrazione": return { label: "Celebrazione", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" };
    case "recap": case "recap_obiettivi": return { label: "Recap", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" };
    case "follow_up": return { label: "Follow-up", color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300" };
    case "motivazione": return { label: "Motivazione", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" };
    case "esercizi": return { label: "Esercizi", color: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300" };
    case "corsi": return { label: "Corsi", color: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300" };
    case "momentum": return { label: "Momentum", color: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300" };
    case "pianificazione": return { label: "Pianificazione", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" };
    case "obiettivi": return { label: "Obiettivi", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" };
    default: return { label: type, color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" };
  }
}

function computeStats(logs: EmailLog[]) {
  const total = logs.length;
  const today = new Date().toDateString();
  const sentToday = logs.filter(log => new Date(log.sentAt).toDateString() === today).length;
  const opened = logs.filter(log => log.openedAt).length;
  const failed = logs.filter(log => log.status === "failed").length;
  const openRate = total > 0 ? (opened / total) * 100 : 0;
  const totalOpens = logs.reduce((sum, log) => sum + (log.openCount || 0), 0);
  const avgOpensPerEmail = opened > 0 ? totalOpens / opened : 0;
  const multiDevice = logs.filter(log => (log.deviceCount || 0) > 1).length;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const thisWeek = logs.filter(log => new Date(log.sentAt) >= weekAgo).length;
  const thisMonth = logs.filter(log => new Date(log.sentAt) >= monthAgo).length;

  const openedThisWeek = logs.filter(log => new Date(log.sentAt) >= weekAgo && log.openedAt).length;
  const sentThisWeek = logs.filter(log => new Date(log.sentAt) >= weekAgo).length;
  const weekOpenRate = sentThisWeek > 0 ? (openedThisWeek / sentThisWeek) * 100 : 0;

  const clientEngagement = new Map<string, { name: string; sent: number; opened: number; totalOpens: number }>();
  logs.forEach(log => {
    const existing = clientEngagement.get(log.clientId) || { name: log.clientName, sent: 0, opened: 0, totalOpens: 0 };
    existing.sent++;
    if (log.openedAt) existing.opened++;
    existing.totalOpens += (log.openCount || 0);
    clientEngagement.set(log.clientId, existing);
  });
  const topClients = Array.from(clientEngagement.values())
    .sort((a, b) => b.totalOpens - a.totalOpens)
    .slice(0, 5);

  return { total, sentToday, openRate, totalOpens, avgOpensPerEmail, multiDevice, thisWeek, thisMonth, weekOpenRate, topClients, opened, failed };
}

function ReportSection({ stats, category }: { stats: ReturnType<typeof computeStats>; category: TabCategory }) {
  const colorMap: Record<TabCategory, { bg: string; icon: string }> = {
    lead365: { bg: "bg-green-100 dark:bg-green-900/30", icon: "text-green-600 dark:text-green-400" },
    journey: { bg: "bg-amber-100 dark:bg-amber-900/30", icon: "text-amber-600 dark:text-amber-400" },
    riepilogo: { bg: "bg-violet-100 dark:bg-violet-900/30", icon: "text-violet-600 dark:text-violet-400" },
    system: { bg: "bg-cyan-100 dark:bg-cyan-900/30", icon: "text-cyan-600 dark:text-cyan-400" },
  };
  const colors = colorMap[category];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 ${colors.bg} rounded-lg`}>
                <Mail className={`h-4 w-4 ${colors.icon}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Totali</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Send className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Oggi</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.sentToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <MailOpen className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">% Apertura</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.openRate.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Eye className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Visualizzazioni</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.totalOpens}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
                <TrendingUp className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Media aperture</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.avgOpensPerEmail.toFixed(1)}x</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                <Monitor className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Multi-device</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{stats.multiDevice}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" />
              Riepilogo Periodo
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Ultima settimana</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{stats.thisWeek} inviate</span>
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-[10px] px-1.5 py-0 border-0">
                    {stats.weekOpenRate.toFixed(0)}% aperte
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Ultimo mese</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{stats.thisMonth} inviate</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Fallite</span>
                <span className={`text-sm font-semibold ${stats.failed > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>{stats.failed}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Tasso apertura globale</span>
                <div className="flex items-center gap-2">
                  <Progress value={stats.openRate} className="h-1.5 w-20" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{stats.openRate.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {stats.topClients.length > 0 && (
          <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                Engagement per Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="space-y-2">
                {stats.topClients.map((client, i) => {
                  const rate = client.sent > 0 ? (client.opened / client.sent) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-36 truncate">{client.name}</span>
                      <div className="flex-1">
                        <Progress value={rate} className="h-1.5" />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                        <span>{client.sent} inv.</span>
                        <span>{rate.toFixed(0)}% aperte</span>
                        <span className="font-medium text-amber-600 dark:text-amber-400">{client.totalOpens} views</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function EmailTable({ 
  emails, 
  clients, 
  showTypeColumn,
  onPreview 
}: { 
  emails: EmailLog[]; 
  clients: any[];
  showTypeColumn?: boolean;
  onPreview: (email: EmailLog) => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showTestEmails, setShowTestEmails] = useState(false);
  const itemsPerPage = 15;

  const filteredEmails = useMemo(() => {
    return emails.filter(email => {
      const matchesSearch = email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTestFilter = showTestEmails || !email.isTest;
      const matchesClient = selectedClient === "all" || email.clientId === selectedClient;
      let matchesStatus = true;
      if (selectedStatus === "opened") matchesStatus = !!email.openedAt;
      else if (selectedStatus === "not_opened") matchesStatus = !email.openedAt;
      else if (selectedStatus === "multi_open") matchesStatus = (email.openCount || 0) > 1;
      return matchesSearch && matchesTestFilter && matchesClient && matchesStatus;
    });
  }, [emails, searchTerm, showTestEmails, selectedClient, selectedStatus]);

  const totalPages = Math.ceil(filteredEmails.length / itemsPerPage);
  const safePage = Math.min(currentPage, totalPages || 1);
  const paginatedEmails = filteredEmails.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 text-[11px] px-1.5 py-0">
            <CheckCircle className="h-3 w-3 mr-0.5" />
            Inviata
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 text-[11px] px-1.5 py-0">
            <XCircle className="h-3 w-3 mr-0.5" />
            Fallita
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 text-[11px] px-1.5 py-0">
            <Clock className="h-3 w-3 mr-0.5" />
            In attesa
          </Badge>
        );
      default:
        return <Badge className="text-[11px] px-1.5 py-0">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[180px]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cerca per oggetto o cliente..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="pl-8 h-8 text-sm"
                />
              </div>
            </div>
            <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i clienti</SelectItem>
                {clients.map((client: any) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.firstName} {client.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={(v) => { setSelectedStatus(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Stato lettura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                <SelectItem value="opened">Aperte</SelectItem>
                <SelectItem value="not_opened">Non aperte</SelectItem>
                <SelectItem value="multi_open">Rilette (2+)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Checkbox 
                id={`show-test-${showTypeColumn ? 'typed' : 'untyped'}`}
                checked={showTestEmails}
                onCheckedChange={(checked) => { setShowTestEmails(checked as boolean); setCurrentPage(1); }}
                className="h-3.5 w-3.5"
              />
              <label htmlFor={`show-test-${showTypeColumn ? 'typed' : 'untyped'}`} className="text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer whitespace-nowrap">
                Test
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
        <CardContent className="p-0">
          {paginatedEmails.length === 0 ? (
            <div className="text-center py-12">
              <MailX className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Nessuna email trovata</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Prova a modificare i filtri</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-200 dark:border-slate-700">
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2.5 px-3">Data</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2.5 px-3">Cliente</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2.5 px-3">Oggetto</TableHead>
                      {showTypeColumn && (
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2.5 px-3">Tipo</TableHead>
                      )}
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2.5 px-3">Stato</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2.5 px-3 text-center">Aperture</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2.5 px-3 text-center">Dispositivi</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2.5 px-3">Tempo risposta</TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2.5 px-3 text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEmails.map((email) => {
                      const typeInfo = getEmailTypeLabel(email.emailType);
                      const openCount = email.openCount || 0;
                      const deviceCount = email.deviceCount || 0;
                      const timeToOpen = email.openedAt ? getTimeBetween(email.sentAt, email.openedAt) : null;

                      return (
                        <TableRow 
                          key={email.id} 
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                          onClick={() => onPreview(email)}
                        >
                          <TableCell className="py-2.5 px-3">
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                              {format(new Date(email.sentAt), "dd/MM", { locale: it })}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500">
                              {format(new Date(email.sentAt), "HH:mm")}
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 px-3">
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{email.clientName}</span>
                          </TableCell>
                          <TableCell className="py-2.5 px-3 max-w-[220px]">
                            <span className="text-sm text-slate-600 dark:text-slate-300 truncate block">{email.subject}</span>
                          </TableCell>
                          {showTypeColumn && (
                            <TableCell className="py-2 px-3">
                              <div className="flex gap-1">
                                <Badge className={`${typeInfo.color} text-[11px] px-1.5 py-0.5 border-0`}>
                                  {typeInfo.label}
                                </Badge>
                                {email.isTest && (
                                  <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-[11px] px-1 py-0.5 border-0">
                                    <TestTube className="h-3 w-3" />
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          )}
                          <TableCell className="py-2 px-3">
                            {email.openedAt ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[11px] px-1.5 py-0.5 border-0">
                                    <MailOpen className="h-3 w-3 mr-0.5" />
                                    Letta
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Prima apertura: {format(new Date(email.openedAt), "dd/MM/yyyy HH:mm")}</p>
                                  {email.lastOpenedAt && email.lastOpenedAt !== email.openedAt && (
                                    <p className="text-xs">Ultima: {format(new Date(email.lastOpenedAt), "dd/MM/yyyy HH:mm")}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Badge variant="outline" className="text-slate-400 dark:text-slate-500 text-[11px] px-1.5 py-0.5">
                                <MailX className="h-3 w-3 mr-0.5" />
                                No
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-center">
                            {openCount > 0 ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className={`text-sm font-semibold ${openCount > 3 ? 'text-amber-600 dark:text-amber-400' : openCount > 1 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                    {openCount}x
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Aperta {openCount} {openCount === 1 ? 'volta' : 'volte'}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-[10px] text-slate-300 dark:text-slate-600">-</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-center">
                            {deviceCount > 0 ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="flex items-center justify-center gap-0.5">
                                    {deviceCount > 1 ? (
                                      <Smartphone className="h-3 w-3 text-cyan-500" />
                                    ) : (
                                      <Monitor className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                                    )}
                                    <span className="text-xs text-slate-500 dark:text-slate-400">{deviceCount}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">{deviceCount} {deviceCount === 1 ? 'dispositivo' : 'dispositivi diversi'}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-[10px] text-slate-300 dark:text-slate-600">-</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-3">
                            {timeToOpen ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className="flex items-center gap-1">
                                    <Timer className="h-3.5 w-3.5 text-emerald-500" />
                                    <span className="text-xs text-slate-600 dark:text-slate-400">{timeToOpen}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Tempo tra invio e prima apertura</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-[10px] text-slate-300 dark:text-slate-600">-</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-right">
                            {!showTypeColumn && email.isTest && (
                              <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-[11px] px-1 py-0.5 border-0 mr-1">
                                <TestTube className="h-3 w-3" />
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              onClick={(e) => { e.stopPropagation(); onPreview(email); }}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </TooltipProvider>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {filteredEmails.length} email &middot; pag. {safePage}/{totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={safePage === 1}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let page: number;
                      if (totalPages <= 7) {
                        page = i + 1;
                      } else if (safePage <= 4) {
                        page = i + 1;
                      } else if (safePage >= totalPages - 3) {
                        page = totalPages - 6 + i;
                      } else {
                        page = safePage - 3 + i;
                      }
                      return (
                        <Button
                          key={page}
                          variant={safePage === page ? "default" : "ghost"}
                          size="sm"
                          className="h-7 w-7 p-0 text-xs"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={safePage === totalPages}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function EmailLogsContent() {
  const [activeTab, setActiveTab] = useState<TabCategory>("lead365");
  const [previewEmail, setPreviewEmail] = useState<EmailLog | null>(null);

  const { data: emailLogs = [], isLoading: logsLoading } = useQuery<EmailLog[]>({
    queryKey: ["/api/consultant/email-logs"],
    queryFn: async () => {
      const response = await fetch(`/api/consultant/email-logs`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch email logs");
      return response.json();
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  const categorizedEmails = useMemo(() => {
    const result: Record<TabCategory, EmailLog[]> = {
      lead365: [],
      journey: [],
      riepilogo: [],
      system: [],
    };
    emailLogs.forEach(log => {
      for (const [cat, types] of Object.entries(TAB_TYPE_MAP)) {
        if (types.includes(log.emailType)) {
          result[cat as TabCategory].push(log);
          return;
        }
      }
      result.journey.push(log);
    });
    return result;
  }, [emailLogs]);

  const tabStats = useMemo(() => ({
    lead365: computeStats(categorizedEmails.lead365),
    journey: computeStats(categorizedEmails.journey),
    riepilogo: computeStats(categorizedEmails.riepilogo),
    system: computeStats(categorizedEmails.system),
  }), [categorizedEmails]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 text-[11px] px-1.5 py-0">
            <CheckCircle className="h-3 w-3 mr-0.5" />
            Inviata
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 text-[11px] px-1.5 py-0">
            <XCircle className="h-3 w-3 mr-0.5" />
            Fallita
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300 text-[11px] px-1.5 py-0">
            <Clock className="h-3 w-3 mr-0.5" />
            In attesa
          </Badge>
        );
      default:
        return <Badge className="text-[11px] px-1.5 py-0">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {logsLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-200 border-t-blue-600 mx-auto"></div>
            <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm font-medium">Caricamento log...</p>
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabCategory)}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="lead365" className="text-xs gap-1.5">
              <Target className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Lead 365</span>
              <span className="sm:hidden">L365</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">{categorizedEmails.lead365.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="journey" className="text-xs gap-1.5">
              <Route className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Email Journey</span>
              <span className="sm:hidden">Journey</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">{categorizedEmails.journey.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="riepilogo" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Riepilogo</span>
              <span className="sm:hidden">Riep.</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">{categorizedEmails.riepilogo.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">System Update</span>
              <span className="sm:hidden">System</span>
              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5">{categorizedEmails.system.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lead365" className="space-y-4 mt-4">
            <ReportSection stats={tabStats.lead365} category="lead365" />
            <EmailTable 
              emails={categorizedEmails.lead365} 
              clients={clients} 
              onPreview={setPreviewEmail} 
            />
          </TabsContent>

          <TabsContent value="journey" className="space-y-4 mt-4">
            <ReportSection stats={tabStats.journey} category="journey" />
            <EmailTable 
              emails={categorizedEmails.journey} 
              clients={clients} 
              showTypeColumn
              onPreview={setPreviewEmail} 
            />
          </TabsContent>

          <TabsContent value="riepilogo" className="space-y-4 mt-4">
            <ReportSection stats={tabStats.riepilogo} category="riepilogo" />
            <EmailTable 
              emails={categorizedEmails.riepilogo} 
              clients={clients} 
              onPreview={setPreviewEmail} 
            />
          </TabsContent>

          <TabsContent value="system" className="space-y-4 mt-4">
            <ReportSection stats={tabStats.system} category="system" />
            <EmailTable 
              emails={categorizedEmails.system} 
              clients={clients} 
              showTypeColumn
              onPreview={setPreviewEmail} 
            />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={!!previewEmail} onOpenChange={() => setPreviewEmail(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Dettaglio Email
            </DialogTitle>
            <DialogDescription className="text-xs">
              Inviata a {previewEmail?.clientName} il {previewEmail && format(new Date(previewEmail.sentAt), "dd MMMM yyyy 'alle' HH:mm", { locale: it })}
            </DialogDescription>
          </DialogHeader>

          {previewEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Stato</p>
                  {getStatusBadge(previewEmail.status)}
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Lettura</p>
                  {previewEmail.openedAt ? (
                    <div>
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] px-1.5 py-0 border-0">
                        <MailOpen className="h-2.5 w-2.5 mr-0.5" />
                        Letta
                      </Badge>
                      <p className="text-[10px] text-slate-500 mt-1">{format(new Date(previewEmail.openedAt), "dd/MM HH:mm")}</p>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-slate-400 text-[10px] px-1.5 py-0">Non letta</Badge>
                  )}
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Aperture</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{previewEmail.openCount || 0}</span>
                    <span className="text-[10px] text-slate-400">volte</span>
                  </div>
                  {previewEmail.lastOpenedAt && previewEmail.lastOpenedAt !== previewEmail.openedAt && (
                    <p className="text-[10px] text-slate-500 mt-0.5">Ultima: {format(new Date(previewEmail.lastOpenedAt), "dd/MM HH:mm")}</p>
                  )}
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Dispositivi</p>
                  <div className="flex items-center gap-1.5">
                    {(previewEmail.deviceCount || 0) > 1 ? (
                      <Smartphone className="h-4 w-4 text-cyan-500" />
                    ) : (previewEmail.deviceCount || 0) === 1 ? (
                      <Monitor className="h-4 w-4 text-slate-400" />
                    ) : null}
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{previewEmail.deviceCount || 0}</span>
                  </div>
                  {previewEmail.openedAt && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-0.5">
                      <Timer className="h-2.5 w-2.5" />
                      {getTimeBetween(previewEmail.sentAt, previewEmail.openedAt)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 py-2">
                {(() => {
                  const typeInfo = getEmailTypeLabel(previewEmail.emailType);
                  return <Badge className={`${typeInfo.color} text-[11px] px-2 py-0.5 border-0`}>{typeInfo.label}</Badge>;
                })()}
                {previewEmail.isTest && (
                  <Badge className="bg-yellow-100 text-yellow-800 text-[11px] px-2 py-0.5 border-0">
                    <TestTube className="h-3 w-3 mr-1" />
                    Test
                  </Badge>
                )}
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Oggetto</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{previewEmail.subject}</p>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Contenuto</p>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg overflow-auto max-h-[400px]">
                  <div className="p-4" dangerouslySetInnerHTML={{ __html: previewEmail.body }} />
                </div>
              </div>

              {previewEmail.status === "failed" && previewEmail.errorMessage && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-xs font-medium text-red-800 dark:text-red-300 mb-0.5">Errore</p>
                  <p className="text-xs text-red-600 dark:text-red-400">{previewEmail.errorMessage}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ConsultantEmailLogsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 p-6 overflow-y-auto">
          <NavigationTabs
            tabs={[
              { label: "Configurazione", href: "/consultant/ai-config", icon: Sparkles },
              { label: "Log Email", href: "/consultant/email-logs", icon: History },
              { label: "Email Hub", href: "/consultant/email-hub", icon: Inbox },
            ]}
          />
          <EmailLogsContent />
        </div>
      </div>
      <ConsultantAIAssistant />
    </div>
  );
}
