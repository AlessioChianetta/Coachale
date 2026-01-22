import { useState } from "react";
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
  MessageSquare
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
}

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

  const { data: config, isLoading: configLoading } = useQuery<CheckinConfig | null>({
    queryKey: ["/api/weekly-checkin/config"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<WhatsAppTemplate[]>({
    queryKey: ["/api/weekly-checkin/templates"],
  });

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
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {templates.map((template) => {
                const isSelected = config?.templateIds?.includes(template.id) || false;
                return (
                  <label
                    key={template.id}
                    className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                      isSelected
                        ? "border-purple-400 bg-purple-50 dark:bg-purple-900/20 shadow-md"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-200 hover:bg-gray-50 dark:hover:bg-gray-750"
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
                        <Badge className="text-xs bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400">
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
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Impostazioni
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 dark:text-gray-400">Orario Invio</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={config?.preferredTimeStart || "09:00"}
                  onChange={(e) => updateConfigMutation.mutate({ preferredTimeStart: e.target.value })}
                  className="w-24"
                />
                <span className="text-gray-400">-</span>
                <Input
                  type="time"
                  value={config?.preferredTimeEnd || "18:00"}
                  onChange={(e) => updateConfigMutation.mutate({ preferredTimeEnd: e.target.value })}
                  className="w-24"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 dark:text-gray-400">Giorni Attivi</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((day) => (
                  <button
                    key={day.value}
                    onClick={() => handleDayToggle(day.value, config?.excludedDays?.includes(day.value) || false)}
                    className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                      config?.excludedDays?.includes(day.value)
                        ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Personalizza messaggi con AI
              </span>
            </div>
            <Switch
              checked={config?.useAiPersonalization || false}
              onCheckedChange={(checked) => updateConfigMutation.mutate({ useAiPersonalization: checked })}
            />
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <Users className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Escludi clienti contattati negli ultimi
            </span>
            <Input
              type="number"
              value={config?.minDaysSinceLastContact || 5}
              onChange={(e) => updateConfigMutation.mutate({ minDaysSinceLastContact: parseInt(e.target.value) || 5 })}
              className="w-16 text-center"
              min={1}
              max={30}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">giorni</span>
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
