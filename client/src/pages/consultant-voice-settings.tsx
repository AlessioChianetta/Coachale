import { useState } from "react";
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

  const queryClient = useQueryClient();
  const { toast } = useToast();

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

            <Tabs defaultValue="numbers" className="w-full">
              <TabsList>
                <TabsTrigger value="numbers" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Numeri
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Anti-Abuso
                </TabsTrigger>
              </TabsList>

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
