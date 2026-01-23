import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  CalendarCheck, 
  Send, 
  MessageCircle, 
  TrendingUp, 
  Clock, 
  Sparkles,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageSquare,
  ChevronDown,
  History,
  UserCheck,
  UserX,
  Phone,
  AlertCircle,
  BarChart3,
  Settings,
  PlayCircle,
  Timer
} from "lucide-react";

interface CheckinConfig {
  id: string;
  consultantId: string;
  agentConfigId: string | null;
  isEnabled: boolean;
  preferredTimeStart: string;
  preferredTimeEnd: string;
  excludedDays: number[];
  templateIds: string[];
  useAiPersonalization: boolean;
  targetAudience: string;
  minDaysSinceLastContact: number;
  totalSent: number;
  totalResponses: number;
}

interface WhatsAppAgent {
  id: string;
  agentName: string;
  phoneNumber: string;
  isActive: boolean;
}

interface WhatsAppTemplate {
  id: string;
  friendlyName: string;
  bodyText: string;
  approvalStatus: string;
  useCase?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  "Setter": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "bg-blue-500" },
  "Receptionist": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: "bg-green-500" },
  "Follow-up": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", icon: "bg-orange-500" },
  "Check-in": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: "bg-purple-500" },
  "Riattivazione": { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200", icon: "bg-pink-500" },
  "Notifica": { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", icon: "bg-cyan-500" },
  "Generale": { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", icon: "bg-gray-500" },
};

interface CheckinLog {
  id: string;
  clientId: string;
  phoneNumber: string;
  templateName: string;
  personalizedMessage: string;
  status: string;
  scheduledFor: string;
  sentAt: string | null;
  repliedAt: string | null;
  clientName?: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

interface EligibleClient {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  isActive: boolean;
  enabledForWeeklyCheckin: boolean;
  lastCheckinSent: string | null;
  daysSinceLastContact: number | null;
  blockingReason?: string | null;
  exclusionReason?: string;
}

interface EligibleClientsResponse {
  eligible: EligibleClient[];
  excluded: (EligibleClient & { exclusionReason: string })[];
  config: {
    isEnabled: boolean;
    minDaysSinceLastContact: number;
  };
}

interface LogsResponse {
  logs: CheckinLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface NextSendResponse {
  isEnabled: boolean;
  nextSendAt: string | null;
  selectedTemplate: {
    id: string;
    name: string;
    bodyText: string;
  } | null;
  templateCount?: number;
  message: string | null;
  isFromScheduledLog?: boolean;
  isEstimate?: boolean;
  clientName?: string | null;
  schedulerRanToday?: boolean;
  lastSchedulerRun?: string | null;
  awaitingScheduler?: boolean;
  noSendsToday?: boolean;
}

const DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Gio" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sab" },
];

export function WeeklyCheckinCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const { data: config, isLoading: configLoading } = useQuery<CheckinConfig | null>({
    queryKey: ["/api/weekly-checkin/config"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<WhatsAppTemplate[]>({
    queryKey: ["/api/weekly-checkin/templates"],
  });

  const { data: agentsData } = useQuery({
    queryKey: ["/api/whatsapp/config/proactive"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/whatsapp/config/proactive");
      if (!response) return { configs: [] };
      return response;
    },
  });
  
  const whatsappAgents = agentsData?.configs || [];

  const categorizeTemplate = (template: WhatsAppTemplate): string => {
    const name = (template.friendlyName || "").toLowerCase();
    const useCase = (template.useCase || "").toLowerCase();
    
    if (name.includes("setter") || useCase.includes("setter")) return "Setter";
    if (name.includes("receptionist") || useCase.includes("receptionist")) return "Receptionist";
    if (name.includes("follow-up") || name.includes("followup") || useCase.includes("follow")) return "Follow-up";
    if (name.includes("check") || useCase.includes("check")) return "Check-in";
    if (name.includes("riattivazione") || name.includes("riattiva") || useCase.includes("riattiva")) return "Riattivazione";
    if (name.includes("notifica") || name.includes("promemoria") || useCase.includes("notifica")) return "Notifica";
    return "Generale";
  };

  const templatesByCategory = useMemo(() => {
    const grouped: Record<string, WhatsAppTemplate[]> = {};
    templates.forEach((template) => {
      const category = categorizeTemplate(template);
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(template);
    });
    return grouped;
  }, [templates]);

  const [logsPage, setLogsPage] = useState(1);
  const [activeTab, setActiveTab] = useState("dashboard");

  const { data: logsData } = useQuery<LogsResponse>({
    queryKey: ["/api/weekly-checkin/logs", logsPage],
    queryFn: () => apiRequest("GET", `/api/weekly-checkin/logs?page=${logsPage}&limit=10`),
  });

  const logs = logsData?.logs || [];

  const { data: pendingLogsData } = useQuery<{ logs: CheckinLog[] }>({
    queryKey: ["/api/weekly-checkin/pending-logs"],
    queryFn: () => apiRequest("GET", "/api/weekly-checkin/pending-logs?limit=10"),
    refetchInterval: 30000,
  });

  const pendingLogs = pendingLogsData?.logs || [];

  const { data: stats } = useQuery<{ totalSent: number; totalResponses: number; responseRate: number; lastRunAt: string | null }>({
    queryKey: ["/api/weekly-checkin/stats"],
  });

  const { data: eligibleData, isLoading: eligibleLoading, refetch: refetchEligible } = useQuery<EligibleClientsResponse>({
    queryKey: ["/api/weekly-checkin/eligible-clients"],
    queryFn: async () => {
      console.log("[WEEKLY-CHECKIN] Fetching eligible clients...");
      try {
        const data = await apiRequest("GET", "/api/weekly-checkin/eligible-clients");
        console.log("[WEEKLY-CHECKIN] Eligible clients response:", data);
        console.log("[WEEKLY-CHECKIN] Eligible count:", data?.eligible?.length || 0);
        console.log("[WEEKLY-CHECKIN] Excluded count:", data?.excluded?.length || 0);
        return data;
      } catch (error: any) {
        console.log("[WEEKLY-CHECKIN] Error fetching clients:", error?.message);
        if (error?.message?.includes("401")) {
          return { eligible: [], excluded: [], config: { isEnabled: false, minDaysSinceLastContact: 5 } };
        }
        throw error;
      }
    },
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Query for next scheduled send
  const { data: nextSendData } = useQuery<NextSendResponse>({
    queryKey: ["/api/weekly-checkin/next-send"],
    refetchInterval: 60000, // Refresh every minute
  });

  // Live countdown state
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  // Update countdown every second
  useEffect(() => {
    if (!nextSendData?.nextSendAt) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const target = new Date(nextSendData.nextSendAt!).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [nextSendData?.nextSendAt]);

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (!config) {
        await apiRequest("POST", "/api/weekly-checkin/config", { isEnabled: true });
        return;
      }
      return apiRequest("PATCH", "/api/weekly-checkin/config/toggle");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-checkin/config"] });
      toast({ title: config?.isEnabled ? "Check-in disabilitato" : "Check-in abilitato" });
    },
    onError: async (error: any) => {
      if (error.message?.includes("404") || error.status === 404) {
        await apiRequest("POST", "/api/weekly-checkin/config", { isEnabled: true });
        queryClient.invalidateQueries({ queryKey: ["/api/weekly-checkin/config"] });
        toast({ title: "Check-in abilitato" });
      } else {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
      }
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data: Partial<CheckinConfig>) => apiRequest("POST", "/api/weekly-checkin/config", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-checkin/config"] });
      toast({ title: "Configurazione salvata" });
    },
  });

  const testMutation = useMutation({
    mutationFn: (clientId: string) => apiRequest("POST", "/api/weekly-checkin/test", { clientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-checkin/logs"] });
      setTestDialogOpen(false);
      setSelectedClientId("");
      toast({ title: "Check-in di test programmato" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const testSendMutation = useMutation({
    mutationFn: (clientId: string) => apiRequest("POST", "/api/weekly-checkin/send-test", { clientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-checkin/logs"] });
      setTestDialogOpen(false);
      setSelectedClientId("");
      toast({ 
        title: "Test inviato!",
        description: "Il messaggio di check-in è stato inviato con successo."
      });
    },
    onError: (error: any) => {
      toast({ title: "Errore nell'invio", description: error.message, variant: "destructive" });
    },
  });

  const toggleClientMutation = useMutation({
    mutationFn: ({ clientId, enabled }: { clientId: string; enabled: boolean }) => 
      apiRequest("POST", "/api/weekly-checkin/toggle-client", { clientId, enabled }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-checkin/eligible-clients"] });
      toast({ 
        title: variables.enabled ? "Cliente aggiunto" : "Cliente rimosso",
        description: variables.enabled ? "Riceverà i check-in settimanali" : "Non riceverà più i check-in"
      });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const handleTemplateToggle = (templateId: string, isChecked: boolean) => {
    const currentIds = config?.templateIds || [];
    const newIds = isChecked
      ? [...currentIds, templateId]
      : currentIds.filter((id) => id !== templateId);
    updateConfigMutation.mutate({ templateIds: newIds });
  };

  const handleDayToggle = (day: number, isExcluded: boolean) => {
    const currentExcluded = config?.excludedDays || [];
    const newExcluded = isExcluded
      ? currentExcluded.filter((d) => d !== day)
      : [...currentExcluded, day];
    updateConfigMutation.mutate({ excludedDays: newExcluded });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "replied":
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  if (configLoading) {
    return (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg">
              <CalendarCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                Check-in Settimanale Automatico
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Contatta automaticamente i tuoi clienti ogni settimana
              </p>
            </div>
          </div>
          <Switch
            checked={config?.isEnabled || false}
            onCheckedChange={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="dashboard" className="text-xs gap-1">
              <BarChart3 className="h-3 w-3" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="clients" className="text-xs gap-1">
              <Users className="h-3 w-3" />
              Clienti
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1">
              <History className="h-3 w-3" />
              Cronologia
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs gap-1">
              <Settings className="h-3 w-3" />
              Impostazioni
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 mt-0">
            {/* SEZIONE COUNTDOWN PROMINENTE */}
            <div className="p-6 rounded-2xl border-2 border-indigo-300 dark:border-indigo-700 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/40 dark:via-purple-950/40 dark:to-pink-950/40 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
                    <Timer className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Prossimo Invio Automatico
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Countdown al prossimo check-in
                    </p>
                  </div>
                </div>
                {nextSendData?.isEnabled && countdown && (
                  <Badge className="bg-green-500 text-white px-3 py-1 text-sm font-semibold animate-pulse">
                    ATTIVO
                  </Badge>
                )}
              </div>
                  
              {!nextSendData?.isEnabled ? (
                <div className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800/50 text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    {nextSendData?.message || "Check-in automatico disabilitato"}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Attiva il toggle in alto a destra per abilitare gli invii automatici
                  </p>
                </div>
              ) : nextSendData?.awaitingScheduler ? (
                    <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          In attesa dello scheduler
                        </span>
                        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                          08:00
                        </Badge>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Lo scheduler programmerà gli invii alle 08:00. I check-in verranno creati automaticamente.
                      </p>
                    </div>
                  ) : nextSendData?.message ? (
                    <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {nextSendData.message}
                    </p>
                  ) : countdown ? (
                    <div className="mt-3 space-y-3">
                      {/* Scheduled vs Estimate indicator */}
                      {nextSendData.isFromScheduledLog ? (
                        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Invio programmato
                          {nextSendData.clientName && ` per ${nextSendData.clientName}`}
                        </p>
                      ) : nextSendData.noSendsToday ? (
                        <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Nessun invio per oggi (prossimo invio stimato)
                        </p>
                      ) : nextSendData.isEstimate && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Stima (lo scheduler programmerà gli invii alle 08:00)
                        </p>
                      )}
                      
                      {/* Countdown Timer - GRANDE E VISIBILE */}
                      <div className="flex justify-center py-4">
                        <div className="flex gap-3">
                          <div className="bg-gradient-to-b from-indigo-500 to-indigo-700 text-white px-4 py-3 rounded-xl text-center min-w-[70px] shadow-lg">
                            <div className="text-3xl font-bold font-mono">{countdown.days}</div>
                            <div className="text-xs uppercase tracking-wider opacity-80 mt-1">giorni</div>
                          </div>
                          <div className="flex items-center text-2xl font-bold text-indigo-400">:</div>
                          <div className="bg-gradient-to-b from-indigo-500 to-indigo-700 text-white px-4 py-3 rounded-xl text-center min-w-[70px] shadow-lg">
                            <div className="text-3xl font-bold font-mono">{String(countdown.hours).padStart(2, '0')}</div>
                            <div className="text-xs uppercase tracking-wider opacity-80 mt-1">ore</div>
                          </div>
                          <div className="flex items-center text-2xl font-bold text-indigo-400">:</div>
                          <div className="bg-gradient-to-b from-indigo-500 to-indigo-700 text-white px-4 py-3 rounded-xl text-center min-w-[70px] shadow-lg">
                            <div className="text-3xl font-bold font-mono">{String(countdown.minutes).padStart(2, '0')}</div>
                            <div className="text-xs uppercase tracking-wider opacity-80 mt-1">min</div>
                          </div>
                          <div className="flex items-center text-2xl font-bold text-purple-400">:</div>
                          <div className="bg-gradient-to-b from-purple-500 to-purple-700 text-white px-4 py-3 rounded-xl text-center min-w-[70px] shadow-lg animate-pulse">
                            <div className="text-3xl font-bold font-mono">{String(countdown.seconds).padStart(2, '0')}</div>
                            <div className="text-xs uppercase tracking-wider opacity-80 mt-1">sec</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Template selezionato */}
                      {nextSendData.selectedTemplate && (
                        <div className="p-3 rounded-lg bg-white/80 dark:bg-gray-800/50 border border-indigo-100 dark:border-indigo-900">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="h-4 w-4 text-indigo-500" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Template: {nextSendData.selectedTemplate.name}
                            </span>
                            {(nextSendData.templateCount || 0) > 1 && (
                              <Badge variant="outline" className="text-xs">
                                1 di {nextSendData.templateCount} in rotazione
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 italic line-clamp-2">
                            "{nextSendData.selectedTemplate.bodyText}"
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 mt-1">Caricamento...</p>
                  )}
                </div>
              </div>
            </div>

            {/* Statistiche */}
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {stats?.totalSent || 0}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Inviati</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-green-50 dark:bg-green-900/20">
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {stats?.totalResponses || 0}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Risposte</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {stats?.responseRate || 0}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tasso</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
                <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {eligibleData?.eligible?.length || 0}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Prossimi</div>
              </div>
            </div>

            {/* Ultimi invii */}
            {logs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Ultimi Check-in
                </h4>
                <div className="space-y-2">
                  {logs.slice(0, 3).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                    >
                      {getStatusIcon(log.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {log.clientName || log.phoneNumber}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {log.status === "sent" ? "Inviato" : log.status === "replied" ? "Risposto" : log.status}
                      </Badge>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(log.sentAt || log.scheduledFor)}
                      </span>
                    </div>
                  ))}
                </div>
                {logs.length > 3 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-xs text-blue-600"
                    onClick={() => setActiveTab("history")}
                  >
                    Vedi tutta la cronologia
                  </Button>
                )}
              </div>
            )}

            {/* Prossimi Invii Programmati */}
            {pendingLogs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Prossimi Invii Programmati
                </h4>
                <div className="space-y-2">
                  {pendingLogs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700"
                    >
                      <Clock className="h-4 w-4 text-amber-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {log.clientName || log.phoneNumber}
                        </p>
                        <p className="text-xs text-gray-500">{log.templateName}</p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                        In coda
                      </Badge>
                      <span className="text-xs text-amber-600 font-medium whitespace-nowrap">
                        {formatDate(log.scheduledFor)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Test */}
            <div className="pt-2">
              <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full gap-2">
                    <PlayCircle className="h-4 w-4" />
                    Invia Check-in di Test
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invia Check-in di Test</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-gray-500">
                      Invia un messaggio di test a un cliente per verificare che tutto funzioni correttamente.
                    </p>
                    <div className="space-y-2">
                      <Label>Seleziona Cliente</Label>
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Scegli un cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clients
                            .filter((c: any) => c.phoneNumber)
                            .map((client: any) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.firstName} {client.lastName} - {client.phoneNumber}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => testMutation.mutate(selectedClientId)}
                      disabled={!selectedClientId || testMutation.isPending}
                      className="w-full"
                    >
                      {testMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Invia Test
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>

          <TabsContent value="clients" className="space-y-4 mt-0">
            {eligibleLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Clienti Eligibili */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-green-500" />
                      Clienti che Riceveranno il Check-in
                    </h4>
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {eligibleData?.eligible?.length || 0} clienti
                    </Badge>
                  </div>
                  <ScrollArea className="h-[300px] rounded-lg border border-green-200 dark:border-green-800 p-2 bg-green-50/30 dark:bg-green-950/20">
                    {(eligibleData?.eligible || []).length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-sm">
                        <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p>Nessun cliente selezionato</p>
                        <p className="text-xs mt-1">Clicca + sui clienti qui sotto per aggiungerli</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {(eligibleData?.eligible || []).map((client) => (
                          <div
                            key={client.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-800 border border-green-100 dark:border-green-900 hover:border-green-300 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => toggleClientMutation.mutate({ clientId: client.id, enabled: false })}
                                disabled={toggleClientMutation.isPending}
                              >
                                <XCircle className="h-5 w-5" />
                              </Button>
                              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center text-green-600 font-medium text-sm">
                                {client.firstName?.[0] || "?"}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {client.firstName} {client.lastName}
                                </p>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {client.phoneNumber || "Nessun telefono"}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-2">
                              {client.blockingReason && (
                                <Badge variant="outline" className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  {client.blockingReason}
                                </Badge>
                              )}
                              {client.daysSinceLastContact !== null ? (
                                <p className="text-xs text-gray-500">
                                  {client.daysSinceLastContact}g fa
                                </p>
                              ) : (
                                <p className="text-xs text-gray-400">Mai</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                {/* Clienti Esclusi */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <UserX className="h-4 w-4 text-gray-400" />
                      Tutti i Clienti
                    </h4>
                    <Badge variant="outline" className="text-gray-500">
                      {eligibleData?.excluded?.length || 0} disponibili
                    </Badge>
                  </div>
                  <ScrollArea className="h-[400px] rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                    {(eligibleData?.excluded || []).length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-sm">
                        Tutti i clienti sono stati selezionati
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {(eligibleData?.excluded || []).map((client) => {
                          const canAdd = !!client.phoneNumber;
                          return (
                            <div
                              key={client.id}
                              className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                                canAdd 
                                  ? "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 border border-gray-100 dark:border-gray-700" 
                                  : "bg-gray-100 dark:bg-gray-800/50 opacity-60"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-green-500 hover:text-green-700 hover:bg-green-50 disabled:opacity-30"
                                  onClick={() => toggleClientMutation.mutate({ clientId: client.id, enabled: true })}
                                  disabled={!canAdd || toggleClientMutation.isPending}
                                  title={!canAdd ? client.exclusionReason : "Aggiungi al check-in"}
                                >
                                  <CheckCircle2 className="h-5 w-5" />
                                </Button>
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 font-medium text-sm">
                                  {client.firstName?.[0] || "?"}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                    {client.firstName} {client.lastName}
                                  </p>
                                  {client.phoneNumber ? (
                                    <p className="text-xs text-gray-400 flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {client.phoneNumber}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-red-400 flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      Nessun telefono
                                    </p>
                                  )}
                                </div>
                              </div>
                              {client.exclusionReason && client.exclusionReason !== "Non selezionato" && (
                                <Badge variant="outline" className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  {client.exclusionReason}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-0">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Cronologia Invii
                </h4>
                {logsData?.pagination && (
                  <span className="text-xs text-gray-400">
                    {logsData.pagination.total} totali
                  </span>
                )}
              </div>

              <ScrollArea className="h-[350px] rounded-lg border border-gray-200 dark:border-gray-700 p-2">
                {logs.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nessun check-in inviato</p>
                    <p className="text-xs mt-1">I messaggi appariranno qui dopo l'invio</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                      >
                        {getStatusIcon(log.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {log.clientName || log.phoneNumber}
                            </p>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                log.status === "sent" ? "text-blue-600 bg-blue-50 border-blue-200" :
                                log.status === "replied" ? "text-green-600 bg-green-50 border-green-200" :
                                log.status === "failed" ? "text-red-600 bg-red-50 border-red-200" :
                                "text-gray-600"
                              }`}
                            >
                              {log.status === "sent" ? "Inviato" : 
                               log.status === "replied" ? "Risposto" : 
                               log.status === "failed" ? "Fallito" :
                               log.status === "scheduled" ? "Programmato" : log.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {log.personalizedMessage || log.templateName}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(log.sentAt || log.scheduledFor)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {logsData?.pagination && logsData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                    disabled={logsPage === 1}
                  >
                    Precedente
                  </Button>
                  <span className="text-xs text-gray-500">
                    Pagina {logsPage} di {logsData.pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogsPage(p => Math.min(logsData.pagination.totalPages, p + 1))}
                    disabled={logsPage === logsData.pagination.totalPages}
                  >
                    Successiva
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4 mt-0">

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Template WhatsApp Approvati
            </h4>
            {(config?.templateIds || []).length > 0 && (
              <Badge className="bg-purple-500 text-white text-xs px-3 py-1">
                {(config?.templateIds || []).length} selezionati
              </Badge>
            )}
          </div>

          {templatesLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Nessun template WhatsApp approvato trovato</p>
              <p className="text-xs text-gray-400 mt-1">
                Configura i template nella sezione WhatsApp Templates
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {Object.entries(templatesByCategory).map(([categoryName, categoryTemplates]) => {
                const isOpen = openCategories.has(categoryName);
                const colors = CATEGORY_COLORS[categoryName] || CATEGORY_COLORS["Generale"];
                const selectedInCategory = categoryTemplates.filter(t => 
                  config?.templateIds?.includes(t.id)
                ).length;
                
                return (
                  <Collapsible
                    key={categoryName}
                    open={isOpen}
                    onOpenChange={(open) => {
                      setOpenCategories(prev => {
                        const newSet = new Set(prev);
                        if (open) {
                          newSet.add(categoryName);
                        } else {
                          newSet.delete(categoryName);
                        }
                        return newSet;
                      });
                    }}
                  >
                    <CollapsibleTrigger asChild>
                      <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${colors.bg} ${colors.border} border hover:opacity-90`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${colors.icon}`}></div>
                          <span className={`font-semibold ${colors.text}`}>{categoryName}</span>
                          <Badge variant="outline" className={`text-xs ${colors.bg} ${colors.text} ${colors.border}`}>
                            {categoryTemplates.length} template
                          </Badge>
                          {selectedInCategory > 0 && (
                            <Badge className="bg-purple-500 text-white text-xs">
                              {selectedInCategory} selezionati
                            </Badge>
                          )}
                        </div>
                        <ChevronDown className={`h-4 w-4 ${colors.text} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="space-y-2 pl-2">
                        {categoryTemplates.map((template) => {
                          const isSelected = config?.templateIds?.includes(template.id) || false;
                          return (
                            <label
                              key={template.id}
                              className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                                isSelected
                                  ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 shadow-md"
                                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-200 hover:bg-gray-50"
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleTemplateToggle(template.id, checked as boolean)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-gray-900 dark:text-white">
                                    {template.friendlyName}
                                  </span>
                                  <Badge className="text-xs bg-green-100 text-green-700 border-green-300">
                                    Approvato
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                                  {template.bodyText || "Template senza corpo visibile"}
                                </p>
                                <p className="text-xs text-gray-400 font-mono mt-2">
                                  {template.id}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-5">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Configurazione Check-in
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Personalizza quando e come vengono inviati i messaggi automatici ai tuoi clienti
            </p>
          </div>

          <div className="space-y-4">
            {/* Selezione Agente WhatsApp */}
            <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
                  <Phone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1">
                  <h5 className="font-medium text-gray-900 dark:text-white text-sm">Agente WhatsApp</h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Seleziona da quale numero WhatsApp vuoi inviare i check-in
                  </p>
                </div>
              </div>
              <div className="ml-11">
                <Select
                  value={config?.agentConfigId || "none"}
                  onValueChange={(value) => updateConfigMutation.mutate({ agentConfigId: value === "none" ? null : value })}
                >
                  <SelectTrigger className="w-full bg-white dark:bg-gray-800">
                    <SelectValue placeholder="Seleziona un agente WhatsApp..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessun agente</SelectItem>
                    {whatsappAgents.map((agent: any) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.agentName || agent.businessName || "Agente senza nome"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!config?.agentConfigId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Devi selezionare un agente per poter inviare i check-in
                  </p>
                )}
              </div>
            </div>

            {/* Orario Invio */}
            <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h5 className="font-medium text-gray-900 dark:text-white text-sm">Fascia Oraria</h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    I messaggi vengono inviati in modo casuale all'interno di questa fascia, così sembrano più naturali e non automatici
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-11">
                <Input
                  type="time"
                  value={config?.preferredTimeStart || "09:00"}
                  onChange={(e) => updateConfigMutation.mutate({ preferredTimeStart: e.target.value })}
                  className="w-28 bg-white dark:bg-gray-800"
                />
                <span className="text-gray-400 text-sm">fino alle</span>
                <Input
                  type="time"
                  value={config?.preferredTimeEnd || "18:00"}
                  onChange={(e) => updateConfigMutation.mutate({ preferredTimeEnd: e.target.value })}
                  className="w-28 bg-white dark:bg-gray-800"
                />
              </div>
            </div>

            {/* Giorni Attivi */}
            <div className="p-4 rounded-xl border border-green-100 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                  <CalendarCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h5 className="font-medium text-gray-900 dark:text-white text-sm">Giorni di Invio</h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Seleziona i giorni in cui vuoi che vengano inviati i check-in. Evita i weekend se i tuoi clienti preferiscono non essere contattati
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 ml-11">
                {DAYS.map((day) => {
                  const isActive = !config?.excludedDays?.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      onClick={() => handleDayToggle(day.value, !isActive)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        isActive
                          ? "bg-green-500 text-white shadow-sm"
                          : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Personalizzazione AI */}
            <div className="p-4 rounded-xl border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                    <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900 dark:text-white text-sm">Personalizzazione AI</h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      L'AI adatta il messaggio in base al nome del cliente e al suo percorso, rendendo ogni check-in unico e personale
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config?.useAiPersonalization || false}
                  onCheckedChange={(checked) => updateConfigMutation.mutate({ useAiPersonalization: checked })}
                />
              </div>
            </div>

            {/* Esclusione Contatti Recenti */}
            <div className="p-4 rounded-xl border border-orange-100 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50">
                  <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1">
                  <h5 className="font-medium text-gray-900 dark:text-white text-sm">Evita Spam</h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Non inviare check-in ai clienti che hai già contattato di recente. Così eviti di sembrare insistente
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Escludi se contattati negli ultimi</span>
                    <Input
                      type="number"
                      value={config?.minDaysSinceLastContact || 5}
                      onChange={(e) => updateConfigMutation.mutate({ minDaysSinceLastContact: parseInt(e.target.value) || 5 })}
                      className="w-16 text-center bg-white dark:bg-gray-800"
                      min={1}
                      max={30}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-300">giorni</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pulsante Test */}
            <div className="p-4 rounded-xl border border-cyan-100 dark:border-cyan-900/50 bg-cyan-50/50 dark:bg-cyan-950/20 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/50">
                  <Send className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="flex-1">
                  <h5 className="font-medium text-gray-900 dark:text-white text-sm">Invia Test</h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Invia un messaggio di prova per verificare che tutto funzioni correttamente
                  </p>
                  <Button
                    onClick={() => setTestDialogOpen(true)}
                    disabled={!config?.agentConfigId || (config?.templateIds?.length || 0) === 0}
                    className="mt-3 bg-cyan-500 hover:bg-cyan-600 text-white"
                    size="sm"
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Invia Test Check-in
                  </Button>
                  {(!config?.agentConfigId || (config?.templateIds?.length || 0) === 0) && (
                    <p className="text-xs text-gray-400 mt-2">
                      Seleziona un agente e almeno un template per inviare un test
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Dialog per Test */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-cyan-500" />
              Invia Check-in di Test
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Seleziona un cliente a cui inviare un messaggio di test. Il messaggio verrà inviato immediatamente usando il template selezionato.
            </p>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select
                value={selectedClientId}
                onValueChange={setSelectedClientId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {eligibleData?.eligible?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-3 w-3 text-green-500" />
                        <span>{client.firstName} {client.lastName}</span>
                        <span className="text-gray-400 text-xs">({client.phoneNumber})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
                Annulla
              </Button>
              <Button
                onClick={() => {
                  if (selectedClientId) {
                    testSendMutation.mutate(selectedClientId);
                  }
                }}
                disabled={!selectedClientId || testSendMutation.isPending}
                className="bg-cyan-500 hover:bg-cyan-600"
              >
                {testSendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Invia Test
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default WeeklyCheckinCard;
