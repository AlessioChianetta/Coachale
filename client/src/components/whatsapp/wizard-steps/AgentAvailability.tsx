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
  Globe,
  Timer,
  CalendarDays
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface AgentAvailabilityProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
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

export default function AgentAvailability({ formData, onChange, errors }: AgentAvailabilityProps) {

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

      {/* Appointment Availability Settings - Only shown when booking is enabled */}
      {formData.bookingEnabled && (
        <Card className="border-2 border-green-500/20 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-500/5 to-green-500/10">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-green-500" />
              Configurazione Appuntamenti
            </CardTitle>
            <CardDescription>
              Configura la disponibilità del calendario per le prenotazioni
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Timezone */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Fuso Orario
              </Label>
              <Select
                value={formData.availabilityTimezone || "Europe/Rome"}
                onValueChange={(value) => onChange("availabilityTimezone", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleziona fuso orario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Europe/Rome">Europa/Roma (CET)</SelectItem>
                  <SelectItem value="Europe/London">Europa/Londra (GMT)</SelectItem>
                  <SelectItem value="Europe/Paris">Europa/Parigi (CET)</SelectItem>
                  <SelectItem value="Europe/Berlin">Europa/Berlino (CET)</SelectItem>
                  <SelectItem value="Europe/Madrid">Europa/Madrid (CET)</SelectItem>
                  <SelectItem value="Europe/Zurich">Europa/Zurigo (CET)</SelectItem>
                  <SelectItem value="America/New_York">America/New York (EST)</SelectItem>
                  <SelectItem value="America/Los_Angeles">America/Los Angeles (PST)</SelectItem>
                  <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Appointment Duration & Buffers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  Durata Appuntamento
                </Label>
                <Select
                  value={String(formData.availabilityAppointmentDuration || 60)}
                  onValueChange={(value) => onChange("availabilityAppointmentDuration", parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minuti</SelectItem>
                    <SelectItem value="30">30 minuti</SelectItem>
                    <SelectItem value="45">45 minuti</SelectItem>
                    <SelectItem value="60">1 ora</SelectItem>
                    <SelectItem value="90">1 ora 30 min</SelectItem>
                    <SelectItem value="120">2 ore</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-2 block">Buffer Prima</Label>
                <Select
                  value={String(formData.availabilityBufferBefore || 15)}
                  onValueChange={(value) => onChange("availabilityBufferBefore", parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Nessuno</SelectItem>
                    <SelectItem value="5">5 minuti</SelectItem>
                    <SelectItem value="10">10 minuti</SelectItem>
                    <SelectItem value="15">15 minuti</SelectItem>
                    <SelectItem value="30">30 minuti</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Tempo prima dell'appuntamento</p>
              </div>

              <div>
                <Label className="mb-2 block">Buffer Dopo</Label>
                <Select
                  value={String(formData.availabilityBufferAfter || 15)}
                  onValueChange={(value) => onChange("availabilityBufferAfter", parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Nessuno</SelectItem>
                    <SelectItem value="5">5 minuti</SelectItem>
                    <SelectItem value="10">10 minuti</SelectItem>
                    <SelectItem value="15">15 minuti</SelectItem>
                    <SelectItem value="30">30 minuti</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Tempo dopo l'appuntamento</p>
              </div>
            </div>

            {/* Booking Constraints */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Preavviso Minimo</Label>
                <Select
                  value={String(formData.availabilityMinHoursNotice || 24)}
                  onValueChange={(value) => onChange("availabilityMinHoursNotice", parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 ora</SelectItem>
                    <SelectItem value="2">2 ore</SelectItem>
                    <SelectItem value="4">4 ore</SelectItem>
                    <SelectItem value="12">12 ore</SelectItem>
                    <SelectItem value="24">24 ore (1 giorno)</SelectItem>
                    <SelectItem value="48">48 ore (2 giorni)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Quanto anticipo serve per prenotare</p>
              </div>

              <div>
                <Label className="mb-2 block">Prenotazione Massima</Label>
                <Select
                  value={String(formData.availabilityMaxDaysAhead || 30)}
                  onValueChange={(value) => onChange("availabilityMaxDaysAhead", parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">1 settimana</SelectItem>
                    <SelectItem value="14">2 settimane</SelectItem>
                    <SelectItem value="30">1 mese</SelectItem>
                    <SelectItem value="60">2 mesi</SelectItem>
                    <SelectItem value="90">3 mesi</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Quanto avanti si può prenotare</p>
              </div>
            </div>

            {/* Working Hours per Day */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Orari Disponibilità per Giorno
              </Label>
              <div className="space-y-3">
                {daysOfWeek.map((day) => {
                  const workingHours = formData.availabilityWorkingHours || {};
                  const dayConfig = workingHours[day.id] || { enabled: day.id !== 'saturday' && day.id !== 'sunday', start: "09:00", end: "18:00" };
                  
                  return (
                    <div key={day.id} className={cn(
                      "flex items-center gap-4 p-3 rounded-lg border transition-all",
                      dayConfig.enabled ? "bg-green-500/5 border-green-500/20" : "bg-muted/30 border-muted"
                    )}>
                      <Checkbox
                        checked={dayConfig.enabled}
                        onCheckedChange={(checked) => {
                          const newWorkingHours = {
                            ...workingHours,
                            [day.id]: { ...dayConfig, enabled: checked as boolean }
                          };
                          onChange("availabilityWorkingHours", newWorkingHours);
                        }}
                      />
                      <span className="w-24 font-medium text-sm">{day.label}</span>
                      {dayConfig.enabled && (
                        <>
                          <Input
                            type="time"
                            value={dayConfig.start}
                            onChange={(e) => {
                              const newWorkingHours = {
                                ...workingHours,
                                [day.id]: { ...dayConfig, start: e.target.value }
                              };
                              onChange("availabilityWorkingHours", newWorkingHours);
                            }}
                            className="w-28"
                          />
                          <span className="text-muted-foreground">-</span>
                          <Input
                            type="time"
                            value={dayConfig.end}
                            onChange={(e) => {
                              const newWorkingHours = {
                                ...workingHours,
                                [day.id]: { ...dayConfig, end: e.target.value }
                              };
                              onChange("availabilityWorkingHours", newWorkingHours);
                            }}
                            className="w-28"
                          />
                        </>
                      )}
                      {!dayConfig.enabled && (
                        <span className="text-sm text-muted-foreground italic">Non disponibile</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Alert className="border-green-500/30 bg-green-500/5">
              <CalendarDays className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Queste impostazioni definiscono quando il cliente può prenotare un appuntamento tramite questo agente.
                Assicurati di collegare un calendario Google nelle impostazioni dell'agente.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

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
