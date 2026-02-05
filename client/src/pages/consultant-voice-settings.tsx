import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  PhoneOutgoing,
  Clock,
  Shield,
  Settings,
  Save,
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Volume2,
  ArrowLeft,
  HelpCircle,
  Copy,
  Check,
  BookOpen,
  Server,
  Layers,
  Info,
} from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";

interface VoiceNumber {
  id: string;
  phone_number: string;
  display_name: string | null;
  greeting_text: string | null;
  ai_mode: string;
  fallback_number: string | null;
  active_days: string[];
  active_hours_start: string;
  active_hours_end: string;
  timezone: string;
  out_of_hours_action: string;
  max_concurrent_calls: number;
  max_call_duration_minutes: number;
  is_active: boolean;
  created_at: string;
}

interface HealthStatus {
  overall: string;
  components: {
    database: { status: string; latencyMs: number };
    esl: { status: string; note?: string };
    freeswitch: { status: string; note?: string };
    gemini: { status: string; note?: string };
  };
}

const DAYS_OF_WEEK = [
  { value: "mon", label: "Lun" },
  { value: "tue", label: "Mar" },
  { value: "wed", label: "Mer" },
  { value: "thu", label: "Gio" },
  { value: "fri", label: "Ven" },
  { value: "sat", label: "Sab" },
  { value: "sun", label: "Dom" },
];

const AI_MODES = [
  { value: "assistenza", label: "Assistenza Generale" },
  { value: "prenotazione", label: "Prenotazione Appuntamenti" },
  { value: "informazioni", label: "Solo Informazioni" },
  { value: "trasferimento", label: "Trasferimento a Umano" },
];

const OUT_OF_HOURS_ACTIONS = [
  { value: "voicemail", label: "Segreteria Telefonica" },
  { value: "transfer", label: "Trasferisci a Fallback" },
  { value: "hangup", label: "Riattacca con Messaggio" },
];

export default function ConsultantVoiceSettingsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<VoiceNumber | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // State per configurazione SIP
  const [sipCallerId, setSipCallerId] = useState("");
  const [sipGateway, setSipGateway] = useState("voip_trunk");
  const [eslPassword, setEslPassword] = useState("");
  const [sipSaved, setSipSaved] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query per impostazioni SIP
  const { data: sipData, isLoading: loadingSip } = useQuery({
    queryKey: ["/api/voice/sip-settings"],
    queryFn: async () => {
      const res = await fetch("/api/voice/sip-settings", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento impostazioni SIP");
      return res.json();
    },
  });

  // Popola i campi quando arrivano i dati
  useEffect(() => {
    if (sipData) {
      setSipCallerId(sipData.sipCallerId || "");
      setSipGateway(sipData.sipGateway || "voip_trunk");
      setEslPassword(sipData.eslPassword || "");
    }
  }, [sipData]);

  // Mutation per salvare impostazioni SIP
  const saveSipMutation = useMutation({
    mutationFn: async (data: { sipCallerId: string; sipGateway: string; eslPassword: string }) => {
      const res = await fetch("/api/voice/sip-settings", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Salvato", description: "Configurazione SIP aggiornata" });
      setSipSaved(true);
      setTimeout(() => setSipSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["/api/voice/sip-settings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const { data: numbersData, isLoading: loadingNumbers } = useQuery({
    queryKey: ["/api/voice/numbers"],
    queryFn: async () => {
      const res = await fetch("/api/voice/numbers", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento numeri");
      return res.json();
    },
  });

  const { data: healthData, isLoading: loadingHealth, refetch: refetchHealth } = useQuery({
    queryKey: ["/api/voice/health"],
    queryFn: async () => {
      const res = await fetch("/api/voice/health", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore nel caricamento stato sistema");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<VoiceNumber> & { id?: string }) => {
      const url = data.id ? `/api/voice/numbers/${data.id}` : "/api/voice/numbers";
      const method = data.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel salvataggio");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Salvato", description: "Configurazione aggiornata con successo" });
      queryClient.invalidateQueries({ queryKey: ["/api/voice/numbers"] });
      setSelectedNumber(null);
      setIsCreating(false);
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/voice/numbers/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore nell'eliminazione");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Eliminato", description: "Numero rimosso" });
      queryClient.invalidateQueries({ queryKey: ["/api/voice/numbers"] });
      setSelectedNumber(null);
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const numbers: VoiceNumber[] = numbersData?.numbers || [];
  const health: HealthStatus | undefined = healthData;

  const handleSave = (formData: FormData) => {
    const activeDays = DAYS_OF_WEEK.map((d) => d.value).filter((day) =>
      formData.get(`day_${day}`) === "on"
    );

    const data: Partial<VoiceNumber> = {
      phone_number: formData.get("phone_number") as string,
      display_name: formData.get("display_name") as string || null,
      greeting_text: formData.get("greeting_text") as string || null,
      ai_mode: formData.get("ai_mode") as string,
      fallback_number: formData.get("fallback_number") as string || null,
      active_days: activeDays,
      active_hours_start: formData.get("active_hours_start") as string,
      active_hours_end: formData.get("active_hours_end") as string,
      timezone: formData.get("timezone") as string,
      out_of_hours_action: formData.get("out_of_hours_action") as string,
      max_concurrent_calls: parseInt(formData.get("max_concurrent_calls") as string, 10),
      max_call_duration_minutes: parseInt(formData.get("max_call_duration_minutes") as string, 10),
      is_active: formData.get("is_active") === "on",
    };

    if (selectedNumber?.id) {
      saveMutation.mutate({ ...data, id: selectedNumber.id });
    } else {
      saveMutation.mutate(data);
    }
  };

  const renderHealthBadge = (status: string) => {
    switch (status) {
      case "up":
      case "healthy":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Online</Badge>;
      case "down":
      case "unhealthy":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Offline</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={`flex-1 flex flex-col ${isMobile ? "w-full" : "ml-0"}`}>
        <Navbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 p-6 lg:px-8 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/consultant/voice-calls">
                  <Button variant="ghost" size="icon">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Phone className="h-8 w-8" />
                    Configurazione Voice
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    Gestisci i numeri telefonici e le impostazioni per le chiamate AI
                  </p>
                </div>
              </div>
              <Button onClick={refetchHealth} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Aggiorna Stato
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Stato Sistema
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingHealth ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Caricamento...
                  </div>
                ) : health ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Database</div>
                      {renderHealthBadge(health.components.database.status)}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">ESL</div>
                      {renderHealthBadge(health.components.esl.status)}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">FreeSWITCH</div>
                      {renderHealthBadge(health.components.freeswitch.status)}
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Gemini AI</div>
                      {renderHealthBadge(health.components.gemini.status)}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Impossibile caricare lo stato</p>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="outbound" className="w-full">
              <TabsList>
                <TabsTrigger value="outbound" className="flex items-center gap-2">
                  <PhoneOutgoing className="h-4 w-4" />
                  Chiamate in Uscita
                </TabsTrigger>
                <TabsTrigger value="numbers" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Numeri Inbound
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Anti-Abuso
                </TabsTrigger>
              </TabsList>

              {/* TAB CHIAMATE IN USCITA */}
              <TabsContent value="outbound" className="space-y-6">
                {/* GUIDA RAPIDA */}
                <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                      <HelpCircle className="h-5 w-5" />
                      Guida Rapida: Configurazione Chiamate in Uscita
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-white/60 dark:bg-zinc-900/60">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">1. Numero Caller ID</h4>
                        <p className="text-muted-foreground">
                          Il numero che appare sul telefono del destinatario quando l'AI chiama.
                          Deve essere un numero VoIP registrato sul tuo trunk SIP.
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/60 dark:bg-zinc-900/60">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">2. SIP Gateway</h4>
                        <p className="text-muted-foreground">
                          Il nome del gateway configurato in FreeSWITCH che instrada le chiamate
                          verso il tuo provider VoIP (es: "voip_trunk", "sipgate").
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/60 dark:bg-zinc-900/60">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">3. Password ESL</h4>
                        <p className="text-muted-foreground">
                          La password per connettersi all'Event Socket di FreeSWITCH.
                          La trovi nel file /etc/freeswitch/autoload_configs/event_socket.conf.xml
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-white/60 dark:bg-zinc-900/60">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">4. Configura anche il .env VPS</h4>
                        <p className="text-muted-foreground">
                          Vai alla pagina Chiamate → Tab "Connessione VPS" per copiare il template
                          .env completo da usare sulla tua VPS.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* CONFIGURAZIONE SIP */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PhoneOutgoing className="h-5 w-5" />
                      Configurazione Numero VoIP
                    </CardTitle>
                    <CardDescription>
                      Inserisci i dati del tuo account VoIP per effettuare chiamate in uscita
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {loadingSip ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-6 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="sipCallerId">Numero Caller ID *</Label>
                            <Input
                              id="sipCallerId"
                              value={sipCallerId}
                              onChange={(e) => setSipCallerId(e.target.value)}
                              placeholder="+39 02 1234567"
                              className="font-mono"
                            />
                            <p className="text-xs text-muted-foreground">
                              Il numero che vedrà chi riceve la chiamata
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="sipGateway">Nome Gateway SIP</Label>
                            <Input
                              id="sipGateway"
                              value={sipGateway}
                              onChange={(e) => setSipGateway(e.target.value)}
                              placeholder="voip_trunk"
                              className="font-mono"
                            />
                            <p className="text-xs text-muted-foreground">
                              Il nome del gateway nel file sip_profiles di FreeSWITCH
                            </p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="eslPassword">Password ESL FreeSWITCH</Label>
                          <Input
                            id="eslPassword"
                            type="password"
                            value={eslPassword}
                            onChange={(e) => setEslPassword(e.target.value)}
                            placeholder="ClueCon (default FreeSWITCH)"
                            className="font-mono"
                          />
                          <p className="text-xs text-muted-foreground">
                            Lascia vuoto per usare il valore nel .env della VPS
                          </p>
                        </div>

                        <Separator />

                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => saveSipMutation.mutate({ sipCallerId, sipGateway, eslPassword })}
                            disabled={saveSipMutation.isPending || !sipCallerId}
                          >
                            {saveSipMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : sipSaved ? (
                              <Check className="h-4 w-4 mr-2 text-green-500" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            {sipSaved ? "Salvato!" : "Salva Configurazione"}
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* VERIFICA CONFIGURAZIONE */}
                {sipCallerId && (
                  <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <CheckCircle className="h-6 w-6 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-green-800 dark:text-green-200">
                            Configurazione Pronta
                          </h4>
                          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                            Quando l'AI effettuerà una chiamata, il destinatario vedrà il numero: <strong className="font-mono">{sipCallerId}</strong>
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Assicurati che lo stesso numero sia configurato nel trunk SIP del tuo provider VoIP.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* GUIDA COMPLETA FREESWITCH */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Guida: Configurazione Numeri e Limiti su FreeSWITCH
                    </CardTitle>
                    <CardDescription>
                      Come configurare uno o piu numeri VoIP e impostare i limiti di chiamate simultanee
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">

                    {/* TABELLA PIANI TARIFFARI */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2 text-base">
                        <Phone className="h-4 w-4" />
                        Canali per Piano Tariffario
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Ogni provider VoIP ha un limite di chiamate simultanee (canali). Se superi il limite, il provider potrebbe bloccarti o addebitarti penali. Ecco i limiti piu comuni:
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border rounded-lg overflow-hidden">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="text-left p-3 font-semibold">Provider / Piano</th>
                              <th className="text-center p-3 font-semibold">Canali Simultanei</th>
                              <th className="text-left p-3 font-semibold">Note</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            <tr>
                              <td className="p-3 font-medium">SIM Iliad / Ho Mobile</td>
                              <td className="p-3 text-center"><Badge variant="secondary">1</Badge></td>
                              <td className="p-3 text-muted-foreground">Solo 1 chiamata alla volta, come un telefono fisico</td>
                            </tr>
                            <tr className="bg-muted/20">
                              <td className="p-3 font-medium">Vodafone Casa / TIM Fisso</td>
                              <td className="p-3 text-center"><Badge variant="secondary">1</Badge></td>
                              <td className="p-3 text-muted-foreground">Linea tradizionale = 1 canale</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-medium">Messagenet Free</td>
                              <td className="p-3 text-center"><Badge variant="secondary">2</Badge></td>
                              <td className="p-3 text-muted-foreground">Piano gratuito con 2 canali inclusi</td>
                            </tr>
                            <tr className="bg-muted/20">
                              <td className="p-3 font-medium">Messagenet Business</td>
                              <td className="p-3 text-center"><Badge>5-10</Badge></td>
                              <td className="p-3 text-muted-foreground">In base al piano scelto</td>
                            </tr>
                            <tr>
                              <td className="p-3 font-medium">OVH VoIP / Clouditalia</td>
                              <td className="p-3 text-center"><Badge>2-20</Badge></td>
                              <td className="p-3 text-muted-foreground">Dipende dal trunk SIP acquistato</td>
                            </tr>
                            <tr className="bg-muted/20">
                              <td className="p-3 font-medium">VoIP Business (Wildix, 3CX)</td>
                              <td className="p-3 text-center"><Badge>10-100+</Badge></td>
                              <td className="p-3 text-muted-foreground">Piani enterprise con molti canali</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          Se non sai quanti canali hai, contatta il tuo provider VoIP o controlla il contratto. Impostare un limite <strong>uguale o inferiore</strong> al numero di canali previene blocchi e penali.
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* 3 LIVELLI DI PROTEZIONE */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2 text-base">
                        <Layers className="h-4 w-4" />
                        3 Livelli di Protezione
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Per una protezione completa, i limiti vanno configurati a 3 livelli. FreeSWITCH e il "buttafuori" finale: anche se il software si sbaglia, FreeSWITCH blocca fisicamente la chiamata in eccesso.
                      </p>
                      <div className="grid gap-3">
                        <div className="p-4 rounded-lg border bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                          <div className="flex items-center gap-2 mb-2">
                            <Server className="h-4 w-4 text-red-600" />
                            <h5 className="font-semibold text-red-800 dark:text-red-200">Livello 1: Globale (Protezione Server)</h5>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Limita il numero totale di sessioni su tutta la VPS. Protegge da attacchi o sovraccarichi.
                          </p>
                          <div className="bg-zinc-900 text-zinc-100 p-3 rounded-md font-mono text-xs overflow-x-auto">
                            <div className="text-zinc-500">&lt;!-- File: conf/autoload_configs/switch.conf.xml --&gt;</div>
                            <div>&lt;param name=<span className="text-green-400">"max-sessions"</span> value=<span className="text-amber-400">"200"</span>/&gt;</div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Per VPS piccole (2-4 CPU) usa 100-200. Non lasciare il default 100000.
                          </p>
                        </div>

                        <div className="p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="h-4 w-4 text-blue-600" />
                            <h5 className="font-semibold text-blue-800 dark:text-blue-200">Livello 2: Per Gateway (Protezione Provider)</h5>
                            <Badge variant="outline" className="text-xs">Fondamentale</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Questo e il punto chiave. Usa l'applicazione <code className="bg-muted px-1 rounded">limit</code> nel Dialplan per dire a FreeSWITCH:
                            "Su questo gateway, fai passare massimo N chiamate alla volta".
                          </p>
                          <div className="bg-zinc-900 text-zinc-100 p-3 rounded-md font-mono text-xs overflow-x-auto whitespace-pre">
                            <div className="text-zinc-500">&lt;!-- File: conf/dialplan/default.xml --&gt;</div>
                            <div className="text-zinc-500">&lt;!-- Esempio: Vodafone Casa (1 canale) --&gt;</div>
{`<extension name="chiamata_uscita_vodafone">
  <condition field="destination_number" expression="^(\\d+)$">
    `}<span className="text-amber-400">{`<action application="limit" data="hash gateway vodafone_casa 1 !USER_BUSY"/>`}</span>{`
    <action application="bridge" data="sofia/gateway/vodafone_casa/$1"/>
  </condition>
</extension>`}
                          </div>
                          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                            <p><strong>Come funziona:</strong></p>
                            <p>1. Arriva la 1a chiamata &#8594; <code className="bg-muted px-1 rounded">limit</code> vede 0 attive, la fa passare. Contatore sale a 1.</p>
                            <p>2. Arriva la 2a chiamata (mentre la 1a e attiva) &#8594; <code className="bg-muted px-1 rounded">limit</code> vede 1 su 1.</p>
                            <p>3. Scatta <code className="bg-muted px-1 rounded">!USER_BUSY</code>: FreeSWITCH rifiuta subito con segnale "Occupato". La chiamata non parte.</p>
                          </div>
                        </div>

                        <div className="p-4 rounded-lg border bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2 mb-2">
                            <Settings className="h-4 w-4 text-green-600" />
                            <h5 className="font-semibold text-green-800 dark:text-green-200">Livello 3: Software (Questo Pannello)</h5>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Il campo "Max Chiamate Simultanee" nel tab Numeri Inbound serve come controllo logico e per l'interfaccia utente.
                            Mostra un errore prima di tentare la chiamata, ma FreeSWITCH resta il blocco finale.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* CONFIGURAZIONE MULTI-NUMERO */}
                    <div className="space-y-3">
                      <h4 className="font-semibold flex items-center gap-2 text-base">
                        <PhoneOutgoing className="h-4 w-4" />
                        Configurazione Multi-Numero (Piu Gateway)
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Se hai piu numeri o provider diversi, configura un gateway separato per ciascuno con il suo limite.
                        Ogni gateway puo avere un limite diverso in base al piano tariffario.
                      </p>
                      <div className="bg-zinc-900 text-zinc-100 p-3 rounded-md font-mono text-xs overflow-x-auto whitespace-pre">
                        <div className="text-zinc-500">&lt;!-- Gateway 1: SIM Iliad (1 canale) --&gt;</div>
{`<extension name="uscita_iliad">
  <condition field="destination_number" expression="^(\\d+)$">
    <action application="limit" data="hash gateway iliad_sim 1 !USER_BUSY"/>
    <action application="bridge" data="sofia/gateway/iliad_sim/$1"/>
  </condition>
</extension>

`}<div className="text-zinc-500">&lt;!-- Gateway 2: Messagenet (2 canali) --&gt;</div>
{`<extension name="uscita_messagenet">
  <condition field="destination_number" expression="^(\\d+)$">
    <action application="limit" data="hash gateway messagenet_trunk 2 !USER_BUSY"/>
    <action application="bridge" data="sofia/gateway/messagenet_trunk/$1"/>
  </condition>
</extension>

`}<div className="text-zinc-500">&lt;!-- Gateway 3: VoIP Business (10 canali) --&gt;</div>
{`<extension name="uscita_business">
  <condition field="destination_number" expression="^(\\d+)$">
    <action application="limit" data="hash gateway voip_business 10 !USER_BUSY"/>
    <action application="bridge" data="sofia/gateway/voip_business/$1"/>
  </condition>
</extension>`}
                      </div>
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-800 dark:text-blue-200">
                          <p className="font-medium mb-1">Come scegliere il gateway attivo</p>
                          <p className="text-muted-foreground">
                            Il nome gateway che inserisci sopra nel campo "Nome Gateway SIP" determina quale trunk FreeSWITCH usera per le chiamate in uscita.
                            Se cambi provider, aggiorna sia il gateway in FreeSWITCH che qui nel pannello.
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* RIEPILOGO VELOCE */}
                    <div className="p-4 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200 dark:border-violet-800">
                      <h4 className="font-semibold text-violet-800 dark:text-violet-200 mb-3 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Riepilogo: Cosa Fare
                      </h4>
                      <div className="grid gap-2 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-violet-600 dark:text-violet-400 w-5 flex-shrink-0">1.</span>
                          <span className="text-muted-foreground">Scopri quanti <strong>canali</strong> hai dal tuo provider (vedi tabella sopra)</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-violet-600 dark:text-violet-400 w-5 flex-shrink-0">2.</span>
                          <span className="text-muted-foreground">Configura <code className="bg-muted px-1 rounded">limit</code> nel Dialplan di FreeSWITCH con quel numero</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-violet-600 dark:text-violet-400 w-5 flex-shrink-0">3.</span>
                          <span className="text-muted-foreground">Imposta <code className="bg-muted px-1 rounded">max-sessions</code> in switch.conf.xml (es: 200 per VPS piccole)</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-violet-600 dark:text-violet-400 w-5 flex-shrink-0">4.</span>
                          <span className="text-muted-foreground">Compila i campi sopra (Caller ID, Gateway SIP) e salva</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-violet-600 dark:text-violet-400 w-5 flex-shrink-0">5.</span>
                          <span className="text-muted-foreground">Aggiorna il file <code className="bg-muted px-1 rounded">.env</code> sulla VPS (vai a Chiamate &#8594; Connessione VPS)</span>
                        </div>
                      </div>
                    </div>

                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="numbers" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Numeri Configurati</h2>
                  <Button onClick={() => { setIsCreating(true); setSelectedNumber(null); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Aggiungi Numero
                  </Button>
                </div>

                {loadingNumbers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : numbers.length === 0 && !isCreating ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">Nessun numero configurato</h3>
                      <p className="text-muted-foreground mb-4">
                        Aggiungi un numero telefonico per iniziare a ricevere chiamate AI
                      </p>
                      <Button onClick={() => setIsCreating(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Configura Primo Numero
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {numbers.map((num) => (
                      <Card
                        key={num.id}
                        className={`cursor-pointer hover:border-primary transition-colors ${
                          selectedNumber?.id === num.id ? "border-primary" : ""
                        }`}
                        onClick={() => { setSelectedNumber(num); setIsCreating(false); }}
                      >
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-mono text-lg font-medium">{num.phone_number}</div>
                              {num.display_name && (
                                <div className="text-sm text-muted-foreground">{num.display_name}</div>
                              )}
                            </div>
                            <Badge variant={num.is_active ? "default" : "secondary"}>
                              {num.is_active ? "Attivo" : "Inattivo"}
                            </Badge>
                          </div>
                          <div className="mt-3 flex gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {num.active_hours_start} - {num.active_hours_end}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {(selectedNumber || isCreating) && (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>
                        {isCreating ? "Nuovo Numero" : "Modifica Numero"}
                      </CardTitle>
                      <CardDescription>
                        Configura le impostazioni del numero telefonico
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSave(new FormData(e.currentTarget));
                        }}
                        className="space-y-6"
                      >
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="phone_number">Numero Telefono *</Label>
                            <Input
                              id="phone_number"
                              name="phone_number"
                              placeholder="+39..."
                              defaultValue={selectedNumber?.phone_number || ""}
                              required
                              disabled={!!selectedNumber?.id}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="display_name">Nome Visualizzato</Label>
                            <Input
                              id="display_name"
                              name="display_name"
                              placeholder="Es: Linea Principale"
                              defaultValue={selectedNumber?.display_name || ""}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="greeting_text">Messaggio di Benvenuto</Label>
                          <Textarea
                            id="greeting_text"
                            name="greeting_text"
                            placeholder="Ciao! Sono Alessia, l'assistente virtuale..."
                            defaultValue={selectedNumber?.greeting_text || ""}
                            rows={3}
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="ai_mode">Modalità AI</Label>
                            <Select name="ai_mode" defaultValue={selectedNumber?.ai_mode || "assistenza"}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {AI_MODES.map((mode) => (
                                  <SelectItem key={mode.value} value={mode.value}>
                                    {mode.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="fallback_number">Numero Fallback</Label>
                            <Input
                              id="fallback_number"
                              name="fallback_number"
                              placeholder="+39..."
                              defaultValue={selectedNumber?.fallback_number || ""}
                            />
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                          <h3 className="font-medium flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Orari di Attività
                          </h3>

                          <div className="space-y-2">
                            <Label>Giorni Attivi</Label>
                            <div className="flex flex-wrap gap-2">
                              {DAYS_OF_WEEK.map((day) => {
                                const isActive = selectedNumber?.active_days?.includes(day.value) ?? 
                                  ["mon", "tue", "wed", "thu", "fri"].includes(day.value);
                                return (
                                  <label
                                    key={day.value}
                                    className="flex items-center gap-1 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      name={`day_${day.value}`}
                                      defaultChecked={isActive}
                                      className="sr-only peer"
                                    />
                                    <div className="px-3 py-1 rounded-full border peer-checked:bg-primary peer-checked:text-primary-foreground transition-colors">
                                      {day.label}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label htmlFor="active_hours_start">Inizio</Label>
                              <Input
                                id="active_hours_start"
                                name="active_hours_start"
                                type="time"
                                defaultValue={selectedNumber?.active_hours_start || "09:00"}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="active_hours_end">Fine</Label>
                              <Input
                                id="active_hours_end"
                                name="active_hours_end"
                                type="time"
                                defaultValue={selectedNumber?.active_hours_end || "18:00"}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="timezone">Fuso Orario</Label>
                              <Input
                                id="timezone"
                                name="timezone"
                                defaultValue={selectedNumber?.timezone || "Europe/Rome"}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="out_of_hours_action">Azione Fuori Orario</Label>
                            <Select
                              name="out_of_hours_action"
                              defaultValue={selectedNumber?.out_of_hours_action || "voicemail"}
                            >
                              <SelectTrigger className="w-full md:w-[300px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {OUT_OF_HOURS_ACTIONS.map((action) => (
                                  <SelectItem key={action.value} value={action.value}>
                                    {action.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                          <h3 className="font-medium flex items-center gap-2">
                            <Volume2 className="h-4 w-4" />
                            Limiti
                          </h3>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="max_concurrent_calls">Max Chiamate Simultanee</Label>
                              <Input
                                id="max_concurrent_calls"
                                name="max_concurrent_calls"
                                type="number"
                                min={1}
                                max={20}
                                defaultValue={selectedNumber?.max_concurrent_calls || 5}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="max_call_duration_minutes">Durata Max (minuti)</Label>
                              <Input
                                id="max_call_duration_minutes"
                                name="max_call_duration_minutes"
                                type="number"
                                min={1}
                                max={120}
                                defaultValue={selectedNumber?.max_call_duration_minutes || 30}
                              />
                            </div>
                          </div>
                        </div>

                        <Separator />

                        <div className="flex items-center gap-4">
                          <Switch
                            id="is_active"
                            name="is_active"
                            defaultChecked={selectedNumber?.is_active ?? true}
                          />
                          <Label htmlFor="is_active">Numero Attivo</Label>
                        </div>

                        <div className="flex justify-between pt-4">
                          <div>
                            {selectedNumber?.id && (
                              <Button
                                type="button"
                                variant="destructive"
                                onClick={() => deleteMutation.mutate(selectedNumber.id)}
                                disabled={deleteMutation.isPending}
                              >
                                {deleteMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Trash2 className="h-4 w-4 mr-2" />
                                )}
                                Elimina
                              </Button>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => { setSelectedNumber(null); setIsCreating(false); }}
                            >
                              Annulla
                            </Button>
                            <Button type="submit" disabled={saveMutation.isPending}>
                              {saveMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Save className="h-4 w-4 mr-2" />
                              )}
                              Salva
                            </Button>
                          </div>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="security" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Impostazioni Anti-Abuso
                    </CardTitle>
                    <CardDescription>
                      Configura rate limiting e blocco numeri per prevenire abusi
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="bg-muted p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Rate Limiting Predefiniti</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Max 3 chiamate al minuto per numero</li>
                        <li>• Max 20 chiamate all'ora per numero</li>
                        <li>• Max 50 chiamate al giorno per numero</li>
                        <li>• Blocco automatico numeri anonimi</li>
                        <li>• Blocco prefissi premium (+1900, +44870, ecc.)</li>
                      </ul>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Le impostazioni anti-abuso vengono gestite a livello di server VPS.
                      Contatta l'amministratore per modifiche personalizzate.
                    </p>
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
