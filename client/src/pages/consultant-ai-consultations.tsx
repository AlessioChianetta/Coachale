
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Calendar, Clock, Plus, Edit, Trash2, User, CheckCircle, XCircle, CalendarDays, Sparkles, Video } from "lucide-react";
import { format } from "date-fns";
import it from "date-fns/locale/it";
import { Switch } from "@/components/ui/switch";

const consultationSchema = z.object({
  clientId: z.string().min(1, "Seleziona un cliente"),
  scheduledFor: z.coerce.date(),
  maxDurationMinutes: z.coerce.number().min(30, "Durata minima 30 minuti").max(180, "Durata massima 3 ore"),
  isTestMode: z.boolean().default(false),
});

type ConsultationForm = z.infer<typeof consultationSchema>;

export default function ConsultantAIConsultations() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Query per ottenere clienti
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients", "active"],
    queryFn: async () => {
      const response = await fetch("/api/clients?activeOnly=true", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  // Query per ottenere consulenze AI
  const { data: consultations = [], isLoading } = useQuery({
    queryKey: ["/api/consultations/ai/all"],
    queryFn: async () => {
      const response = await fetch("/api/consultations/ai/all", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch consultations");
      return response.json();
    },
  });

  const createForm = useForm<ConsultationForm>({
    resolver: zodResolver(consultationSchema),
    defaultValues: {
      clientId: "",
      maxDurationMinutes: 90,
      isTestMode: false,
      scheduledFor: new Date(),
    },
  });

  // Mutation per creare consulenza
  const createMutation = useMutation({
    mutationFn: async (data: ConsultationForm) => {
      return apiRequest("POST", "/api/consultations/ai/create", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultations/ai/all"] });
      toast({
        title: "✅ Consulenza AI Creata!",
        description: "Il cliente potrà accedere alla consulenza negli orari programmati",
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore",
        description: error.message || "Errore nella creazione della consulenza",
        variant: "destructive",
      });
    },
  });

  // Mutation per eliminare consulenza
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/consultations/ai/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultations/ai/all"] });
      toast({
        title: "🗑️ Consulenza Eliminata",
        description: "La consulenza è stata rimossa con successo",
      });
    },
  });

  const onSubmit = (data: ConsultationForm) => {
    createMutation.mutate(data);
  };

  const handleDelete = (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questa consulenza AI?")) {
      deleteMutation.mutate(id);
    }
  };

  const getStatusBadge = (consultation: any) => {
    // 🟢 PRIORITY: Se sessione è attiva (Live Mode in corso), mostra badge "In Corso" con priorità massima
    if (consultation.isActive === true) {
      return (
        <Badge className="bg-green-500 text-white animate-pulse shadow-lg">
          <Video className="w-3 h-3 mr-1" />
          🟢 In Corso
        </Badge>
      );
    }

    // Altrimenti usa la logica esistente basata sullo status
    const config = {
      scheduled: { label: "Programmata", icon: CalendarDays, color: "bg-blue-100 text-blue-700" },
      in_progress: { label: "In Corso", icon: Video, color: "bg-green-100 text-green-700" },
      completed: { label: "Completata", icon: CheckCircle, color: "bg-gray-100 text-gray-700" },
      cancelled: { label: "Cancellata", icon: XCircle, color: "bg-red-100 text-red-700" },
    };
    const statusConfig = config[consultation.status as keyof typeof config] || config.scheduled;
    const IconComponent = statusConfig.icon;
    return (
      <Badge className={statusConfig.color}>
        <IconComponent className="w-3 h-3 mr-1" />
        {statusConfig.label}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-100">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 p-8 overflow-y-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl shadow-lg">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent">
                      Consulenze AI Settimanali
                    </h1>
                    <p className="text-slate-600 text-lg">Gestisci le sessioni vocali AI programmate per i tuoi clienti</p>
                  </div>
                </div>
              </div>

              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-xl rounded-2xl px-8 py-4"
                  >
                    <Plus className="w-6 h-6 mr-3" />
                    <span className="font-semibold text-lg">Nuova Consulenza AI</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                      <Sparkles className="w-6 h-6 text-purple-600" />
                      Crea Consulenza AI
                    </DialogTitle>
                  </DialogHeader>

                  <Form {...createForm}>
                    <form onSubmit={createForm.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={createForm.control}
                        name="clientId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold flex items-center gap-2">
                              <User className="w-4 h-4" />
                              Cliente
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 rounded-xl">
                                  <SelectValue placeholder="Seleziona un cliente" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(clients as any[]).map((client: any) => (
                                  <SelectItem key={client.id} value={client.id}>
                                    {client.firstName} {client.lastName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={createForm.control}
                        name="scheduledFor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold flex items-center gap-2">
                              <Calendar className="w-4 h-4" />
                              Data e Ora
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="datetime-local"
                                className="h-12 rounded-xl"
                                {...field}
                                value={field.value ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ""}
                                onChange={(e) => field.onChange(new Date(e.target.value))}
                              />
                            </FormControl>
                            <p className="text-sm text-slate-500">
                              💡 Consiglio: martedì ore 15:00 per consulenze settimanali
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={createForm.control}
                        name="maxDurationMinutes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              Durata Massima (minuti)
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                className="h-12 rounded-xl"
                                {...field}
                              />
                            </FormControl>
                            <p className="text-sm text-slate-500">
                              Default: 90 minuti (1.5 ore)
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={createForm.control}
                        name="isTestMode"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base font-semibold">
                                🧪 Modalità Test
                              </FormLabel>
                              <p className="text-sm text-slate-500">
                                Accessibile sempre (non solo all'orario programmato)
                              </p>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end gap-4 pt-6">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateDialogOpen(false)}
                        >
                          Annulla
                        </Button>
                        <Button
                          type="submit"
                          disabled={createMutation.isPending}
                          className="bg-gradient-to-r from-purple-600 to-indigo-600"
                        >
                          {createMutation.isPending ? "Creazione..." : "Crea Consulenza"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Lista Consulenze */}
          {isLoading ? (
            <Card>
              <CardContent className="p-16 text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Caricamento consulenze...</p>
              </CardContent>
            </Card>
          ) : consultations.length === 0 ? (
            <Card>
              <CardContent className="p-16 text-center">
                <Sparkles className="w-16 h-16 text-purple-300 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-slate-800 mb-2">
                  Nessuna Consulenza AI
                </h3>
                <p className="text-slate-600 mb-6">
                  Crea la prima consulenza AI per i tuoi clienti
                </p>
                <Button
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crea Prima Consulenza
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {consultations.map((consultation: any) => (
                <Card key={consultation.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <User className="w-5 h-5 text-purple-600" />
                          <h3 className="text-xl font-bold">
                            {consultation.clientFirstName} {consultation.clientLastName}
                          </h3>
                          {consultation.isTestMode && (
                            <Badge className="bg-green-100 text-green-700">
                              🧪 Test
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-6 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(consultation.scheduledFor), "EEEE dd MMMM yyyy", { locale: it })}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {format(new Date(consultation.scheduledFor), "HH:mm")}
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {consultation.maxDurationMinutes} min
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(consultation)}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(consultation.id)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
