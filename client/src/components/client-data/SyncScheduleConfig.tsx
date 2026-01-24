import { useState, useMemo, useEffect } from "react";
import { format, addDays, setHours, setMinutes, nextDay, setDate } from "date-fns";
import { it } from "date-fns/locale";
import {
  useDatasetSyncSources,
  useDatasetSyncSchedules,
  useCreateSyncSchedule,
  useUpdateSyncSchedule,
  useDeleteSyncSchedule,
  SyncSource,
  SyncSchedule,
} from "@/hooks/useDatasetSync";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Clock,
  Calendar,
  CalendarDays,
  Timer,
  Webhook,
  Save,
  X,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Globe,
  Play,
} from "lucide-react";

type ScheduleType = "webhook_only" | "daily" | "weekly" | "monthly" | "every_x_days";

interface ScheduleFormState {
  scheduleType: ScheduleType;
  time: string;
  dayOfWeek: number;
  dayOfMonth: number;
  intervalDays: number;
  timezone: string;
  isActive: boolean;
}

const COMMON_TIMEZONES = [
  { value: "Europe/Rome", label: "Europa/Roma (CET)" },
  { value: "Europe/London", label: "Europa/Londra (GMT)" },
  { value: "Europe/Paris", label: "Europa/Parigi (CET)" },
  { value: "Europe/Berlin", label: "Europa/Berlino (CET)" },
  { value: "America/New_York", label: "America/New York (EST)" },
  { value: "America/Los_Angeles", label: "America/Los Angeles (PST)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { value: "UTC", label: "UTC" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Domenica" },
  { value: 1, label: "Lunedì" },
  { value: 2, label: "Martedì" },
  { value: 3, label: "Mercoledì" },
  { value: 4, label: "Giovedì" },
  { value: 5, label: "Venerdì" },
  { value: 6, label: "Sabato" },
];

const DEFAULT_FORM_STATE: ScheduleFormState = {
  scheduleType: "webhook_only",
  time: "06:00",
  dayOfWeek: 1,
  dayOfMonth: 1,
  intervalDays: 3,
  timezone: "Europe/Rome",
  isActive: true,
};

function parseScheduleConfig(schedule: SyncSchedule): ScheduleFormState {
  const config = schedule.schedule_config || {};
  return {
    scheduleType: schedule.schedule_type as ScheduleType,
    time: config.time || "06:00",
    dayOfWeek: config.dayOfWeek ?? 1,
    dayOfMonth: config.dayOfMonth ?? 1,
    intervalDays: config.intervalDays ?? 3,
    timezone: schedule.timezone || "Europe/Rome",
    isActive: schedule.is_active,
  };
}

function buildScheduleConfig(form: ScheduleFormState): Record<string, any> {
  switch (form.scheduleType) {
    case "webhook_only":
      return {};
    case "daily":
      return { time: form.time };
    case "weekly":
      return { time: form.time, dayOfWeek: form.dayOfWeek };
    case "monthly":
      return { time: form.time, dayOfMonth: form.dayOfMonth };
    case "every_x_days":
      return { time: form.time, intervalDays: form.intervalDays };
    default:
      return {};
  }
}

export function SyncScheduleConfig() {
  const { toast } = useToast();
  const { data: sourcesData, isLoading: loadingSources } = useDatasetSyncSources();
  const sources = sourcesData?.data || [];

  const [selectedSourceId, setSelectedSourceId] = useState<number | undefined>(undefined);
  const [formState, setFormState] = useState<ScheduleFormState>(DEFAULT_FORM_STATE);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data: schedulesData, isLoading: loadingSchedules } = useDatasetSyncSchedules(selectedSourceId);
  const createMutation = useCreateSyncSchedule();
  const updateMutation = useUpdateSyncSchedule();
  const deleteMutation = useDeleteSyncSchedule();

  const existingSchedule = useMemo(() => {
    if (!schedulesData?.data || schedulesData.data.length === 0) return null;
    return schedulesData.data[0];
  }, [schedulesData]);

  useEffect(() => {
    if (existingSchedule) {
      setFormState(parseScheduleConfig(existingSchedule));
      setIsEditing(true);
    } else {
      setFormState(DEFAULT_FORM_STATE);
      setIsEditing(false);
    }
  }, [existingSchedule]);

  const selectedSource = useMemo(() => {
    return sources.find((s) => s.id === selectedSourceId);
  }, [sources, selectedSourceId]);

  const calculatedNextRun = useMemo(() => {
    if (formState.scheduleType === "webhook_only") return null;

    const now = new Date();
    const [hours, minutes] = formState.time.split(":").map(Number);

    let nextRunDate: Date;

    switch (formState.scheduleType) {
      case "daily": {
        nextRunDate = setMinutes(setHours(now, hours), minutes);
        if (nextRunDate <= now) {
          nextRunDate = addDays(nextRunDate, 1);
        }
        break;
      }
      case "weekly": {
        const targetDay = formState.dayOfWeek as 0 | 1 | 2 | 3 | 4 | 5 | 6;
        nextRunDate = nextDay(now, targetDay);
        nextRunDate = setMinutes(setHours(nextRunDate, hours), minutes);
        if (now.getDay() === targetDay) {
          const todayAtTime = setMinutes(setHours(now, hours), minutes);
          if (todayAtTime > now) {
            nextRunDate = todayAtTime;
          }
        }
        break;
      }
      case "monthly": {
        nextRunDate = setDate(now, formState.dayOfMonth);
        nextRunDate = setMinutes(setHours(nextRunDate, hours), minutes);
        if (nextRunDate <= now) {
          nextRunDate = setDate(addDays(nextRunDate, 32), formState.dayOfMonth);
          nextRunDate = setMinutes(setHours(nextRunDate, hours), minutes);
        }
        break;
      }
      case "every_x_days": {
        nextRunDate = setMinutes(setHours(now, hours), minutes);
        if (nextRunDate <= now) {
          nextRunDate = addDays(nextRunDate, formState.intervalDays);
        }
        break;
      }
      default:
        return null;
    }

    return nextRunDate;
  }, [formState]);

  const handleSourceChange = (value: string) => {
    const id = parseInt(value, 10);
    setSelectedSourceId(isNaN(id) ? undefined : id);
  };

  const handleSave = async () => {
    if (!selectedSourceId) return;

    const scheduleConfig = buildScheduleConfig(formState);

    try {
      if (isEditing && existingSchedule) {
        await updateMutation.mutateAsync({
          id: existingSchedule.id,
          sourceId: selectedSourceId,
          data: {
            scheduleType: formState.scheduleType,
            scheduleConfig,
            timezone: formState.timezone,
            isActive: formState.isActive,
          },
        });
        toast({
          title: "Pianificazione aggiornata",
          description: "La pianificazione è stata salvata con successo",
        });
      } else {
        await createMutation.mutateAsync({
          sourceId: selectedSourceId,
          scheduleType: formState.scheduleType,
          scheduleConfig,
          timezone: formState.timezone,
        });
        toast({
          title: "Pianificazione creata",
          description: "La nuova pianificazione è stata salvata con successo",
        });
        setIsEditing(true);
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare la pianificazione",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!existingSchedule || !selectedSourceId) return;

    try {
      await deleteMutation.mutateAsync({
        id: existingSchedule.id,
        sourceId: selectedSourceId,
      });
      toast({
        title: "Pianificazione eliminata",
        description: "La pianificazione è stata eliminata con successo",
      });
      setFormState(DEFAULT_FORM_STATE);
      setIsEditing(false);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile eliminare la pianificazione",
        variant: "destructive",
      });
    }
    setDeleteConfirmId(null);
  };

  const handleCancel = () => {
    if (existingSchedule) {
      setFormState(parseScheduleConfig(existingSchedule));
    } else {
      setFormState(DEFAULT_FORM_STATE);
    }
  };

  const getScheduleTypeIcon = (type: ScheduleType) => {
    switch (type) {
      case "webhook_only":
        return <Webhook className="h-4 w-4" />;
      case "daily":
        return <Clock className="h-4 w-4" />;
      case "weekly":
        return <Calendar className="h-4 w-4" />;
      case "monthly":
        return <CalendarDays className="h-4 w-4" />;
      case "every_x_days":
        return <Timer className="h-4 w-4" />;
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (loadingSources) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-600" />
          Configurazione Pianificazione
        </h3>
        <p className="text-sm text-muted-foreground">
          Configura la pianificazione automatica per la sincronizzazione dei dati
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seleziona Sorgente</CardTitle>
          <CardDescription>
            Scegli quale sorgente configurare per la sincronizzazione automatica
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedSourceId?.toString() || ""}
            onValueChange={handleSourceChange}
          >
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Seleziona una sorgente" />
            </SelectTrigger>
            <SelectContent>
              {sources.length === 0 ? (
                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                  Nessuna sorgente disponibile
                </div>
              ) : (
                sources.map((source) => (
                  <SelectItem key={source.id} value={source.id.toString()}>
                    <div className="flex items-center gap-2">
                      {source.is_active ? (
                        <CheckCircle className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      )}
                      {source.name}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedSourceId && (
        <>
          {loadingSchedules ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {existingSchedule && (
                <Card className="border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                          {getScheduleTypeIcon(existingSchedule.schedule_type as ScheduleType)}
                        </div>
                        <div>
                          <p className="font-medium">Pianificazione esistente</p>
                          <p className="text-sm text-muted-foreground">
                            {existingSchedule.is_active ? (
                              <span className="text-emerald-600">Attiva</span>
                            ) : (
                              <span className="text-amber-600">Disattivata</span>
                            )}
                            {existingSchedule.next_run_at && (
                              <>
                                {" "}• Prossima esecuzione:{" "}
                                {format(new Date(existingSchedule.next_run_at), "d MMM yyyy 'alle' HH:mm", { locale: it })}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteConfirmId(existingSchedule.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Elimina
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tipo di Pianificazione</CardTitle>
                  <CardDescription>
                    Scegli quando eseguire la sincronizzazione automatica
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <RadioGroup
                    value={formState.scheduleType}
                    onValueChange={(value) =>
                      setFormState((prev) => ({ ...prev, scheduleType: value as ScheduleType }))
                    }
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
                  >
                    <Label
                      htmlFor="webhook_only"
                      className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                        formState.scheduleType === "webhook_only"
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value="webhook_only" id="webhook_only" />
                      <Webhook className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Solo Webhook</p>
                        <p className="text-xs text-muted-foreground">Trigger manuale</p>
                      </div>
                    </Label>

                    <Label
                      htmlFor="daily"
                      className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                        formState.scheduleType === "daily"
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value="daily" id="daily" />
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Giornaliero</p>
                        <p className="text-xs text-muted-foreground">Ogni giorno</p>
                      </div>
                    </Label>

                    <Label
                      htmlFor="weekly"
                      className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                        formState.scheduleType === "weekly"
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value="weekly" id="weekly" />
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Settimanale</p>
                        <p className="text-xs text-muted-foreground">Un giorno a settimana</p>
                      </div>
                    </Label>

                    <Label
                      htmlFor="monthly"
                      className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                        formState.scheduleType === "monthly"
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value="monthly" id="monthly" />
                      <CalendarDays className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Mensile</p>
                        <p className="text-xs text-muted-foreground">Un giorno al mese</p>
                      </div>
                    </Label>

                    <Label
                      htmlFor="every_x_days"
                      className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                        formState.scheduleType === "every_x_days"
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <RadioGroupItem value="every_x_days" id="every_x_days" />
                      <Timer className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Ogni X Giorni</p>
                        <p className="text-xs text-muted-foreground">Intervallo personalizzato</p>
                      </div>
                    </Label>
                  </RadioGroup>

                  {formState.scheduleType !== "webhook_only" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t">
                      <div className="space-y-2">
                        <Label htmlFor="time" className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Orario (HH:MM)
                        </Label>
                        <Input
                          id="time"
                          type="time"
                          value={formState.time}
                          onChange={(e) =>
                            setFormState((prev) => ({ ...prev, time: e.target.value }))
                          }
                          className="max-w-[150px]"
                        />
                      </div>

                      {formState.scheduleType === "weekly" && (
                        <div className="space-y-2">
                          <Label htmlFor="dayOfWeek" className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Giorno della Settimana
                          </Label>
                          <Select
                            value={formState.dayOfWeek.toString()}
                            onValueChange={(value) =>
                              setFormState((prev) => ({ ...prev, dayOfWeek: parseInt(value, 10) }))
                            }
                          >
                            <SelectTrigger className="max-w-[200px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_WEEK.map((day) => (
                                <SelectItem key={day.value} value={day.value.toString()}>
                                  {day.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {formState.scheduleType === "monthly" && (
                        <div className="space-y-2">
                          <Label htmlFor="dayOfMonth" className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            Giorno del Mese
                          </Label>
                          <Select
                            value={formState.dayOfMonth.toString()}
                            onValueChange={(value) =>
                              setFormState((prev) => ({ ...prev, dayOfMonth: parseInt(value, 10) }))
                            }
                          >
                            <SelectTrigger className="max-w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                                <SelectItem key={day} value={day.toString()}>
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {formState.scheduleType === "every_x_days" && (
                        <div className="space-y-2">
                          <Label htmlFor="intervalDays" className="flex items-center gap-2">
                            <Timer className="h-4 w-4" />
                            Ogni X Giorni
                          </Label>
                          <Input
                            id="intervalDays"
                            type="number"
                            min={1}
                            max={365}
                            value={formState.intervalDays}
                            onChange={(e) =>
                              setFormState((prev) => ({
                                ...prev,
                                intervalDays: Math.max(1, parseInt(e.target.value, 10) || 1),
                              }))
                            }
                            className="max-w-[100px]"
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="timezone" className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Fuso Orario
                        </Label>
                        <Select
                          value={formState.timezone}
                          onValueChange={(value) =>
                            setFormState((prev) => ({ ...prev, timezone: value }))
                          }
                        >
                          <SelectTrigger className="max-w-[250px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COMMON_TIMEZONES.map((tz) => (
                              <SelectItem key={tz.value} value={tz.value}>
                                {tz.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="isActive"
                        checked={formState.isActive}
                        onCheckedChange={(checked) =>
                          setFormState((prev) => ({ ...prev, isActive: checked }))
                        }
                      />
                      <Label htmlFor="isActive" className="cursor-pointer">
                        <span className="font-medium">Pianificazione Attiva</span>
                        <p className="text-xs text-muted-foreground">
                          {formState.isActive
                            ? "La sincronizzazione verrà eseguita automaticamente"
                            : "La sincronizzazione è in pausa"}
                        </p>
                      </Label>
                    </div>

                    {formState.isActive && formState.scheduleType !== "webhook_only" && (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Attiva
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {calculatedNextRun && formState.isActive && (
                <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                        <Clock className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-emerald-800 dark:text-emerald-300">
                          Anteprima Prossima Esecuzione
                        </p>
                        <p className="text-sm text-emerald-600 dark:text-emerald-400">
                          Prossima esecuzione: {format(calculatedNextRun, "d MMM yyyy 'alle' HH:mm", { locale: it })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {formState.scheduleType === "webhook_only" && (
                <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/50">
                        <Webhook className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-300">
                          Modalità Solo Webhook
                        </p>
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                          La sincronizzazione verrà eseguita solo quando riceverà una chiamata webhook
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                  <X className="h-4 w-4 mr-2" />
                  Annulla
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {isEditing ? "Aggiorna Pianificazione" : "Salva Pianificazione"}
                </Button>
              </div>
            </>
          )}
        </>
      )}

      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Conferma Eliminazione
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questa pianificazione? La sincronizzazione automatica
              verrà interrotta e dovrai configurarla nuovamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Elimina Pianificazione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
