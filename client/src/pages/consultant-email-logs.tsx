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
  Timer
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
    case "consultation_summary": return { label: "Riepilogo", color: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300" };
    case "welcome": return { label: "Benvenuto", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" };
    case "reminder": return { label: "Promemoria", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" };
    case "feedback": return { label: "Feedback", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" };
    case "custom": return { label: "Personalizzata", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300" };
    case "onboarding": return { label: "Onboarding", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" };
    case "nurturing": return { label: "Lead 365", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" };
    default: return { label: type, color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" };
  }
}

export function EmailLogsContent() {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showTestEmails, setShowTestEmails] = useState(false);
  const [previewEmail, setPreviewEmail] = useState<EmailLog | null>(null);
  const { toast } = useToast();

  const itemsPerPage = 15;

  const { data: emailLogs = [], isLoading: logsLoading } = useQuery<EmailLog[]>({
    queryKey: ["/api/consultant/email-logs", selectedClient, selectedType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedClient !== "all") params.append("clientId", selectedClient);
      if (selectedType !== "all" && selectedType !== "journey") {
        params.append("type", selectedType);
      }
      const response = await fetch(`/api/consultant/email-logs?${params.toString()}`, {
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

  const stats = useMemo(() => {
    const total = emailLogs.length;
    const today = new Date().toDateString();
    const sentToday = emailLogs.filter(log => new Date(log.sentAt).toDateString() === today).length;
    const opened = emailLogs.filter(log => log.openedAt).length;
    const openRate = total > 0 ? (opened / total) * 100 : 0;
    const totalOpens = emailLogs.reduce((sum, log) => sum + (log.openCount || 0), 0);
    const avgOpensPerEmail = opened > 0 ? totalOpens / opened : 0;
    const multiDevice = emailLogs.filter(log => (log.deviceCount || 0) > 1).length;
    const thisWeek = emailLogs.filter(log => {
      const d = new Date(log.sentAt);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= weekAgo;
    }).length;

    const clientEngagement = new Map<string, { name: string; sent: number; opened: number; totalOpens: number }>();
    emailLogs.forEach(log => {
      const existing = clientEngagement.get(log.clientId) || { name: log.clientName, sent: 0, opened: 0, totalOpens: 0 };
      existing.sent++;
      if (log.openedAt) existing.opened++;
      existing.totalOpens += (log.openCount || 0);
      clientEngagement.set(log.clientId, existing);
    });
    const topClients = Array.from(clientEngagement.values())
      .sort((a, b) => b.totalOpens - a.totalOpens)
      .slice(0, 5);

    return { total, sentToday, openRate, totalOpens, avgOpensPerEmail, multiDevice, thisWeek, topClients, opened };
  }, [emailLogs]);

  const filteredEmails = useMemo(() => {
    return emailLogs.filter(email => {
      const matchesSearch = email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTestFilter = showTestEmails || !email.isTest;
      let matchesType = true;
      if (selectedType !== "all") {
        if (selectedType === "journey") {
          matchesType = email.emailType !== "consultation_summary";
        } else {
          matchesType = email.emailType === selectedType;
        }
      }
      let matchesStatus = true;
      if (selectedStatus === "opened") matchesStatus = !!email.openedAt;
      else if (selectedStatus === "not_opened") matchesStatus = !email.openedAt;
      else if (selectedStatus === "multi_open") matchesStatus = (email.openCount || 0) > 1;
      return matchesSearch && matchesTestFilter && matchesType && matchesStatus;
    });
  }, [emailLogs, searchTerm, showTestEmails, selectedType, selectedStatus]);

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
    <div className="space-y-4">
      {logsLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-200 border-t-blue-600 mx-auto"></div>
            <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm font-medium">Caricamento log...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card className="border border-slate-200 dark:border-slate-700 shadow-sm bg-white/80 dark:bg-slate-800/80">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Totali</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.total}</p>
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
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Oggi</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.sentToday}</p>
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
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">% Apertura</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.openRate.toFixed(0)}%</p>
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
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Visualizzazioni</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.totalOpens}</p>
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
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Media aperture</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.avgOpensPerEmail.toFixed(1)}x</p>
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
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Multi-device</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.multiDevice}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

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
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-32 truncate">{client.name}</span>
                        <div className="flex-1">
                          <Progress value={rate} className="h-1.5" />
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
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
                <Select value={selectedType} onValueChange={(v) => { setSelectedType(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[150px] h-8 text-xs">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i tipi</SelectItem>
                    <SelectItem value="journey">Email Journey</SelectItem>
                    <SelectItem value="consultation_summary">Riepilogo</SelectItem>
                    <SelectItem value="welcome">Benvenuto</SelectItem>
                    <SelectItem value="reminder">Promemoria</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                    <SelectItem value="custom">Personalizzata</SelectItem>
                    <SelectItem value="nurturing">Lead 365</SelectItem>
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
                    id="show-test-inline"
                    checked={showTestEmails}
                    onCheckedChange={(checked) => { setShowTestEmails(checked as boolean); setCurrentPage(1); }}
                    className="h-3.5 w-3.5"
                  />
                  <label htmlFor="show-test-inline" className="text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer whitespace-nowrap">
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
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3">Data</TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3">Cliente</TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3">Oggetto</TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3">Tipo</TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3">Stato</TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3 text-center">Aperture</TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3 text-center">Dispositivi</TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3">Tempo risposta</TableHead>
                          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 py-2 px-3 text-right"></TableHead>
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
                              onClick={() => setPreviewEmail(email)}
                            >
                              <TableCell className="py-2 px-3">
                                <div className="text-xs text-slate-700 dark:text-slate-300">
                                  {format(new Date(email.sentAt), "dd/MM", { locale: it })}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                  {format(new Date(email.sentAt), "HH:mm")}
                                </div>
                              </TableCell>
                              <TableCell className="py-2 px-3">
                                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{email.clientName}</span>
                              </TableCell>
                              <TableCell className="py-2 px-3 max-w-[200px]">
                                <span className="text-xs text-slate-600 dark:text-slate-300 truncate block">{email.subject}</span>
                              </TableCell>
                              <TableCell className="py-2 px-3">
                                <div className="flex gap-1">
                                  <Badge className={`${typeInfo.color} text-[10px] px-1.5 py-0 border-0`}>
                                    {typeInfo.label}
                                  </Badge>
                                  {email.isTest && (
                                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-[10px] px-1 py-0 border-0">
                                      <TestTube className="h-2.5 w-2.5" />
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-2 px-3">
                                {email.openedAt ? (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] px-1.5 py-0 border-0">
                                        <MailOpen className="h-2.5 w-2.5 mr-0.5" />
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
                                  <Badge variant="outline" className="text-slate-400 dark:text-slate-500 text-[10px] px-1.5 py-0">
                                    <MailX className="h-2.5 w-2.5 mr-0.5" />
                                    No
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="py-2 px-3 text-center">
                                {openCount > 0 ? (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span className={`text-xs font-semibold ${openCount > 3 ? 'text-amber-600 dark:text-amber-400' : openCount > 1 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>
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
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{deviceCount}</span>
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
                                        <Timer className="h-3 w-3 text-emerald-500" />
                                        <span className="text-[11px] text-slate-600 dark:text-slate-400">{timeToOpen}</span>
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[11px]"
                                  onClick={(e) => { e.stopPropagation(); setPreviewEmail(email); }}
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
        </>
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
