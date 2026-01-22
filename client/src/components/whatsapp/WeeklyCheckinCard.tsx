import { useState, useEffect } from "react";
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
  Plus, 
  Trash2, 
  Sparkles,
  Users,
  RefreshCw,
  CheckCircle2,
  Eye,
  XCircle,
  Loader2
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

interface CheckinTemplate {
  id: string;
  name: string;
  body: string;
  category: string;
  isSystemTemplate: boolean;
  isActive: boolean;
  timesUsed: number;
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
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateBody, setNewTemplateBody] = useState("");
  const [showAddTemplate, setShowAddTemplate] = useState(false);

  const { data: config, isLoading: configLoading } = useQuery<CheckinConfig | null>({
    queryKey: ["/api/weekly-checkin/config"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<CheckinTemplate[]>({
    queryKey: ["/api/weekly-checkin/templates"],
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<CheckinLog[]>({
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

  const createTemplateMutation = useMutation({
    mutationFn: (data: { name: string; body: string }) => apiRequest("POST", "/api/weekly-checkin/templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-checkin/templates"] });
      setNewTemplateName("");
      setNewTemplateBody("");
      setShowAddTemplate(false);
      toast({ title: "Template creato" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/weekly-checkin/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-checkin/templates"] });
      toast({ title: "Template eliminato" });
    },
  });

  const testMutation = useMutation({
    mutationFn: (clientId: string) => apiRequest("POST", "/api/weekly-checkin/test", { clientId }),
    onSuccess: () => {
      setTestDialogOpen(false);
      toast({ title: "Check-in di test inviato!" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const handleTemplateToggle = (templateId: string, checked: boolean) => {
    const currentIds = config?.templateIds || [];
    const newIds = checked 
      ? [...currentIds, templateId]
      : currentIds.filter(id => id !== templateId);
    updateConfigMutation.mutate({ templateIds: newIds });
  };

  const handleDayToggle = (day: number, checked: boolean) => {
    const currentDays = config?.excludedDays || [];
    const newDays = checked 
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    updateConfigMutation.mutate({ excludedDays: newDays });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent": return <Send className="h-4 w-4 text-blue-500" />;
      case "delivered": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "read": return <Eye className="h-4 w-4 text-purple-500" />;
      case "replied": return <MessageCircle className="h-4 w-4 text-emerald-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
      case "scheduled": return <Clock className="h-4 w-4 text-amber-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return `Oggi ${date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
    if (diffDays === 1) return `Ieri ${date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
    return `${diffDays} gg fa`;
  };

  const responseRate = stats?.totalSent ? Math.round((stats.totalResponses / stats.totalSent) * 100) : 0;

  if (configLoading) {
    return (
      <Card className="rounded-2xl border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 shadow-xl">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-900 dark:to-blue-950/20 shadow-xl overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/25">
              <CalendarCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
                Check-in Settimanale Automatico
              </CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Contatta automaticamente i tuoi clienti ogni settimana
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {config?.isEnabled ? "Attivo" : "Disattivato"}
            </span>
            <Switch
              checked={config?.isEnabled || false}
              onCheckedChange={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
              <Send className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Inviati</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.totalSent || 0}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Risposte</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.totalResponses || 0}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Tasso</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {responseRate}%
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Template in Rotazione
            </h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddTemplate(!showAddTemplate)}
              className="gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Aggiungi
            </Button>
          </div>

          {showAddTemplate && (
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-3">
              <Input
                placeholder="Nome template"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
              <Input
                placeholder="Testo template (usa {nome_cliente} per il nome)"
                value={newTemplateBody}
                onChange={(e) => setNewTemplateBody(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => createTemplateMutation.mutate({ name: newTemplateName, body: newTemplateBody })}
                  disabled={!newTemplateName || !newTemplateBody || createTemplateMutation.isPending}
                >
                  Salva
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddTemplate(false)}>
                  Annulla
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
              >
                <Checkbox
                  checked={config?.templateIds?.includes(template.id) || false}
                  onCheckedChange={(checked) => handleTemplateToggle(template.id, checked as boolean)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">
                      {template.name}
                    </span>
                    {template.isSystemTemplate && (
                      <Badge variant="secondary" className="text-xs">Sistema</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {template.body}
                  </p>
                </div>
                {!template.isSystemTemplate && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => deleteTemplateMutation.mutate(template.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
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

        {logs.length > 0 && (
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
