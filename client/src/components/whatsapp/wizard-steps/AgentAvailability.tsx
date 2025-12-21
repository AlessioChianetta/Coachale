import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  Calendar, 
  MessageSquare, 
  Zap,
  BookOpen,
  Shield,
  TrendingUp,
  AlertCircle,
  Volume2,
  CalendarCheck,
  Link,
  Unlink,
  Loader2,
  ExternalLink,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface AgentAvailabilityProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
  agentId?: string | null;
}

const daysOfWeek = [
  { id: "monday", label: "Lunedì" },
  { id: "tuesday", label: "Martedì" },
  { id: "wednesday", label: "Mercoledì" },
  { id: "thursday", label: "Giovedì" },
  { id: "friday", label: "Venerdì" },
  { id: "saturday", label: "Sabato" },
  { id: "sunday", label: "Domenica" },
];

const featureBlocks = [
  {
    id: "bookingEnabled",
    label: "Prenotazione Appuntamenti",
    description: "Gestisce la presa appuntamento e integrazione calendario",
    icon: BookOpen,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  {
    id: "objectionHandlingEnabled",
    label: "Gestione Obiezioni",
    description: "Risponde alle obiezioni con tecniche di vendita avanzate",
    icon: Shield,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
  },
  {
    id: "disqualificationEnabled",
    label: "Disqualificazione Lead",
    description: "Filtra automaticamente i lead non qualificati",
    icon: AlertCircle,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
  },
  {
    id: "upsellingEnabled",
    label: "Upselling",
    description: "Propone servizi premium e upgrade durante la conversazione",
    icon: TrendingUp,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
  },
  {
    id: "ttsEnabled",
    label: "Risposte Audio (TTS)",
    description: "L'agente risponde con audio + testo per maggiore accessibilità",
    icon: Volume2,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/20",
  },
];

export default function AgentAvailability({ formData, onChange, errors, agentId }: AgentAvailabilityProps) {
  const { toast } = useToast();
  const [calendarStatus, setCalendarStatus] = useState<{
    connected: boolean;
    email?: string;
    connectedAt?: string;
  }>({ connected: false });
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Fetch calendar status when agentId is available
  useEffect(() => {
    if (agentId) {
      fetchCalendarStatus();
    }
  }, [agentId]);

  const fetchCalendarStatus = async () => {
    if (!agentId) return;
    
    setIsLoadingCalendar(true);
    try {
      const response = await fetch(`/api/whatsapp/agents/${agentId}/calendar/status`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setCalendarStatus(data);
      }
    } catch (error) {
      console.error('Error fetching calendar status:', error);
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const handleConnectCalendar = async () => {
    if (!agentId) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: "Salva prima l'agente per poter collegare il calendario"
      });
      return;
    }

    setIsConnecting(true);
    try {
      const response = await fetch(`/api/whatsapp/agents/${agentId}/calendar/oauth/start`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Errore durante la connessione');
      }
      
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile avviare la connessione al calendario"
      });
      setIsConnecting(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!agentId) return;

    setIsDisconnecting(true);
    try {
      const response = await fetch(`/api/whatsapp/agents/${agentId}/calendar/disconnect`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Errore durante la disconnessione');
      }
      
      setCalendarStatus({ connected: false });
      toast({
        title: "Calendario Scollegato",
        description: "Il calendario Google è stato scollegato da questo agente"
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Errore",
        description: error.message || "Impossibile scollegare il calendario"
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleDayToggle = (dayId: string, checked: boolean) => {
    const currentDays = formData.workingDays || [];
    const newDays = checked
      ? [...currentDays, dayId]
      : currentDays.filter((d: string) => d !== dayId);
    onChange("workingDays", newDays);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" />
          Disponibilità & Automazioni
        </h2>
        <p className="text-muted-foreground">
          Configura gli orari di lavoro e le funzionalità avanzate
        </p>
      </div>

      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Orari di Lavoro
              </CardTitle>
              <CardDescription>Definisci quando l'agente è disponibile</CardDescription>
            </div>
            <Switch
              checked={formData.workingHoursEnabled}
              onCheckedChange={(checked) => onChange("workingHoursEnabled", checked)}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {formData.workingHoursEnabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="workingHoursStart">
                    Orario Inizio <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="workingHoursStart"
                    type="time"
                    value={formData.workingHoursStart}
                    onChange={(e) => onChange("workingHoursStart", e.target.value)}
                    className={cn(
                      "mt-2",
                      errors.workingHoursStart && "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {errors.workingHoursStart && (
                    <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.workingHoursStart}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="workingHoursEnd">
                    Orario Fine <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="workingHoursEnd"
                    type="time"
                    value={formData.workingHoursEnd}
                    onChange={(e) => onChange("workingHoursEnd", e.target.value)}
                    className={cn(
                      "mt-2",
                      errors.workingHoursEnd && "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {errors.workingHoursEnd && (
                    <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.workingHoursEnd}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label className="mb-3 block">
                  Giorni Lavorativi <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {daysOfWeek.map((day) => (
                    <label
                      key={day.id}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50",
                        formData.workingDays?.includes(day.id)
                          ? "bg-primary/10 border-primary"
                          : "bg-card border-muted"
                      )}
                    >
                      <Checkbox
                        checked={formData.workingDays?.includes(day.id)}
                        onCheckedChange={(checked) => handleDayToggle(day.id, checked as boolean)}
                      />
                      <span className="text-sm font-medium">{day.label}</span>
                    </label>
                  ))}
                </div>
                {errors.workingDays && (
                  <p className="text-sm text-destructive mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.workingDays}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="afterHoursMessage">Messaggio Fuori Orario</Label>
                <Textarea
                  id="afterHoursMessage"
                  value={formData.afterHoursMessage}
                  onChange={(e) => onChange("afterHoursMessage", e.target.value)}
                  placeholder="Ciao! Ti risponderò durante i miei orari di lavoro."
                  rows={3}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Messaggio inviato automaticamente fuori dagli orari di lavoro
                </p>
              </div>
            </>
          )}

          {!formData.workingHoursEnabled && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                L'agente sarà disponibile 24/7. Attiva gli orari di lavoro per limitare le risposte a specifici giorni e orari.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Google Calendar Integration Section */}
      <Card className="border-2 border-green-500/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-green-500/5 to-green-500/10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-green-500" />
                Calendario Appuntamenti
              </CardTitle>
              <CardDescription>
                Collega un calendario Google dedicato a questo agente per gestire gli appuntamenti
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {isLoadingCalendar ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Caricamento stato calendario...</span>
            </div>
          ) : calendarStatus.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <div className="flex-1">
                  <p className="font-semibold text-green-700 dark:text-green-300">
                    Calendario Collegato
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {calendarStatus.email}
                  </p>
                  {calendarStatus.connectedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Collegato il {new Date(calendarStatus.connectedAt).toLocaleDateString('it-IT')}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnectCalendar}
                  disabled={isDisconnecting}
                  className="text-destructive hover:text-destructive"
                >
                  {isDisconnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Unlink className="h-4 w-4 mr-2" />
                      Scollega
                    </>
                  )}
                </Button>
              </div>
              <Alert className="border-green-500/30 bg-green-500/5">
                <CalendarCheck className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  Gli appuntamenti di questo agente verranno creati sul calendario Google collegato ({calendarStatus.email}).
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-4">
              {!agentId ? (
                <Alert className="border-orange-500/30 bg-orange-500/5">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <AlertDescription>
                    Salva l'agente per poter collegare un calendario Google dedicato.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-muted">
                    <Calendar className="h-6 w-6 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">
                        Nessun Calendario Collegato
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Collega un account Google per creare appuntamenti sul calendario di questo agente
                      </p>
                    </div>
                    <Button
                      onClick={handleConnectCalendar}
                      disabled={isConnecting}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      {isConnecting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Link className="h-4 w-4 mr-2" />
                      )}
                      Collega Google Calendar
                    </Button>
                  </div>
                  <Alert>
                    <ExternalLink className="h-4 w-4" />
                    <AlertDescription>
                      Cliccando su "Collega Google Calendar" verrai reindirizzato a Google per autorizzare l'accesso al calendario.
                      Gli appuntamenti saranno creati su questo calendario invece che su quello del consulente.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-blue-500/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500/5 to-blue-500/10">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            Funzionalità Avanzate
          </CardTitle>
          <CardDescription>Attiva le automazioni per il tuo agente</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featureBlocks.map((feature) => {
              const Icon = feature.icon;
              // REGOLA SPECIALE: bookingEnabled è disabilitato per agenti informativi
              const isBookingDisabledForInformative = 
                feature.id === "bookingEnabled" && 
                formData.agentType === "informative_advisor";
              
              const isTTSFeature = feature.id === "ttsEnabled";
              
              return (
                <div
                  key={feature.id}
                  className={cn(
                    "relative rounded-lg border-2 p-4 transition-all hover:shadow-md",
                    formData[feature.id]
                      ? `${feature.bgColor} ${feature.borderColor} shadow-sm`
                      : "border-muted bg-card",
                    isBookingDisabledForInformative && "opacity-60",
                    isTTSFeature && formData.ttsEnabled && "md:col-span-2"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg", formData[feature.id] ? feature.bgColor : "bg-muted")}>
                      <Icon className={cn("h-5 w-5", formData[feature.id] ? feature.color : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor={feature.id}
                          className="text-sm font-semibold cursor-pointer"
                        >
                          {feature.label}
                        </Label>
                        <Switch
                          id={feature.id}
                          checked={formData[feature.id]}
                          onCheckedChange={(checked) => onChange(feature.id, checked)}
                          disabled={isBookingDisabledForInformative}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {feature.description}
                      </p>
                      {isBookingDisabledForInformative && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          Disabilitato per agenti di tipo "Consulente Educativo"
                        </p>
                      )}

                      {/* Audio Response Mode Selection - Only for TTS when enabled */}
                      {isTTSFeature && formData.ttsEnabled && (
                        <div className="mt-4 pt-4 border-t border-indigo-500/20 space-y-3">
                          <Label className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                            Modalità Risposta Audio
                          </Label>
                          <RadioGroup
                            value={formData.audioResponseMode || "mirror"}
                            onValueChange={(value) => onChange("audioResponseMode", value)}
                            className="space-y-2"
                          >
                            <div className="flex items-start space-x-3 p-3 rounded-md hover:bg-indigo-500/10 transition-colors border border-transparent hover:border-indigo-500/30">
                              <RadioGroupItem value="mirror" id="audio-mirror" className="mt-0.5" />
                              <div className="space-y-1 flex-1">
                                <Label htmlFor="audio-mirror" className="text-sm font-medium cursor-pointer">
                                  📱 Come il Cliente (Consigliato)
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Audio → Audio, Testo → Testo. Rispetta le preferenze del cliente.
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start space-x-3 p-3 rounded-md hover:bg-indigo-500/10 transition-colors border border-transparent hover:border-indigo-500/30">
                              <RadioGroupItem value="always_audio" id="audio-always-audio" className="mt-0.5" />
                              <div className="space-y-1 flex-1">
                                <Label htmlFor="audio-always-audio" className="text-sm font-medium cursor-pointer">
                                  🎙️ Sempre Audio
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Risponde sempre con voce, anche ai messaggi testuali.
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start space-x-3 p-3 rounded-md hover:bg-indigo-500/10 transition-colors border border-transparent hover:border-indigo-500/30">
                              <RadioGroupItem value="always_both" id="audio-always-both" className="mt-0.5" />
                              <div className="space-y-1 flex-1">
                                <Label htmlFor="audio-always-both" className="text-sm font-medium cursor-pointer">
                                  🎯 Sempre Entrambi
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Invia sia testo che audio insieme. Massima accessibilità.
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start space-x-3 p-3 rounded-md hover:bg-indigo-500/10 transition-colors border border-transparent hover:border-indigo-500/30">
                              <RadioGroupItem value="always_text" id="audio-always-text" className="mt-0.5" />
                              <div className="space-y-1 flex-1">
                                <Label htmlFor="audio-always-text" className="text-sm font-medium cursor-pointer">
                                  📝 Sempre Testo
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Risponde sempre in testo scritto. Nessun audio generato.
                                </p>
                              </div>
                            </div>
                          </RadioGroup>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Alert className="border-blue-500/50 bg-blue-500/5">
        <MessageSquare className="h-4 w-4 text-blue-500" />
        <AlertDescription>
          Le funzionalità attivate influenzeranno il comportamento dell'agente durante le conversazioni.
          Puoi modificarle in qualsiasi momento.
        </AlertDescription>
      </Alert>
    </div>
  );
}
