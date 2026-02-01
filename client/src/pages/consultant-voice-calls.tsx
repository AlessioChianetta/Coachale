import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Clock,
  User,
  Search,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Settings,
  Key,
  Copy,
  Check,
  Mic2,
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

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Phone; color: string }> = {
  ringing: { label: "In Arrivo", icon: PhoneIncoming, color: "bg-yellow-500" },
  answered: { label: "Connessa", icon: Phone, color: "bg-blue-500" },
  talking: { label: "In Corso", icon: Phone, color: "bg-green-500" },
  completed: { label: "Completata", icon: CheckCircle, color: "bg-green-600" },
  failed: { label: "Fallita", icon: PhoneMissed, color: "bg-red-500" },
  transferred: { label: "Trasferita", icon: PhoneForwarded, color: "bg-purple-500" },
  ended: { label: "Terminata", icon: PhoneOff, color: "bg-gray-500" },
};

const VOICES = [
  { value: 'Achernar', label: 'Achernar', description: '🇮🇹 Femminile Professionale' },
  { value: 'Puck', label: 'Puck', description: '🇬🇧 Maschile Giovane' },
  { value: 'Charon', label: 'Charon', description: '🇬🇧 Maschile Maturo' },
  { value: 'Kore', label: 'Kore', description: '🇬🇧 Femminile Giovane' },
  { value: 'Fenrir', label: 'Fenrir', description: '🇬🇧 Maschile Profondo' },
  { value: 'Aoede', label: 'Aoede', description: '🇬🇧 Femminile Melodiosa' },
];

export default function ConsultantVoiceCallsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<string>("day");
  const [serviceToken, setServiceToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);

  const { toast } = useToast();

  // Voice settings query
  const { data: voiceSettings, refetch: refetchVoice } = useQuery({
    queryKey: ["/api/voice/settings"],
    queryFn: async () => {
      const res = await fetch("/api/voice/settings", { headers: getAuthHeaders() });
      if (!res.ok) return { voiceId: 'achernar' };
      return res.json();
    },
  });

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
      toast({ title: "Token generato", description: "Il token di servizio è pronto per essere copiato" });
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

  const calls: VoiceCall[] = callsData?.calls || [];
  const pagination = callsData?.pagination || { page: 1, totalPages: 1, total: 0 };
  const stats: VoiceStats | undefined = statsData?.stats;
  const activeCalls: number = statsData?.activeCalls || 0;
  const health: HealthStatus | undefined = healthData;

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
                      <div className={`p-2 rounded-full ${serviceToken ? 'bg-green-100' : 'bg-yellow-100'}`}>
                        <Key className={`h-5 w-5 ${serviceToken ? 'text-green-600' : 'text-yellow-600'}`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {serviceToken ? 'Token Generato' : 'Token Non Generato'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {serviceToken 
                            ? 'Il token è pronto. Copialo nel file .env della VPS.' 
                            : 'Genera un token per connettere il VPS a questa piattaforma.'}
                        </p>
                      </div>
                      <Button 
                        onClick={() => generateTokenMutation.mutate()}
                        disabled={generateTokenMutation.isPending}
                        variant={serviceToken ? "outline" : "default"}
                      >
                        {generateTokenMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : serviceToken ? (
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

                    {/* Token generato */}
                    {serviceToken && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Token di Servizio (REPLIT_API_TOKEN):</label>
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
                        <p className="text-xs text-muted-foreground">
                          Il token non scade. Se lo rigeneri, quello vecchio smette di funzionare.
                        </p>
                      </div>
                    )}

                    {/* Template .env */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">File .env per la VPS:</label>
                      <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                        <pre>{`# Bridge WebSocket Server
WS_HOST=0.0.0.0
WS_PORT=9090
WS_AUTH_TOKEN=genera_un_token_random_qui

# Connessione a Replit (NO /ws/ai-voice - lo aggiunge il codice)
REPLIT_WS_URL=${window.location.origin}
REPLIT_API_URL=${window.location.origin}
REPLIT_API_TOKEN=${serviceToken || 'GENERA_IL_TOKEN_SOPRA'}

# Audio
AUDIO_SAMPLE_RATE_IN=8000
AUDIO_SAMPLE_RATE_OUT=8000
SESSION_TIMEOUT_MS=120000
MAX_CONCURRENT_CALLS=10
LOG_LEVEL=info`}</pre>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const envContent = `# Bridge WebSocket Server
WS_HOST=0.0.0.0
WS_PORT=9090
WS_AUTH_TOKEN=genera_un_token_random_qui

# Connessione a Replit
REPLIT_WS_URL=${window.location.origin}
REPLIT_API_URL=${window.location.origin}
REPLIT_API_TOKEN=${serviceToken || 'GENERA_IL_TOKEN_SOPRA'}

# Audio
AUDIO_SAMPLE_RATE_IN=8000
AUDIO_SAMPLE_RATE_OUT=8000
SESSION_TIMEOUT_MS=120000
MAX_CONCURRENT_CALLS=10
LOG_LEVEL=info`;
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
                        <pre>{`<action application="audio_stream" data="ws://127.0.0.1:9090?token=IL_TUO_WS_AUTH_TOKEN mono 8000"/>`}</pre>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Sostituisci IL_TUO_WS_AUTH_TOKEN con il valore di WS_AUTH_TOKEN che hai messo nel .env della VPS.
                      </p>
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
