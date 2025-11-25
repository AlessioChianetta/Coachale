import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  Clock,
  Bot,
  CalendarDays,
  MessageSquare,
  Info,
  ChevronDown
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";

// AI Availability Schema
const aiAvailabilitySchema = z.object({
  enabled: z.boolean(),
  workingDays: z.object({
    monday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }).optional(),
    tuesday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }).optional(),
    wednesday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }).optional(),
    thursday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }).optional(),
    friday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }).optional(),
    saturday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }).optional(),
    sunday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }).optional(),
  }),
});

// Appointment Availability Schema
const appointmentAvailabilitySchema = z.object({
  enabled: z.boolean(),
  workingDays: z.object({
    monday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }).optional(),
    tuesday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }).optional(),
    wednesday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }).optional(),
    thursday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }).optional(),
    friday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }).optional(),
    saturday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }).optional(),
    sunday: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }).optional(),
  }),
  morningSlot: z.object({ start: z.string(), end: z.string() }).optional(),
  afternoonSlot: z.object({ start: z.string(), end: z.string() }).optional(),
  appointmentDuration: z.coerce.number().min(15).max(240),
  bufferBefore: z.coerce.number().min(0).max(120),
  bufferAfter: z.coerce.number().min(0).max(120),
  maxDaysInAdvance: z.coerce.number().min(1).max(365),
  minNoticeHours: z.coerce.number().min(1).max(168),
});

type AIAvailabilityFormData = z.infer<typeof aiAvailabilitySchema>;
type AppointmentAvailabilityFormData = z.infer<typeof appointmentAvailabilitySchema>;

const WEEKDAYS = [
  { value: "monday", label: "Lunedì" },
  { value: "tuesday", label: "Martedì" },
  { value: "wednesday", label: "Mercoledì" },
  { value: "thursday", label: "Giovedì" },
  { value: "friday", label: "Venerdì" },
  { value: "saturday", label: "Sabato" },
  { value: "sunday", label: "Domenica" },
];

export default function ConsultantCalendarSettingsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // AI Availability Form
  const aiForm = useForm<AIAvailabilityFormData>({
    resolver: zodResolver(aiAvailabilitySchema),
    defaultValues: {
      enabled: true,
      workingDays: {
        monday: { enabled: true, start: "09:00", end: "18:00" },
        tuesday: { enabled: true, start: "09:00", end: "18:00" },
        wednesday: { enabled: true, start: "09:00", end: "18:00" },
        thursday: { enabled: true, start: "09:00", end: "18:00" },
        friday: { enabled: true, start: "09:00", end: "18:00" },
        saturday: { enabled: false, start: "09:00", end: "18:00" },
        sunday: { enabled: false, start: "09:00", end: "18:00" },
      },
    },
  });

  // Appointment Availability Form
  const appointmentForm = useForm<AppointmentAvailabilityFormData>({
    resolver: zodResolver(appointmentAvailabilitySchema),
    defaultValues: {
      enabled: true,
      workingDays: {
        monday: { enabled: true, start: "09:00", end: "18:00" },
        tuesday: { enabled: true, start: "09:00", end: "18:00" },
        wednesday: { enabled: true, start: "09:00", end: "18:00" },
        thursday: { enabled: true, start: "09:00", end: "18:00" },
        friday: { enabled: true, start: "09:00", end: "18:00" },
        saturday: { enabled: false, start: "09:00", end: "18:00" },
        sunday: { enabled: false, start: "09:00", end: "18:00" },
      },
      morningSlot: { start: "09:00", end: "13:00" },
      afternoonSlot: { start: "14:00", end: "18:00" },
      appointmentDuration: 60,
      bufferBefore: 15,
      bufferAfter: 15,
      maxDaysInAdvance: 30,
      minNoticeHours: 24,
    },
  });

  // Load existing calendar config
  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ["/api/calendar-settings"],
    queryFn: async () => {
      const response = await fetch("/api/calendar-settings", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch calendar settings");
      }
      const data = await response.json();
      return data;
    },
  });

  useEffect(() => {
    if (existingConfig) {
      // Update AI Availability form
      if (existingConfig.aiAvailability) {
        aiForm.reset(existingConfig.aiAvailability);
      }

      // Update Appointment Availability form
      if (existingConfig.appointmentAvailability) {
        appointmentForm.reset(existingConfig.appointmentAvailability);
      }
    }
  }, [existingConfig]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { aiAvailability: AIAvailabilityFormData; appointmentAvailability: AppointmentAvailabilityFormData }) => {
      console.log('🚀 Submitting calendar settings:', data);

      const response = await fetch("/api/calendar-settings", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save calendar settings");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-settings"] });
      toast({
        title: "✅ Impostazioni salvate",
        description: "Le configurazioni di disponibilità sono state salvate correttamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveAll = async () => {
    // Validate both forms before saving
    const aiValid = await aiForm.trigger();
    const appointmentValid = await appointmentForm.trigger();

    if (!aiValid || !appointmentValid) {
      toast({
        title: "❌ Errore di validazione",
        description: "Controlla i campi evidenziati in rosso",
        variant: "destructive",
      });
      return;
    }

    // Get validated data - Zod schema will coerce strings to numbers
    const aiData = aiForm.getValues();
    const appointmentData = appointmentForm.getValues();

    console.log('📋 AI Availability Data (validated):', aiData);
    console.log('📋 Appointment Availability Data (validated):', appointmentData);

    saveMutation.mutate({
      aiAvailability: aiData,
      appointmentAvailability: appointmentData,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex">
          <Sidebar
            role="consultant"
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <main className="flex-1 p-8">
            <div className="flex items-center justify-center h-[60vh]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex">
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <CalendarDays className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Configurazione Disponibilità
                </h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Gestisci separatamente la disponibilità dell'AI e degli appuntamenti
              </p>
            </div>

            <div className="space-y-8">
              {/* Two Column Grid for AI Availability and Appointment Availability */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* CARD 1: AI Availability */}
                <Card className="border-l-4 border-l-green-500">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <Bot className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <CardTitle>Disponibilità Assistente AI</CardTitle>
                      <CardDescription>
                        Quando l'AI risponde automaticamente ai messaggi WhatsApp
                      </CardDescription>
                    </div>
                    <Badge variant={aiForm.watch("enabled") ? "default" : "secondary"} className={aiForm.watch("enabled") ? "bg-green-500" : ""}>
                      {aiForm.watch("enabled") ? "Attivo" : "Disattivo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Form {...aiForm}>
                    {/* Enable/Disable AI */}
                    <FormField
                      control={aiForm.control}
                      name="enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-green-50/50 dark:bg-green-950/20">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Abilita Assistente AI</FormLabel>
                            <FormDescription>
                              L'AI risponderà ai messaggi durante gli orari configurati
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Working Days for AI */}
                    <FormField
                      control={aiForm.control}
                      name="workingDays"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel className="text-base">Giorni di Disponibilità AI</FormLabel>
                            <FormDescription>
                              Seleziona i giorni in cui l'AI è attiva
                            </FormDescription>
                          </div>
                          <div className="space-y-3">
                            {WEEKDAYS.map((day) => {
                              const dayData = aiForm.watch(`workingDays.${day.value as keyof typeof aiForm.watch.workingDays}`);
                              return (
                                <div key={day.value} className="flex items-center gap-4 p-3 border rounded-lg">
                                  <FormField
                                    control={aiForm.control}
                                    name={`workingDays.${day.value}.enabled` as any}
                                    render={({ field }) => (
                                      <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                          />
                                        </FormControl>
                                        <FormLabel className="font-medium min-w-[100px]">
                                          {day.label}
                                        </FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                  {dayData?.enabled && (
                                    <div className="flex items-center gap-2">
                                      <FormField
                                        control={aiForm.control}
                                        name={`workingDays.${day.value}.start` as any}
                                        render={({ field }) => (
                                          <Input type="time" {...field} className="w-32" />
                                        )}
                                      />
                                      <span>-</span>
                                      <FormField
                                        control={aiForm.control}
                                        name={`workingDays.${day.value}.end` as any}
                                        render={({ field }) => (
                                          <Input type="time" {...field} className="w-32" />
                                        )}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </FormItem>
                      )}
                    />
                  </Form>
                </CardContent>
              </Card>

              {/* CARD 2: Appointment Availability */}
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <CardTitle>Disponibilità Appuntamenti</CardTitle>
                      <CardDescription>
                        Quando i clienti possono prenotare sessioni e consultazioni
                      </CardDescription>
                    </div>
                    <Badge variant={appointmentForm.watch("enabled") ? "default" : "secondary"} className={appointmentForm.watch("enabled") ? "bg-blue-500" : ""}>
                      {appointmentForm.watch("enabled") ? "Attivo" : "Disattivo"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Form {...appointmentForm}>
                    {/* Enable/Disable Appointments */}
                    <FormField
                      control={appointmentForm.control}
                      name="enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-blue-50/50 dark:bg-blue-950/20">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Abilita Prenotazioni</FormLabel>
                            <FormDescription>
                              I clienti possono prenotare appuntamenti durante gli orari configurati
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* Working Days for Appointments */}
                    <FormField
                      control={appointmentForm.control}
                      name="workingDays"
                      render={() => (
                        <FormItem>
                          <div className="mb-4">
                            <FormLabel className="text-base">Giorni Disponibili per Appuntamenti</FormLabel>
                            <FormDescription>
                              Seleziona i giorni in cui puoi ricevere prenotazioni
                            </FormDescription>
                          </div>
                          <div className="space-y-3">
                            {WEEKDAYS.map((day) => {
                              const dayData = appointmentForm.watch(`workingDays.${day.value as keyof typeof appointmentForm.watch.workingDays}`);
                              return (
                                <div key={day.value} className="flex items-center gap-4 p-3 border rounded-lg">
                                  <FormField
                                    control={appointmentForm.control}
                                    name={`workingDays.${day.value}.enabled` as any}
                                    render={({ field }) => (
                                      <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                          />
                                        </FormControl>
                                        <FormLabel className="font-medium min-w-[100px]">
                                          {day.label}
                                        </FormLabel>
                                      </FormItem>
                                    )}
                                  />
                                  {dayData?.enabled && (
                                    <div className="flex items-center gap-2">
                                      <FormField
                                        control={appointmentForm.control}
                                        name={`workingDays.${day.value}.start` as any}
                                        render={({ field }) => (
                                          <Input type="time" {...field} className="w-32" />
                                        )}
                                      />
                                      <span>-</span>
                                      <FormField
                                        control={appointmentForm.control}
                                        name={`workingDays.${day.value}.end` as any}
                                        render={({ field }) => (
                                          <Input type="time" {...field} className="w-32" />
                                        )}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </FormItem>
                      )}
                    />

                    {/* Appointment Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-blue-50/30 dark:bg-blue-950/10">
                      <FormField
                        control={appointmentForm.control}
                        name="appointmentDuration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Durata Appuntamento (minuti)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 60)}
                              />
                            </FormControl>
                            <FormDescription>Durata standard di ogni appuntamento</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={appointmentForm.control}
                        name="bufferBefore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Buffer Prima (minuti)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormDescription>Tempo di preparazione</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={appointmentForm.control}
                        name="bufferAfter"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Buffer Dopo (minuti)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormDescription>Tempo di conclusione</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={appointmentForm.control}
                        name="maxDaysInAdvance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Giorni Massimi Anticipo</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                              />
                            </FormControl>
                            <FormDescription>Quanto in anticipo si può prenotare</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={appointmentForm.control}
                        name="minNoticeHours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Preavviso Minimo (ore)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 24)}
                              />
                            </FormControl>
                            <FormDescription>Ore minime di preavviso</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Form>
                </CardContent>
              </Card>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveAll}
                  disabled={saveMutation.isPending}
                  className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  size="lg"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Salva Tutte le Configurazioni
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <ConsultantAIAssistant />
    </div>
  );
}