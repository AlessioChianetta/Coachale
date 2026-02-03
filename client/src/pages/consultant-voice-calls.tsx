import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  PhoneIncoming,
  PhoneOff,
  PhoneMissed,
  PhoneForwarded,
  PhoneOutgoing,
  Clock,
  Calendar,
  User,
  Search,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Building2,
  Target,
  Users,
  Wrench,
  Trophy,
  Briefcase,
  Sparkles,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Settings,
  Key,
  Copy,
  Check,
  Mic2,
  MessageSquare,
  Bot,
  FileText,
  RotateCcw,
  Save,
  Trash2,
  Play,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDistanceToNow, format } from "date-fns";
import { it } from "date-fns/locale";

interface VoiceCall {
  id: string;
  caller_id: string;
  called_number: string;
  client_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  freeswitch_uuid: string;
  status: string;
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  talk_time_seconds: number | null;
  ai_mode: string | null;
  outcome: string | null;
  telephony_minutes: number | null;
  ai_cost_estimate: number | null;
}

interface VoiceStats {
  total_calls: string;
  completed_calls: string;
  failed_calls: string;
  transferred_calls: string;
  avg_duration_seconds: string;
  total_minutes: string;
  total_cost_estimate: string;
  total_tokens_used: string;
}

interface HealthStatus {
  overall: string;
  components: {
    database: { status: string };
    esl: { status: string };
    freeswitch: { status: string };
    gemini: { status: string };
  };
}

interface TokenStatus {
  hasToken: boolean;
  tokenCount: number;
  lastGeneratedAt: string | null;
  revokedCount: number;
  message: string;
}

interface ScheduledVoiceCall {
  id: string;
  consultant_id: string;
  target_phone: string;
  scheduled_at: string | null;
  status: string;
  ai_mode: string;
  custom_prompt: string | null;
  voice_call_id: string | null;
  attempts: number;
  max_attempts: number;
  last_attempt_at: string | null;
  error_message: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
}

interface NonClientSettings {
  voiceDirectives: string;
  nonClientPromptSource: 'agent' | 'manual' | 'default';
  nonClientAgentId: string | null;
  nonClientManualPrompt: string;
  defaultVoiceDirectives: string;
  defaultNonClientPrompt: string;
  availableAgents: Array<{
    id: string;
    name: string;
    persona: string | null;
    prompt: string | null;
    status: string;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  ringing: { label: "In Arrivo", icon: PhoneIncoming, color: "bg-yellow-500" },
  answered: { label: "Connessa", icon: Phone, color: "bg-blue-500" },
  talking: { label: "In Corso", icon: Phone, color: "bg-green-500" },
  completed: { label: "Completata", icon: CheckCircle, color: "bg-green-600" },
  failed: { label: "Fallita", icon: PhoneMissed, color: "bg-red-500" },
  transferred: { label: "Trasferita", icon: PhoneForwarded, color: "bg-purple-500" },
  ended: { label: "Terminata", icon: PhoneOff, color: "bg-gray-500" },
};

const OUTBOUND_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "In Attesa", color: "bg-yellow-500" },
  calling: { label: "Chiamando...", color: "bg-blue-500" },
  ringing: { label: "Sta Squillando", color: "bg-blue-400" },
  talking: { label: "In Corso", color: "bg-green-500" },
  completed: { label: "Completata", color: "bg-green-600" },
  failed: { label: "Fallita", color: "bg-red-500" },
  cancelled: { label: "Cancellata", color: "bg-gray-500" },
};

const VOICES = [
  { value: 'Achernar', label: 'Achernar', description: '🇮🇹 Femminile Professionale' },
  { value: 'Puck', label: 'Puck', description: '🇬🇧 Maschile Giovane' },
  { value: 'Charon', label: 'Charon', description: '🇬🇧 Maschile Maturo' },
  { value: 'Kore', label: 'Kore', description: '🇬🇧 Femminile Giovane' },
  { value: 'Fenrir', label: 'Fenrir', description: '🇬🇧 Maschile Profondo' },
  { value: 'Aoede', label: 'Aoede', description: '🇬🇧 Femminile Melodiosa' },
];

interface PromptSection {
  icon: React.ReactNode;
  title: string;
  content: string;
  color: string;
}

function AgentPromptPreview({ prompt, agentName }: { prompt: string; agentName: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['instructions']));

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const parsePrompt = (text: string): { instructions: string; sections: PromptSection[] } => {
    const sectionPatterns = [
      { pattern: /━+\n🏢 BUSINESS & IDENTITÀ\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Building2 className="h-4 w-4" />, title: "Business & Identità", color: "text-blue-500" },
      { pattern: /━+\n🎯 POSIZIONAMENTO\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Target className="h-4 w-4" />, title: "Posizionamento", color: "text-purple-500" },
      { pattern: /━+\n👥 TARGET\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Users className="h-4 w-4" />, title: "Target", color: "text-green-500" },
      { pattern: /━+\n🔧 METODO\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Wrench className="h-4 w-4" />, title: "Metodo", color: "text-orange-500" },
      { pattern: /━+\n🏆 CREDENZIALI\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Trophy className="h-4 w-4" />, title: "Credenziali", color: "text-yellow-500" },
      { pattern: /━+\n💼 SERVIZI\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Briefcase className="h-4 w-4" />, title: "Servizi", color: "text-cyan-500" },
      { pattern: /━+\n🤖 PERSONALITÀ AI\n━+\n([\s\S]*?)(?=\n━|$)/i, icon: <Sparkles className="h-4 w-4" />, title: "Personalità AI", color: "text-pink-500" },
    ];

    const sections: PromptSection[] = [];
    let instructions = text;

    for (const { pattern, icon, title, color } of sectionPatterns) {
      const match = text.match(pattern);
      if (match && match[1]?.trim()) {
        sections.push({ icon, title, content: match[1].trim(), color });
        instructions = instructions.replace(match[0], '');
      }
    }

    instructions = instructions.replace(/━+/g, '').trim();

    return { instructions, sections };
  };

  const { instructions, sections } = parsePrompt(prompt);
  const hasInstructions = instructions.length > 0;
  const hasSections = sections.length > 0;

  return (
    <div className="mt-3 rounded-lg border bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Anteprima: {agentName}</span>
          {hasSections && (
            <Badge variant="secondary" className="text-xs">
              {sections.length} sezioni Brand Voice
            </Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {isExpanded && (
        <div className="border-t p-3 space-y-3 max-h-[400px] overflow-auto">
          {hasInstructions && (
            <div className="space-y-2">
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => toggleSection('instructions')}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-medium">Istruzioni Agente</span>
                </div>
                {expandedSections.has('instructions') ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                )}
              </div>
              {expandedSections.has('instructions') && (
                <div className="ml-6 p-3 bg-white dark:bg-slate-950 rounded-md border text-xs leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-auto">
                  {instructions}
                </div>
              )}
            </div>
          )}

          {sections.map((section, idx) => (
            <div key={idx} className="space-y-2">
              <div 
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => toggleSection(section.title)}
              >
                <div className="flex items-center gap-2">
                  <span className={section.color}>{section.icon}</span>
                  <span className="text-sm font-medium">{section.title}</span>
                </div>
                {expandedSections.has(section.title) ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                )}
              </div>
              {expandedSections.has(section.title) && (
                <div className="ml-6 p-3 bg-white dark:bg-slate-950 rounded-md border text-xs leading-relaxed whitespace-pre-wrap">
                  {section.content}
                </div>
              )}
            </div>
          ))}

          {!hasInstructions && !hasSections && (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              Nessun contenuto configurato per questo agente
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ConsultantVoiceCallsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<string>("day");
  const [serviceToken, setServiceToken] = useState<string | null>(null);
  const [wsAuthToken, setWsAuthToken] = useState<string>(() => crypto.randomUUID().replace(/-/g, ''));
  const [tokenCopied, setTokenCopied] = useState(false);
  const [vpsBridgeUrl, setVpsBridgeUrl] = useState<string>("");
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);

  const [voiceDirectives, setVoiceDirectives] = useState("");
  const [promptSource, setPromptSource] = useState<'agent' | 'manual' | 'default'>('default');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [manualPrompt, setManualPrompt] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const [outboundPhone, setOutboundPhone] = useState("");
  const [outboundAiMode, setOutboundAiMode] = useState("assistenza");
  const [outboundScheduledDate, setOutboundScheduledDate] = useState("");
  const [outboundScheduledTime, setOutboundScheduledTime] = useState("");
  const [isScheduleMode, setIsScheduleMode] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Voice settings query
  const { data: voiceSettings, refetch: refetchVoice } = useQuery({
    queryKey: ["/api/voice/settings"],
    queryFn: async () => {
      const res = await fetch("/api/voice/settings", { headers: getAuthHeaders() });
      if (!res.ok) return { voiceId: 'achernar', vpsBridgeUrl: '' };
      return res.json();
    },
  });

  // Load vpsBridgeUrl when settings load
  useEffect(() => {
    if (voiceSettings?.vpsBridgeUrl) {
      setVpsBridgeUrl(voiceSettings.vpsBridgeUrl);
    }
  }, [voiceSettings?.vpsBridgeUrl]);

  const updateVoiceMutation = useMutation({
    mutationFn: async (voiceId: string) => {
      const res = await fetch("/api/voice/settings", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nell'aggiornamento della voce");
      }
      return res.json();
    },
    onSuccess: (data) => {
      refetchVoice();
      const voice = VOICES.find(v => v.value === data.voiceId);
      toast({ 
        title: `🎤 Voce aggiornata`, 
        description: `${voice?.label} - ${voice?.description}` 
      });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const generateTokenMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/voice/service-token", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nella generazione del token");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setServiceToken(data.token);
      refetchTokenStatus();
      toast({ 
        title: "Token generato", 
        description: data.tokenNumber > 1 
          ? `Token #${data.tokenNumber} generato (${data.tokenNumber - 1} precedenti revocati)` 
          : "Il token di servizio è pronto per essere copiato" 
      });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const copyToken = async () => {
    if (serviceToken) {
      await navigator.clipboard.writeText(serviceToken);
      setTokenCopied(true);
      toast({ title: "Copiato!", description: "Token copiato negli appunti" });
      setTimeout(() => setTokenCopied(false), 2000);
    }
  };

  const saveVpsUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch("/api/voice/vps-url", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ vpsBridgeUrl: url }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio dell'URL VPS");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchVoice();
      toast({ title: "Salvato", description: "URL del VPS aggiornato" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const saveTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch("/api/voice/service-token", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio del token");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchTokenStatus();
      toast({ title: "Token salvato", description: "Il token è stato sincronizzato con il database" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const { data: callsData, isLoading: loadingCalls, refetch: refetchCalls } = useQuery({
    queryKey: ["/api/voice/calls", page, statusFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/voice/calls?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento chiamate");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ["/api/voice/stats", period],
    queryFn: async () => {
      const res = await fetch(`/api/voice/stats?period=${period}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento statistiche");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: healthData } = useQuery({
    queryKey: ["/api/voice/health"],
    queryFn: async () => {
      const res = await fetch("/api/voice/health", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento stato");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: tokenStatusData, refetch: refetchTokenStatus } = useQuery<TokenStatus>({
    queryKey: ["/api/voice/service-token/status"],
    queryFn: async () => {
      const res = await fetch("/api/voice/service-token/status", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento stato token");
      return res.json();
    },
  });

  const { data: nonClientSettingsData, isLoading: loadingNonClientSettings } = useQuery<NonClientSettings>({
    queryKey: ["/api/voice/non-client-settings"],
    queryFn: async () => {
      const res = await fetch("/api/voice/non-client-settings", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento impostazioni");
      return res.json();
    },
  });

  const { data: scheduledCallsData, isLoading: loadingScheduledCalls, refetch: refetchScheduledCalls } = useQuery<{ calls: ScheduledVoiceCall[]; count: number; activeTimers: number }>({
    queryKey: ["/api/voice/outbound/scheduled"],
    queryFn: async () => {
      const res = await fetch("/api/voice/outbound/scheduled", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento chiamate programmate");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const triggerOutboundMutation = useMutation({
    mutationFn: async ({ targetPhone, aiMode }: { targetPhone: string; aiMode: string }) => {
      const res = await fetch("/api/voice/outbound/trigger", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhone, aiMode }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nell'avvio della chiamata");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setOutboundPhone("");
      refetchScheduledCalls();
      toast({ title: "Chiamata avviata!", description: `Chiamando ${data.targetPhone}...` });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const scheduleOutboundMutation = useMutation({
    mutationFn: async ({ targetPhone, scheduledAt, aiMode }: { targetPhone: string; scheduledAt: string; aiMode: string }) => {
      const res = await fetch("/api/voice/outbound/schedule", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhone, scheduledAt, aiMode }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nella programmazione");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setOutboundPhone("");
      setOutboundScheduledDate("");
      setOutboundScheduledTime("");
      setIsScheduleMode(false);
      refetchScheduledCalls();
      toast({ 
        title: "Chiamata programmata!", 
        description: `Chiamerà ${data.targetPhone} il ${new Date(data.scheduledAt).toLocaleString('it-IT')}` 
      });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const cancelOutboundMutation = useMutation({
    mutationFn: async (callId: string) => {
      const res = await fetch(`/api/voice/outbound/${callId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nella cancellazione");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchScheduledCalls();
      toast({ title: "Chiamata cancellata" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const handleTriggerCall = () => {
    if (!outboundPhone.trim()) {
      toast({ title: "Errore", description: "Inserisci un numero di telefono", variant: "destructive" });
      return;
    }
    triggerOutboundMutation.mutate({ targetPhone: outboundPhone.trim(), aiMode: outboundAiMode });
  };

  const handleScheduleCall = () => {
    if (!outboundPhone.trim() || !outboundScheduledDate || !outboundScheduledTime) {
      toast({ title: "Errore", description: "Inserisci numero, data e ora", variant: "destructive" });
      return;
    }
    const scheduledAt = new Date(`${outboundScheduledDate}T${outboundScheduledTime}`).toISOString();
    scheduleOutboundMutation.mutate({ targetPhone: outboundPhone.trim(), scheduledAt, aiMode: outboundAiMode });
  };

  useEffect(() => {
    if (nonClientSettingsData) {
      setVoiceDirectives(nonClientSettingsData.voiceDirectives);
      setPromptSource(nonClientSettingsData.nonClientPromptSource);
      setSelectedAgentId(nonClientSettingsData.nonClientAgentId);
      setManualPrompt(nonClientSettingsData.nonClientManualPrompt);
      setHasChanges(false);
    }
  }, [nonClientSettingsData]);

  const saveNonClientSettingsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/voice/non-client-settings", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceDirectives,
          nonClientPromptSource: promptSource,
          nonClientAgentId: selectedAgentId,
          nonClientManualPrompt: manualPrompt,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio");
      }
      return res.json();
    },
    onSuccess: () => {
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/voice/non-client-settings"] });
      toast({ title: "Salvato!", description: "Le impostazioni sono state salvate correttamente" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const handleResetDirectives = () => {
    if (nonClientSettingsData) {
      setVoiceDirectives(nonClientSettingsData.defaultVoiceDirectives);
      setHasChanges(true);
    }
  };

  const selectedAgent = nonClientSettingsData?.availableAgents.find(a => a.id === selectedAgentId);

  const calls: VoiceCall[] = callsData?.calls || [];
  const pagination = callsData?.pagination || { page: 1, totalPages: 1, total: 0 };
  const stats: VoiceStats | undefined = statsData?.stats;
  const activeCalls: number = statsData?.activeCalls || 0;
  const health: HealthStatus | undefined = healthData;
  const tokenStatus: TokenStatus | undefined = tokenStatusData;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const filteredCalls = search
    ? calls.filter(
        (c) =>
          c.caller_id.includes(search) ||
          c.client_name?.toLowerCase().includes(search.toLowerCase())
      )
    : calls;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} role="consultant" />
      <div className={`flex-1 flex flex-col ${isMobile ? "w-full" : "ml-0"}`}>
        <Navbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 p-6 lg:px-8 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <Phone className="h-8 w-8" />
                  Chiamate Voice
                </h1>
                <p className="text-muted-foreground mt-1">
                  Monitora e gestisci le chiamate in tempo reale
                </p>
              </div>
              <div className="flex gap-2">
                {/* Voice Selector */}
                <Dialog open={voiceDialogOpen} onOpenChange={setVoiceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Mic2 className="h-4 w-4 mr-2" />
                      Voce: {VOICES.find(v => v.value === voiceSettings?.voiceId)?.label || 'Achernar'}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Voce AI Telefonica</DialogTitle>
                      <DialogDescription>
                        Scegli la voce che Alessia userà durante le chiamate telefoniche.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-4">
                      {VOICES.map((voice) => (
                        <Button
                          key={voice.value}
                          variant={voiceSettings?.voiceId === voice.value ? "default" : "outline"}
                          className="justify-start h-auto py-3"
                          onClick={() => {
                            updateVoiceMutation.mutate(voice.value);
                            setVoiceDialogOpen(false);
                          }}
                          disabled={updateVoiceMutation.isPending}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-semibold">{voice.label}</span>
                            <span className="text-xs text-muted-foreground">{voice.description}</span>
                          </div>
                          {voiceSettings?.voiceId === voice.value && (
                            <Check className="h-4 w-4 ml-auto" />
                          )}
                        </Button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Key className="h-4 w-4 mr-2" />
                      Token VPS
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Token di Servizio VPS</DialogTitle>
                      <DialogDescription>
                        Genera un token per connettere il VPS Voice Bridge a questa piattaforma.
                        Il token non scade e rimane valido finché non ne generi uno nuovo.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {!serviceToken ? (
                        <Button
                          onClick={() => generateTokenMutation.mutate()}
                          disabled={generateTokenMutation.isPending}
                          className="w-full"
                        >
                          {generateTokenMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Generazione...
                            </>
                          ) : (
                            <>
                              <Key className="h-4 w-4 mr-2" />
                              Genera Token
                            </>
                          )}
                        </Button>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Token generato:</label>
                            <div className="flex gap-2">
                              <Input
                                value={serviceToken}
                                readOnly
                                className="font-mono text-xs"
                              />
                              <Button onClick={copyToken} variant="outline" size="icon">
                                {tokenCopied ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                          <div className="bg-muted p-3 rounded-md text-sm space-y-2">
                            <p className="font-medium">Configurazione VPS:</p>
                            <p className="text-muted-foreground">
                              Aggiungi questo token al file <code className="bg-background px-1 rounded">.env</code> del VPS:
                            </p>
                            <code className="block bg-background p-2 rounded text-xs break-all">
                              REPLIT_API_TOKEN={serviceToken.substring(0, 20)}...
                            </code>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setServiceToken(null);
                              generateTokenMutation.mutate();
                            }}
                            disabled={generateTokenMutation.isPending}
                            className="w-full"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Rigenera Token
                          </Button>
                        </>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                <Link href="/consultant/voice-settings">
                  <Button variant="outline">
                    <Settings className="h-4 w-4 mr-2" />
                    Impostazioni
                  </Button>
                </Link>
                <Button onClick={() => refetchCalls()} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Aggiorna
                </Button>
              </div>
            </div>

            <Tabs defaultValue="calls" className="space-y-6">
              <TabsList>
                <TabsTrigger value="calls" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Chiamate
                </TabsTrigger>
                <TabsTrigger value="outbound" className="flex items-center gap-2">
                  <PhoneOutgoing className="h-4 w-4" />
                  Chiamate in Uscita
                </TabsTrigger>
                <TabsTrigger value="non-client" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Prompt Non-Clienti
                </TabsTrigger>
                <TabsTrigger value="vps" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configurazione VPS
                </TabsTrigger>
              </TabsList>

              <TabsContent value="calls" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Chiamate Attive</p>
                      <p className="text-3xl font-bold">{activeCalls}</p>
                    </div>
                    <div className={`p-3 rounded-full ${activeCalls > 0 ? "bg-green-100" : "bg-gray-100"}`}>
                      <Phone className={`h-6 w-6 ${activeCalls > 0 ? "text-green-600" : "text-gray-400"}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Totale Oggi</p>
                      <p className="text-3xl font-bold">{stats?.total_calls || 0}</p>
                    </div>
                    <div className="p-3 rounded-full bg-blue-100">
                      <BarChart3 className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Durata Media</p>
                      <p className="text-3xl font-bold">
                        {formatDuration(Math.round(parseFloat(stats?.avg_duration_seconds || "0")))}
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-purple-100">
                      <Clock className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Stato Sistema</p>
                      <p className="text-lg font-medium mt-1">
                        {health?.overall === "healthy" ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-5 w-5" /> Online
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <AlertCircle className="h-5 w-5" /> {health?.overall || "..."}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className={`p-3 rounded-full ${health?.overall === "healthy" ? "bg-green-100" : "bg-yellow-100"}`}>
                      <Settings className={`h-6 w-6 ${health?.overall === "healthy" ? "text-green-600" : "text-yellow-600"}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle>Storico Chiamate</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Cerca numero o cliente..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 w-[200px]"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Stato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti</SelectItem>
                        {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                          <SelectItem key={value} value={value}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingCalls ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : filteredCalls.length === 0 ? (
                  <div className="text-center py-12">
                    <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">Nessuna chiamata trovata</h3>
                    <p className="text-muted-foreground">
                      Le chiamate appariranno qui quando arriveranno
                    </p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Chiamante</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Stato</TableHead>
                          <TableHead>Durata</TableHead>
                          <TableHead>Esito</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCalls.map((call) => {
                          const statusConfig = STATUS_CONFIG[call.status] || STATUS_CONFIG.ended;
                          const StatusIcon = statusConfig.icon;
                          return (
                            <TableRow key={call.id}>
                              <TableCell>
                                <div className="text-sm">
                                  {format(new Date(call.started_at), "dd/MM HH:mm", { locale: it })}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(call.started_at), {
                                    addSuffix: true,
                                    locale: it,
                                  })}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono">{call.caller_id}</TableCell>
                              <TableCell>
                                {call.client_name ? (
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    {call.client_name}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge className={statusConfig.color}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusConfig.label}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatDuration(call.duration_seconds)}</TableCell>
                              <TableCell>
                                {call.outcome ? (
                                  <Badge variant="outline">{call.outcome}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Link href={`/consultant/voice-calls/${call.id}`}>
                                  <Button variant="ghost" size="sm">
                                    Dettagli
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        {pagination.total} chiamate totali
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => p - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="flex items-center px-2 text-sm">
                          {page} / {pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= pagination.totalPages}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
              </TabsContent>

              <TabsContent value="outbound" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PhoneOutgoing className="h-5 w-5" />
                        {isScheduleMode ? "Programma Chiamata" : "Chiamata Immediata"}
                      </CardTitle>
                      <CardDescription>
                        {isScheduleMode 
                          ? "Programma una chiamata per un orario specifico"
                          : "Avvia subito una chiamata in uscita verso un numero"
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Button
                          variant={!isScheduleMode ? "default" : "outline"}
                          size="sm"
                          onClick={() => setIsScheduleMode(false)}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Chiama Ora
                        </Button>
                        <Button
                          variant={isScheduleMode ? "default" : "outline"}
                          size="sm"
                          onClick={() => setIsScheduleMode(true)}
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Programma
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="outbound-phone">Numero di Telefono</Label>
                          <Input
                            id="outbound-phone"
                            type="tel"
                            placeholder="+393331234567"
                            value={outboundPhone}
                            onChange={(e) => setOutboundPhone(e.target.value)}
                            className="mt-1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Formato: +39 seguito dal numero (es. +393331234567)
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="outbound-mode">Modalità AI</Label>
                          <Select value={outboundAiMode} onValueChange={setOutboundAiMode}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Seleziona modalità" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="assistenza">Assistenza</SelectItem>
                              <SelectItem value="vendita">Vendita</SelectItem>
                              <SelectItem value="followup">Follow-up</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {isScheduleMode && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="outbound-date">Data</Label>
                              <Input
                                id="outbound-date"
                                type="date"
                                value={outboundScheduledDate}
                                onChange={(e) => setOutboundScheduledDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="outbound-time">Ora</Label>
                              <Input
                                id="outbound-time"
                                type="time"
                                value={outboundScheduledTime}
                                onChange={(e) => setOutboundScheduledTime(e.target.value)}
                                className="mt-1"
                              />
                            </div>
                          </div>
                        )}

                        <Button
                          className="w-full"
                          onClick={isScheduleMode ? handleScheduleCall : handleTriggerCall}
                          disabled={triggerOutboundMutation.isPending || scheduleOutboundMutation.isPending || !outboundPhone.trim()}
                        >
                          {(triggerOutboundMutation.isPending || scheduleOutboundMutation.isPending) ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : isScheduleMode ? (
                            <Calendar className="h-4 w-4 mr-2" />
                          ) : (
                            <PhoneOutgoing className="h-4 w-4 mr-2" />
                          )}
                          {isScheduleMode ? "Programma Chiamata" : "Chiama Adesso"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Chiamate Programmate
                          </CardTitle>
                          <CardDescription>
                            {scheduledCallsData?.count || 0} chiamate in coda
                            {scheduledCallsData?.activeTimers ? ` (${scheduledCallsData.activeTimers} timer attivi)` : ''}
                          </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => refetchScheduledCalls()}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {loadingScheduledCalls ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : !scheduledCallsData?.calls?.length ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <PhoneOutgoing className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p>Nessuna chiamata programmata</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[400px] overflow-auto">
                          {scheduledCallsData.calls.map((call) => {
                            const statusConfig = OUTBOUND_STATUS_CONFIG[call.status] || OUTBOUND_STATUS_CONFIG.pending;
                            return (
                              <div key={call.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="space-y-1">
                                  <p className="font-mono font-medium">{call.target_phone}</p>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                                    <span>{call.ai_mode}</span>
                                    {call.scheduled_at && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {format(new Date(call.scheduled_at), "dd/MM HH:mm", { locale: it })}
                                      </span>
                                    )}
                                  </div>
                                  {call.error_message && (
                                    <p className="text-xs text-red-500">{call.error_message}</p>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  {(call.status === 'pending' || call.status === 'failed') && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => cancelOutboundMutation.mutate(call.id)}
                                      disabled={cancelOutboundMutation.isPending}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="non-client" className="space-y-6">
                {loadingNonClientSettings ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Mic2 className="h-5 w-5" />
                              Direttive Vocali
                            </CardTitle>
                            <CardDescription>
                              Queste istruzioni vengono sempre aggiunte in cima al prompt finale. Definiscono il tono, lo stile e le regole di comunicazione.
                            </CardDescription>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetDirectives}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Ripristina Default
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={voiceDirectives}
                          onChange={(e) => {
                            setVoiceDirectives(e.target.value);
                            setHasChanges(true);
                          }}
                          className="min-h-[200px] font-mono text-sm"
                          placeholder="Direttive vocali..."
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Contenuto Prompt
                        </CardTitle>
                        <CardDescription>
                          Scegli la fonte del prompt per le chiamate da numeri non riconosciuti. Il prompt finale sarà: Direttive Vocali + Contenuto Prompt.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <RadioGroup
                          value={promptSource}
                          onValueChange={(value: 'agent' | 'manual' | 'default') => {
                            setPromptSource(value);
                            setHasChanges(true);
                          }}
                          className="space-y-4"
                        >
                          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value="agent" id="agent" className="mt-1" />
                            <div className="flex-1 space-y-3">
                              <Label htmlFor="agent" className="flex items-center gap-2 cursor-pointer">
                                <Bot className="h-4 w-4" />
                                Importa da Agente
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                Usa il prompt di un agente WhatsApp esistente. L'agente verrà usato con le sue istruzioni complete.
                              </p>
                              {promptSource === 'agent' && (
                                <div className="pt-2">
                                  <Select
                                    value={selectedAgentId || ''}
                                    onValueChange={(value) => {
                                      setSelectedAgentId(value || null);
                                      setHasChanges(true);
                                    }}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Seleziona un agente..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {nonClientSettingsData?.availableAgents.map((agent) => (
                                        <SelectItem key={agent.id} value={agent.id}>
                                          <div className="flex items-center gap-2">
                                            <span>{agent.name}</span>
                                            {agent.persona && (
                                              <Badge variant="outline" className="text-xs">
                                                {agent.persona}
                                              </Badge>
                                            )}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {selectedAgent?.prompt && (
                                    <AgentPromptPreview prompt={selectedAgent.prompt} agentName={selectedAgent.name} />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value="manual" id="manual" className="mt-1" />
                            <div className="flex-1 space-y-3">
                              <Label htmlFor="manual" className="flex items-center gap-2 cursor-pointer">
                                <FileText className="h-4 w-4" />
                                Template Manuale
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                Scrivi un prompt personalizzato per i non-clienti. Usa {"{{consultantName}}"} e {"{{businessName}}"} come placeholder.
                              </p>
                              {promptSource === 'manual' && (
                                <Textarea
                                  value={manualPrompt}
                                  onChange={(e) => {
                                    setManualPrompt(e.target.value);
                                    setHasChanges(true);
                                  }}
                                  className="min-h-[200px] font-mono text-sm"
                                  placeholder="Scrivi il tuo prompt personalizzato..."
                                />
                              )}
                            </div>
                          </div>

                          <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value="default" id="default" className="mt-1" />
                            <div className="flex-1 space-y-3">
                              <Label htmlFor="default" className="flex items-center gap-2 cursor-pointer">
                                <Settings className="h-4 w-4" />
                                Template Default
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                Usa il template predefinito di sistema con mini-discovery e proposta appuntamento.
                              </p>
                              {promptSource === 'default' && nonClientSettingsData?.defaultNonClientPrompt && (
                                <div className="mt-3 p-3 bg-muted rounded-md">
                                  <Label className="text-xs text-muted-foreground">Template Default (non modificabile):</Label>
                                  <pre className="mt-2 text-xs whitespace-pre-wrap max-h-[200px] overflow-auto text-muted-foreground">
                                    {nonClientSettingsData.defaultNonClientPrompt}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        </RadioGroup>
                      </CardContent>
                    </Card>

                    <div className="flex justify-end">
                      <Button
                        onClick={() => saveNonClientSettingsMutation.mutate()}
                        disabled={!hasChanges || saveNonClientSettingsMutation.isPending}
                        size="lg"
                      >
                        {saveNonClientSettingsMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Salva Impostazioni
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="vps" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Configurazione VPS Voice Bridge
                    </CardTitle>
                    <CardDescription>
                      Configura il bridge VPS per connettere FreeSWITCH a questa piattaforma
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Stato Token */}
                    <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/50">
                      <div className={`p-2 rounded-full ${tokenStatus?.hasToken || serviceToken ? 'bg-green-100' : 'bg-yellow-100'}`}>
                        <Key className={`h-5 w-5 ${tokenStatus?.hasToken || serviceToken ? 'text-green-600' : 'text-yellow-600'}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {tokenStatus?.hasToken || serviceToken ? 'Token Attivo' : 'Nessun Token'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {serviceToken 
                            ? 'Il token è pronto. Copialo nel file .env della VPS.' 
                            : tokenStatus?.hasToken 
                              ? tokenStatus.message
                              : 'Genera un token per connettere il VPS a questa piattaforma.'}
                        </p>
                        {tokenStatus?.hasToken && tokenStatus.lastGeneratedAt && !serviceToken && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Ultimo generato: {new Date(tokenStatus.lastGeneratedAt).toLocaleString('it-IT')}
                            {tokenStatus.revokedCount > 0 && (
                              <span className="ml-2 text-orange-600">
                                ({tokenStatus.revokedCount} token precedenti revocati)
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <Button 
                        onClick={() => generateTokenMutation.mutate()}
                        disabled={generateTokenMutation.isPending}
                        variant={tokenStatus?.hasToken || serviceToken ? "outline" : "default"}
                      >
                        {generateTokenMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : tokenStatus?.hasToken || serviceToken ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Rigenera
                          </>
                        ) : (
                          <>
                            <Key className="h-4 w-4 mr-2" />
                            Genera Token
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Token input/output */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Token di Servizio (REPLIT_SERVICE_TOKEN):</label>
                      <div className="flex gap-2">
                        <Input
                          value={serviceToken || ''}
                          onChange={(e) => setServiceToken(e.target.value)}
                          placeholder="Incolla qui il token JWT esistente oppure genera uno nuovo"
                          className="font-mono text-xs"
                        />
                        <Button onClick={copyToken} variant="outline" size="icon" disabled={!serviceToken}>
                          {tokenCopied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button 
                          onClick={() => saveTokenMutation.mutate(serviceToken || '')}
                          disabled={saveTokenMutation.isPending || !serviceToken}
                          variant="default"
                        >
                          {saveTokenMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Salva
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Incolla il token esistente dalla VPS oppure generane uno nuovo. Clicca "Salva" per sincronizzarlo.
                      </p>
                    </div>

                    {/* VPS Bridge URL */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">URL del VPS Bridge (per chiamate in uscita):</label>
                      <div className="flex gap-2">
                        <Input
                          value={vpsBridgeUrl}
                          onChange={(e) => setVpsBridgeUrl(e.target.value)}
                          placeholder="http://72.62.50.40:9090"
                          className="font-mono text-xs"
                        />
                        <Button 
                          onClick={() => saveVpsUrlMutation.mutate(vpsBridgeUrl)}
                          disabled={saveVpsUrlMutation.isPending}
                          variant="outline"
                        >
                          {saveVpsUrlMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Salva
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        L'indirizzo IP e porta del tuo VPS dove gira il bridge (es: http://IP:9090)
                      </p>
                    </div>

                    {/* WS_AUTH_TOKEN */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">WS_AUTH_TOKEN (per FreeSWITCH):</label>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setWsAuthToken(crypto.randomUUID().replace(/-/g, ''))}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Rigenera
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={wsAuthToken}
                          readOnly
                          className="font-mono text-xs"
                        />
                        <Button 
                          onClick={() => {
                            navigator.clipboard.writeText(wsAuthToken);
                            toast({ title: "Copiato!", description: "WS_AUTH_TOKEN copiato" });
                          }} 
                          variant="outline" 
                          size="icon"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Questo token autentica FreeSWITCH al bridge. Usalo sia nel .env che nel dialplan.
                      </p>
                    </div>

                    {/* Template .env */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">File .env per la VPS:</label>
                      <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                        <pre>{`# Bridge WebSocket Server
WS_HOST=0.0.0.0
WS_PORT=9090
WS_AUTH_TOKEN=${wsAuthToken}

# Connessione a Replit (NO /ws/ai-voice - lo aggiunge il codice)
REPLIT_WS_URL=${window.location.origin}
REPLIT_API_URL=${window.location.origin}
REPLIT_API_TOKEN=${serviceToken || 'GENERA_IL_TOKEN_SOPRA'}

# Audio
AUDIO_SAMPLE_RATE_IN=8000
AUDIO_SAMPLE_RATE_OUT=8000
SESSION_TIMEOUT_MS=1800000
MAX_CONCURRENT_CALLS=10
LOG_LEVEL=debug

# FreeSWITCH Event Socket
ESL_HOST=127.0.0.1
ESL_PORT=8021
ESL_PASSWORD=LA_TUA_PASSWORD_ESL

# SIP Trunk per chiamate in uscita
SIP_GATEWAY=voip_trunk
SIP_CALLER_ID=+39TUONUMERO

# Token per autenticare richieste outbound (usa lo stesso di REPLIT_API_TOKEN)
REPLIT_SERVICE_TOKEN=${serviceToken || 'GENERA_IL_TOKEN_SOPRA'}`}</pre>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const envContent = `# Bridge WebSocket Server
WS_HOST=0.0.0.0
WS_PORT=9090
WS_AUTH_TOKEN=${wsAuthToken}

# Connessione a Replit (NO /ws/ai-voice - lo aggiunge il codice)
REPLIT_WS_URL=${window.location.origin}
REPLIT_API_URL=${window.location.origin}
REPLIT_API_TOKEN=${serviceToken || 'GENERA_IL_TOKEN_SOPRA'}

# Audio
AUDIO_SAMPLE_RATE_IN=8000
AUDIO_SAMPLE_RATE_OUT=8000
SESSION_TIMEOUT_MS=1800000
MAX_CONCURRENT_CALLS=10
LOG_LEVEL=debug

# FreeSWITCH Event Socket
ESL_HOST=127.0.0.1
ESL_PORT=8021
ESL_PASSWORD=LA_TUA_PASSWORD_ESL

# SIP Trunk per chiamate in uscita
SIP_GATEWAY=voip_trunk
SIP_CALLER_ID=+39TUONUMERO

# Token per autenticare richieste outbound (usa lo stesso di REPLIT_API_TOKEN)
REPLIT_SERVICE_TOKEN=${serviceToken || 'GENERA_IL_TOKEN_SOPRA'}`;
                          navigator.clipboard.writeText(envContent);
                          toast({ title: "Copiato!", description: "Template .env copiato negli appunti" });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copia Template .env
                      </Button>
                    </div>

                    {/* Istruzioni FreeSWITCH */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Configurazione FreeSWITCH (dialplan):</label>
                      <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                        <pre>{`<action application="audio_stream" data="ws://127.0.0.1:9090?token=${wsAuthToken} mono 8000"/>`}</pre>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`<action application="audio_stream" data="ws://127.0.0.1:9090?token=${wsAuthToken} mono 8000"/>`);
                          toast({ title: "Copiato!", description: "Configurazione FreeSWITCH copiata" });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copia Dialplan
                      </Button>
                    </div>

                    {/* Comandi VPS */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Comandi per avviare il bridge sulla VPS:</label>
                      <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                        <pre>{`cd /opt/alessia-voice
npm install
npm run build
systemctl restart alessia-voice
journalctl -u alessia-voice -f  # Per vedere i log`}</pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
