import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Settings, Activity, Bell, BellOff, Phone, Mail, MessageSquare,
  Clock, Calendar, Shield, Zap, Brain, CheckCircle, AlertCircle,
  XCircle, Info, Loader2, RefreshCw, Eye, ChevronLeft, ChevronRight,
  Save, BarChart3
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";

interface AutonomySettings {
  is_active: boolean;
  autonomy_level: number;
  default_mode: string;
  working_hours_start: string;
  working_hours_end: string;
  working_days: number[];
  max_daily_calls: number;
  max_daily_emails: number;
  max_daily_whatsapp: number;
  max_daily_analyses: number;
  channels_enabled: {
    voice: boolean;
    email: boolean;
    whatsapp: boolean;
  };
  custom_instructions: string;
}

interface ActivityItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  severity: "info" | "success" | "warning" | "error";
  created_at: string;
  contact_name?: string;
  is_read: boolean;
}

interface ActivityResponse {
  activities: ActivityItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Gio" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sab" },
  { value: 7, label: "Dom" },
];

const DEFAULT_SETTINGS: AutonomySettings = {
  is_active: false,
  autonomy_level: 1,
  default_mode: "manual",
  working_hours_start: "08:00",
  working_hours_end: "20:00",
  working_days: [1, 2, 3, 4, 5],
  max_daily_calls: 10,
  max_daily_emails: 20,
  max_daily_whatsapp: 30,
  max_daily_analyses: 50,
  channels_enabled: { voice: true, email: false, whatsapp: false },
  custom_instructions: "",
};

function getAutonomyLabel(level: number): { label: string; color: string; description: string } {
  if (level === 0) return { label: "Disattivato", color: "text-muted-foreground", description: "L'AI non esegue alcuna azione autonomamente." };
  if (level <= 3) return { label: "Solo proposte", color: "text-green-500", description: "L'AI suggerisce azioni ma attende la tua approvazione prima di procedere." };
  if (level <= 6) return { label: "Semi-autonomo", color: "text-yellow-500", description: "L'AI esegue azioni di routine e chiede approvazione solo per decisioni importanti." };
  if (level <= 9) return { label: "Quasi autonomo", color: "text-orange-500", description: "L'AI opera in modo indipendente, notificandoti solo per situazioni critiche." };
  return { label: "Autonomia completa", color: "text-red-500", description: "L'AI gestisce tutto autonomamente senza necessità di approvazione." };
}

function getAutonomyBadgeColor(level: number): string {
  if (level === 0) return "bg-muted text-muted-foreground";
  if (level <= 3) return "bg-green-500/20 text-green-500 border-green-500/30";
  if (level <= 6) return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
  if (level <= 9) return "bg-orange-500/20 text-orange-500 border-orange-500/30";
  return "bg-red-500/20 text-red-500 border-red-500/30";
}

function getActivityIcon(icon: string) {
  switch (icon) {
    case "brain": return <Brain className="h-5 w-5" />;
    case "check": return <CheckCircle className="h-5 w-5" />;
    case "alert": return <AlertCircle className="h-5 w-5" />;
    case "phone": return <Phone className="h-5 w-5" />;
    case "mail": return <Mail className="h-5 w-5" />;
    case "chart": return <BarChart3 className="h-5 w-5" />;
    default: return <Activity className="h-5 w-5" />;
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "info": return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Info</Badge>;
    case "success": return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Successo</Badge>;
    case "warning": return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Avviso</Badge>;
    case "error": return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Errore</Badge>;
    default: return <Badge variant="secondary">{severity}</Badge>;
  }
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Adesso";
  if (diffMin < 60) return `${diffMin} min fa`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "ora" : "ore"} fa`;
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "giorno" : "giorni"} fa`;
  return date.toLocaleDateString("it-IT");
}

export default function ConsultantAIAutonomyPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("settings");
  const [settings, setSettings] = useState<AutonomySettings>(DEFAULT_SETTINGS);
  const [activityPage, setActivityPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ["/api/ai-autonomy/settings"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/settings", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  useEffect(() => {
    if (settingsData) {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...settingsData,
        channels_enabled: {
          ...DEFAULT_SETTINGS.channels_enabled,
          ...(settingsData.channels_enabled || {}),
        },
      });
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: async (data: AutonomySettings) => {
      const res = await fetch("/api/ai-autonomy/settings", {
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
      toast({ title: "Salvato", description: "Impostazioni di autonomia aggiornate con successo" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/settings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const activityUrl = `/api/ai-autonomy/activity?page=${activityPage}&limit=20${severityFilter !== "all" ? `&severity=${severityFilter}` : ""}`;
  const { data: activityData, isLoading: loadingActivity } = useQuery<ActivityResponse>({
    queryKey: [activityUrl],
    queryFn: async () => {
      const res = await fetch(activityUrl, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: activeTab === "activity",
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/ai-autonomy/activity/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/ai-autonomy/activity/unread-count", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai-autonomy/activity/${id}/read`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activityUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/activity/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai-autonomy/activity/read-all", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Fatto", description: "Tutte le attività segnate come lette" });
      queryClient.invalidateQueries({ queryKey: [activityUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-autonomy/activity/unread-count"] });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(settings);
  };

  const toggleWorkingDay = (day: number) => {
    setSettings(prev => ({
      ...prev,
      working_days: prev.working_days.includes(day)
        ? prev.working_days.filter(d => d !== day)
        : [...prev.working_days, day].sort(),
    }));
  };

  const unreadCount = unreadData?.count || 0;
  const autonomyInfo = getAutonomyLabel(settings.autonomy_level);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={`flex-1 flex flex-col ${isMobile ? "w-full" : "ml-0"}`}>
        <Navbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 p-6 lg:px-8 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Bot className="h-8 w-8" />
                Dipendente AI - Autonomia
              </h1>
              <p className="text-muted-foreground mt-1">
                Configura il livello di autonomia e monitora le attività del tuo dipendente AI
              </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Impostazioni Autonomia
                </TabsTrigger>
                <TabsTrigger value="activity" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Feed Attività
                  {unreadCount > 0 && (
                    <Badge className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] h-5">
                      {unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="settings" className="space-y-6 mt-6">
                {loadingSettings ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="h-5 w-5" />
                          Stato e Livello di Autonomia
                        </CardTitle>
                        <CardDescription>
                          Definisci quanto il tuo dipendente AI può operare in modo indipendente
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label className="text-base font-medium">Abilita Dipendente AI</Label>
                            <p className="text-sm text-muted-foreground">
                              Attiva o disattiva il dipendente AI
                            </p>
                          </div>
                          <Switch
                            checked={settings.is_active}
                            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, is_active: checked }))}
                          />
                        </div>

                        <Separator />

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-base font-medium">Livello di Autonomia</Label>
                            <Badge className={getAutonomyBadgeColor(settings.autonomy_level)}>
                              {settings.autonomy_level}/10 — {autonomyInfo.label}
                            </Badge>
                          </div>

                          <Slider
                            value={[settings.autonomy_level]}
                            onValueChange={(val) => setSettings(prev => ({ ...prev, autonomy_level: val[0] }))}
                            max={10}
                            min={0}
                            step={1}
                            className="w-full"
                          />

                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>0 - Disattivato</span>
                            <span className="text-green-500">1-3 Proposte</span>
                            <span className="text-yellow-500">4-6 Semi-auto</span>
                            <span className="text-orange-500">7-9 Quasi-auto</span>
                            <span className="text-red-500">10 Completa</span>
                          </div>

                          <div className={`p-3 rounded-lg border ${autonomyInfo.color === "text-muted-foreground" ? "bg-muted/50" : "bg-muted/30"}`}>
                            <p className={`text-sm ${autonomyInfo.color}`}>
                              <Info className="h-4 w-4 inline mr-1" />
                              {autonomyInfo.description}
                            </p>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <Label className="text-base font-medium">Modalità Predefinita</Label>
                          <Select
                            value={settings.default_mode}
                            onValueChange={(val) => setSettings(prev => ({ ...prev, default_mode: val }))}
                          >
                            <SelectTrigger className="w-full max-w-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">Manuale</SelectItem>
                              <SelectItem value="hybrid">Ibrido</SelectItem>
                              <SelectItem value="automatic">Automatico</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="h-5 w-5" />
                          Orari di Lavoro
                        </CardTitle>
                        <CardDescription>
                          Imposta quando il dipendente AI può operare
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Ora Inizio</Label>
                            <Input
                              type="time"
                              value={settings.working_hours_start}
                              onChange={(e) => setSettings(prev => ({ ...prev, working_hours_start: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Ora Fine</Label>
                            <Input
                              type="time"
                              value={settings.working_hours_end}
                              onChange={(e) => setSettings(prev => ({ ...prev, working_hours_end: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-base font-medium">Giorni Lavorativi</Label>
                          <div className="flex flex-wrap gap-3">
                            {DAYS_OF_WEEK.map((day) => (
                              <div key={day.value} className="flex items-center gap-2">
                                <Checkbox
                                  id={`day-${day.value}`}
                                  checked={settings.working_days.includes(day.value)}
                                  onCheckedChange={() => toggleWorkingDay(day.value)}
                                />
                                <Label htmlFor={`day-${day.value}`} className="text-sm cursor-pointer">
                                  {day.label}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Shield className="h-5 w-5" />
                          Limiti Giornalieri
                        </CardTitle>
                        <CardDescription>
                          Imposta i limiti massimi di azioni giornaliere
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Phone className="h-4 w-4" /> Chiamate
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              value={settings.max_daily_calls}
                              onChange={(e) => setSettings(prev => ({ ...prev, max_daily_calls: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <Mail className="h-4 w-4" /> Email
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              value={settings.max_daily_emails}
                              onChange={(e) => setSettings(prev => ({ ...prev, max_daily_emails: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <MessageSquare className="h-4 w-4" /> WhatsApp
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              value={settings.max_daily_whatsapp}
                              onChange={(e) => setSettings(prev => ({ ...prev, max_daily_whatsapp: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-1">
                              <BarChart3 className="h-4 w-4" /> Analisi
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              value={settings.max_daily_analyses}
                              onChange={(e) => setSettings(prev => ({ ...prev, max_daily_analyses: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Zap className="h-5 w-5" />
                          Canali Abilitati
                        </CardTitle>
                        <CardDescription>
                          Scegli su quali canali il dipendente AI può operare
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-green-500" />
                            <Label>Voice (Chiamate)</Label>
                          </div>
                          <Switch
                            checked={settings.channels_enabled.voice}
                            onCheckedChange={(checked) => setSettings(prev => ({
                              ...prev,
                              channels_enabled: { ...prev.channels_enabled, voice: checked },
                            }))}
                          />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-blue-500" />
                            <Label>Email</Label>
                          </div>
                          <Switch
                            checked={settings.channels_enabled.email}
                            onCheckedChange={(checked) => setSettings(prev => ({
                              ...prev,
                              channels_enabled: { ...prev.channels_enabled, email: checked },
                            }))}
                          />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-emerald-500" />
                            <Label>WhatsApp</Label>
                          </div>
                          <Switch
                            checked={settings.channels_enabled.whatsapp}
                            onCheckedChange={(checked) => setSettings(prev => ({
                              ...prev,
                              channels_enabled: { ...prev.channels_enabled, whatsapp: checked },
                            }))}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Brain className="h-5 w-5" />
                          Istruzioni Personalizzate
                        </CardTitle>
                        <CardDescription>
                          Fornisci istruzioni specifiche per guidare il comportamento dell'AI
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={settings.custom_instructions}
                          onChange={(e) => setSettings(prev => ({ ...prev, custom_instructions: e.target.value }))}
                          placeholder="Es: Non chiamare mai i clienti prima delle 10. Prioritizza i lead caldi."
                          rows={4}
                        />
                      </CardContent>
                    </Card>

                    <div className="flex justify-end">
                      <Button onClick={handleSave} disabled={saveMutation.isPending} size="lg">
                        {saveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Salva Impostazioni
                      </Button>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="activity" className="space-y-4 mt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Select value={severityFilter} onValueChange={(val) => { setSeverityFilter(val); setActivityPage(1); }}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Filtra per tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="success">Successo</SelectItem>
                        <SelectItem value="warning">Avviso</SelectItem>
                        <SelectItem value="error">Errore</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending || unreadCount === 0}
                  >
                    {markAllReadMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Segna tutto come letto
                  </Button>
                </div>

                {loadingActivity ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !activityData?.activities?.length ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nessuna attività trovata</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {activityData.activities.map((item) => (
                      <Card key={item.id} className={`transition-colors ${!item.is_read ? "border-primary/30 bg-primary/5" : ""}`}>
                        <CardContent className="py-4 px-5">
                          <div className="flex items-start gap-4">
                            <div className={`mt-0.5 p-2 rounded-full ${
                              item.severity === "error" ? "bg-red-500/10 text-red-500" :
                              item.severity === "warning" ? "bg-yellow-500/10 text-yellow-500" :
                              item.severity === "success" ? "bg-green-500/10 text-green-500" :
                              "bg-blue-500/10 text-blue-500"
                            }`}>
                              {getActivityIcon(item.icon)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">{item.title}</span>
                                {getSeverityBadge(item.severity)}
                                {!item.is_read && (
                                  <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                                    Nuovo
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {getRelativeTime(item.created_at)}
                                </span>
                                {item.contact_name && (
                                  <span className="flex items-center gap-1">
                                    <Bot className="h-3 w-3" />
                                    {item.contact_name}
                                  </span>
                                )}
                              </div>
                            </div>

                            {!item.is_read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0"
                                onClick={() => markReadMutation.mutate(item.id)}
                                disabled={markReadMutation.isPending}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {activityData && activityData.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActivityPage(p => Math.max(1, p - 1))}
                      disabled={activityPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Precedente
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Pagina {activityData.page} di {activityData.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActivityPage(p => Math.min(activityData.totalPages, p + 1))}
                      disabled={activityPage >= activityData.totalPages}
                    >
                      Successiva
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
