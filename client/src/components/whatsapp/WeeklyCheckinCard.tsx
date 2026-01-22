import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  CalendarCheck, 
  Send, 
  MessageCircle, 
  TrendingUp, 
  Clock, 
  Sparkles,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageSquare,
  ChevronDown
} from "lucide-react";

interface CheckinConfig {
  id: string;
  consultantId: string;
  isEnabled: boolean;
  preferredTimeStart: string;
  preferredTimeEnd: string;
  excludedDays: number[];
  templateIds: string[];
  useAiPersonalization: boolean;
  targetAudience: string;
  minDaysSinceLastContact: number;
  totalSent: number;
  totalResponses: number;
}

interface WhatsAppTemplate {
  id: string;
  friendlyName: string;
  bodyText: string;
  approvalStatus: string;
  useCase?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  "Setter": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "bg-blue-500" },
  "Receptionist": { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: "bg-green-500" },
  "Follow-up": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", icon: "bg-orange-500" },
  "Check-in": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: "bg-purple-500" },
  "Riattivazione": { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200", icon: "bg-pink-500" },
  "Notifica": { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", icon: "bg-cyan-500" },
  "Generale": { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", icon: "bg-gray-500" },
};

interface CheckinLog {
  id: string;
  clientId: string;
  phoneNumber: string;
  templateName: string;
  personalizedMessage: string;
  status: string;
  scheduledFor: string;
  sentAt: string | null;
  repliedAt: string | null;
  clientName?: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

const DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Gio" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sab" },
];

export function WeeklyCheckinCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  const { data: config, isLoading: configLoading } = useQuery<CheckinConfig | null>({
    queryKey: ["/api/weekly-checkin/config"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<WhatsAppTemplate[]>({
    queryKey: ["/api/weekly-checkin/templates"],
  });

  const categorizeTemplate = (template: WhatsAppTemplate): string => {
    const name = (template.friendlyName || "").toLowerCase();
    const useCase = (template.useCase || "").toLowerCase();
    
    if (name.includes("setter") || useCase.includes("setter")) return "Setter";
    if (name.includes("receptionist") || useCase.includes("receptionist")) return "Receptionist";
    if (name.includes("follow-up") || name.includes("followup") || useCase.includes("follow")) return "Follow-up";
    if (name.includes("check") || useCase.includes("check")) return "Check-in";
    if (name.includes("riattivazione") || name.includes("riattiva") || useCase.includes("riattiva")) return "Riattivazione";
    if (name.includes("notifica") || name.includes("promemoria") || useCase.includes("notifica")) return "Notifica";
    return "Generale";
  };

  const templatesByCategory = useMemo(() => {
    const grouped: Record<string, WhatsAppTemplate[]> = {};
    templates.forEach((template) => {
      const category = categorizeTemplate(template);
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(template);
    });
    return grouped;
  }, [templates]);

  const { data: logs = [] } = useQuery<CheckinLog[]>({
    queryKey: ["/api/weekly-checkin/logs?limit=5"],
  });

  const { data: stats } = useQuery<{ totalSent: number; totalResponses: number; responseRate: number }>({
    queryKey: ["/api/weekly-checkin/stats"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      if (!config) {
        await apiRequest("POST", "/api/weekly-checkin/config", { isEnabled: true });
        return;
      }
      return apiRequest("PATCH", "/api/weekly-checkin/config/toggle");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-checkin/config"] });
      toast({ title: config?.isEnabled ? "Check-in disabilitato" : "Check-in abilitato" });
    },
    onError: async (error: any) => {
      if (error.message?.includes("404") || error.status === 404) {
        await apiRequest("POST", "/api/weekly-checkin/config", { isEnabled: true });
        queryClient.invalidateQueries({ queryKey: ["/api/weekly-checkin/config"] });
        toast({ title: "Check-in abilitato" });
      } else {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
      }
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data: Partial<CheckinConfig>) => apiRequest("POST", "/api/weekly-checkin/config", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-checkin/config"] });
      toast({ title: "Configurazione salvata" });
    },
  });

  const testMutation = useMutation({
    mutationFn: (clientId: string) => apiRequest("POST", "/api/weekly-checkin/test", { clientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-checkin/logs"] });
      setTestDialogOpen(false);
      setSelectedClientId("");
      toast({ title: "Check-in di test programmato" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const handleTemplateToggle = (templateId: string, isChecked: boolean) => {
    const currentIds = config?.templateIds || [];
    const newIds = isChecked
      ? [...currentIds, templateId]
      : currentIds.filter((id) => id !== templateId);
    updateConfigMutation.mutate({ templateIds: newIds });
  };

  const handleDayToggle = (day: number, isExcluded: boolean) => {
    const currentExcluded = config?.excludedDays || [];
    const newExcluded = isExcluded
      ? currentExcluded.filter((d) => d !== day)
      : [...currentExcluded, day];
    updateConfigMutation.mutate({ excludedDays: newExcluded });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "replied":
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  if (configLoading) {
    return (
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg">
              <CalendarCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                Check-in Settimanale Automatico
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Contatta automaticamente i tuoi clienti ogni settimana
              </p>
            </div>
          </div>
          <Switch
            checked={config?.isEnabled || false}
            onCheckedChange={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats?.totalSent || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Messaggi Inviati</div>
          </div>
          <div className="text-center p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats?.totalResponses || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Risposte</div>
          </div>
          <div className="text-center p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats?.responseRate || 0}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tasso Risposta</div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Template WhatsApp Approvati
            </h4>
            {(config?.templateIds || []).length > 0 && (
              <Badge className="bg-purple-500 text-white text-xs px-3 py-1">
                {(config?.templateIds || []).length} selezionati
              </Badge>
            )}
          </div>

          {templatesLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Nessun template WhatsApp approvato trovato</p>
              <p className="text-xs text-gray-400 mt-1">
                Configura i template nella sezione WhatsApp Templates
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {Object.entries(templatesByCategory).map(([categoryName, categoryTemplates]) => {
                const isOpen = openCategories.has(categoryName);
                const colors = CATEGORY_COLORS[categoryName] || CATEGORY_COLORS["Generale"];
                const selectedInCategory = categoryTemplates.filter(t => 
                  config?.templateIds?.includes(t.id)
                ).length;
                
                return (
                  <Collapsible
                    key={categoryName}
                    open={isOpen}
                    onOpenChange={(open) => {
                      setOpenCategories(prev => {
                        const newSet = new Set(prev);
                        if (open) {
                          newSet.add(categoryName);
                        } else {
                          newSet.delete(categoryName);
                        }
                        return newSet;
                      });
                    }}
                  >
                    <CollapsibleTrigger asChild>
                      <div className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${colors.bg} ${colors.border} border hover:opacity-90`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${colors.icon}`}></div>
                          <span className={`font-semibold ${colors.text}`}>{categoryName}</span>
                          <Badge variant="outline" className={`text-xs ${colors.bg} ${colors.text} ${colors.border}`}>
                            {categoryTemplates.length} template
                          </Badge>
                          {selectedInCategory > 0 && (
                            <Badge className="bg-purple-500 text-white text-xs">
                              {selectedInCategory} selezionati
                            </Badge>
                          )}
                        </div>
                        <ChevronDown className={`h-4 w-4 ${colors.text} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <div className="space-y-2 pl-2">
                        {categoryTemplates.map((template) => {
                          const isSelected = config?.templateIds?.includes(template.id) || false;
                          return (
                            <label
                              key={template.id}
                              className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                                isSelected
                                  ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 shadow-md"
                                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-200 hover:bg-gray-50"
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleTemplateToggle(template.id, checked as boolean)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-gray-900 dark:text-white">
                                    {template.friendlyName}
                                  </span>
                                  <Badge className="text-xs bg-green-100 text-green-700 border-green-300">
                                    Approvato
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                                  {template.bodyText || "Template senza corpo visibile"}
                                </p>
                                <p className="text-xs text-gray-400 font-mono mt-2">
                                  {template.id}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-5">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Configurazione Check-in
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Personalizza quando e come vengono inviati i messaggi automatici ai tuoi clienti
            </p>
          </div>

          <div className="space-y-4">
            {/* Orario Invio */}
            <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                  <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h5 className="font-medium text-gray-900 dark:text-white text-sm">Fascia Oraria</h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    I messaggi vengono inviati in modo casuale all'interno di questa fascia, così sembrano più naturali e non automatici
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 ml-11">
                <Input
                  type="time"
                  value={config?.preferredTimeStart || "09:00"}
                  onChange={(e) => updateConfigMutation.mutate({ preferredTimeStart: e.target.value })}
                  className="w-28 bg-white dark:bg-gray-800"
                />
                <span className="text-gray-400 text-sm">fino alle</span>
                <Input
                  type="time"
                  value={config?.preferredTimeEnd || "18:00"}
                  onChange={(e) => updateConfigMutation.mutate({ preferredTimeEnd: e.target.value })}
                  className="w-28 bg-white dark:bg-gray-800"
                />
              </div>
            </div>

            {/* Giorni Attivi */}
            <div className="p-4 rounded-xl border border-green-100 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                  <CalendarCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h5 className="font-medium text-gray-900 dark:text-white text-sm">Giorni di Invio</h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Seleziona i giorni in cui vuoi che vengano inviati i check-in. Evita i weekend se i tuoi clienti preferiscono non essere contattati
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 ml-11">
                {DAYS.map((day) => {
                  const isActive = !config?.excludedDays?.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      onClick={() => handleDayToggle(day.value, !isActive)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        isActive
                          ? "bg-green-500 text-white shadow-sm"
                          : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Personalizzazione AI */}
            <div className="p-4 rounded-xl border border-purple-100 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50">
                    <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900 dark:text-white text-sm">Personalizzazione AI</h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      L'AI adatta il messaggio in base al nome del cliente e al suo percorso, rendendo ogni check-in unico e personale
                    </p>
                  </div>
                </div>
                <Switch
                  checked={config?.useAiPersonalization || false}
                  onCheckedChange={(checked) => updateConfigMutation.mutate({ useAiPersonalization: checked })}
                />
              </div>
            </div>

            {/* Esclusione Contatti Recenti */}
            <div className="p-4 rounded-xl border border-orange-100 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50">
                  <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1">
                  <h5 className="font-medium text-gray-900 dark:text-white text-sm">Evita Spam</h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Non inviare check-in ai clienti che hai già contattato di recente. Così eviti di sembrare insistente
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Escludi se contattati negli ultimi</span>
                    <Input
                      type="number"
                      value={config?.minDaysSinceLastContact || 5}
                      onChange={(e) => updateConfigMutation.mutate({ minDaysSinceLastContact: parseInt(e.target.value) || 5 })}
                      className="w-16 text-center bg-white dark:bg-gray-800"
                      min={1}
                      max={30}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-300">giorni</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {Array.isArray(logs) && logs.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 dark:text-white">Ultimi Check-in</h4>
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                  >
                    {getStatusIcon(log.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {log.clientName || log.phoneNumber}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {log.personalizedMessage || log.templateName}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(log.sentAt || log.scheduledFor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="pt-2">
          <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full gap-2">
                <Send className="h-4 w-4" />
                Invia Check-in di Test
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invia Check-in di Test</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Seleziona Cliente</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Scegli un cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients
                        .filter((c: any) => c.phoneNumber)
                        .map((client: any) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.firstName} {client.lastName} - {client.phoneNumber}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => testMutation.mutate(selectedClientId)}
                  disabled={!selectedClientId || testMutation.isPending}
                  className="w-full"
                >
                  {testMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Invia Test
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

export default WeeklyCheckinCard;
