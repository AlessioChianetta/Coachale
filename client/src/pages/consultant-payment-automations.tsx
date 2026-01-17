import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  CreditCard, Plus, Trash2, Copy, Check, ExternalLink, Loader2, 
  AlertCircle, Users, RefreshCw, History, Zap, Mail, CheckCircle, XCircle, Settings
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface StripePaymentAutomation {
  id: string;
  consultantId: string;
  stripePaymentLinkId: string;
  linkName: string;
  createAsClient: boolean;
  createAsConsultant: boolean;
  clientLevel: "bronze" | "silver" | "gold" | null;
  assignToAgents: string[];
  sendWelcomeEmail: boolean;
  welcomeEmailSubject: string | null;
  welcomeEmailTemplate: string | null;
  isActive: boolean;
  usersCreatedCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AutomationLog {
  id: string;
  customerEmail: string;
  customerName: string | null;
  rolesAssigned: string[];
  status: "success" | "failed" | "pending";
  errorMessage: string | null;
  createdAt: string;
}

export default function ConsultantPaymentAutomations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<StripePaymentAutomation | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const [formData, setFormData] = useState({
    stripePaymentLinkId: "",
    linkName: "",
    createAsClient: true,
    createAsConsultant: false,
    clientLevel: "" as "bronze" | "silver" | "gold" | "",
    sendWelcomeEmail: true,
    welcomeEmailSubject: "",
    welcomeEmailTemplate: "",
  });

  const { data: automations = [], isLoading: loadingAutomations } = useQuery<StripePaymentAutomation[]>({
    queryKey: ["/api/stripe-automations"],
    queryFn: async () => {
      const res = await fetch("/api/stripe-automations", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch automations");
      return res.json();
    },
  });

  const { data: webhookInfo } = useQuery<{ webhookUrl: string; instructions: string[] }>({
    queryKey: ["/api/stripe-automations/webhook-url"],
    queryFn: async () => {
      const res = await fetch("/api/stripe-automations/webhook-url", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch webhook URL");
      return res.json();
    },
  });

  const { data: logs = [], isLoading: loadingLogs } = useQuery<AutomationLog[]>({
    queryKey: ["/api/stripe-automations", selectedAutomation?.id, "logs"],
    queryFn: async () => {
      if (!selectedAutomation) return [];
      const res = await fetch(`/api/stripe-automations/${selectedAutomation.id}/logs`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    enabled: !!selectedAutomation && isLogsDialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/stripe-automations", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          clientLevel: data.clientLevel || null,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create automation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe-automations"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "Automazione creata!", description: "L'automazione e' pronta per ricevere pagamenti." });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/stripe-automations/${id}`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to update automation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe-automations"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/stripe-automations/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete automation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe-automations"] });
      toast({ title: "Automazione eliminata" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile eliminare l'automazione", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      stripePaymentLinkId: "",
      linkName: "",
      createAsClient: true,
      createAsConsultant: false,
      clientLevel: "",
      sendWelcomeEmail: true,
      welcomeEmailSubject: "",
      welcomeEmailTemplate: "",
    });
  };

  const copyWebhookUrl = () => {
    if (webhookInfo?.webhookUrl) {
      navigator.clipboard.writeText(webhookInfo.webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
      toast({ title: "URL copiato!" });
    }
  };

  const getLevelBadge = (level: string | null) => {
    switch (level) {
      case "bronze":
        return <Badge className="bg-amber-700 text-white">Bronze</Badge>;
      case "silver":
        return <Badge className="bg-slate-400 text-white">Silver</Badge>;
      case "gold":
        return <Badge className="bg-yellow-500 text-black">Gold</Badge>;
      default:
        return <Badge variant="outline">Nessuno</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <main className={`flex-1 p-4 md:p-8 pt-6 ${!isMobile ? "md:ml-16" : ""}`}>
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                  <CreditCard className="h-7 w-7 text-emerald-500" />
                  Automazioni Pagamento
                </h1>
                <p className="text-muted-foreground mt-1">
                  Crea utenti automaticamente quando ricevi un pagamento Stripe
                </p>
              </div>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Nuova Automazione
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-5 w-5" />
                  Configurazione Webhook
                </CardTitle>
                <CardDescription>
                  Configura questo URL nella tua dashboard Stripe per ricevere le notifiche di pagamento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input 
                    value={webhookInfo?.webhookUrl || ""} 
                    readOnly 
                    className="font-mono text-sm flex-1"
                  />
                  <Button variant="outline" onClick={copyWebhookUrl} className="gap-2">
                    {copiedWebhook ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    {copiedWebhook ? "Copiato!" : "Copia"}
                  </Button>
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Come configurare</AlertTitle>
                  <AlertDescription>
                    <ol className="list-decimal list-inside space-y-1 mt-2 text-sm">
                      {webhookInfo?.instructions.map((instruction, i) => (
                        <li key={i}>{instruction}</li>
                      ))}
                    </ol>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-amber-500" />
                  Le tue Automazioni
                </CardTitle>
                <CardDescription>
                  Gestisci le regole per la creazione automatica degli utenti
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAutomations ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : automations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nessuna automazione configurata</p>
                    <p className="text-sm">Clicca "Nuova Automazione" per iniziare</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead className="hidden md:table-cell">Payment Link ID</TableHead>
                        <TableHead>Ruoli</TableHead>
                        <TableHead>Livello</TableHead>
                        <TableHead className="hidden md:table-cell">Utenti Creati</TableHead>
                        <TableHead>Attivo</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {automations.map((automation) => (
                        <TableRow key={automation.id}>
                          <TableCell className="font-medium">{automation.linkName}</TableCell>
                          <TableCell className="hidden md:table-cell font-mono text-xs">
                            {automation.stripePaymentLinkId.slice(0, 20)}...
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {automation.createAsClient && (
                                <Badge variant="secondary" className="text-xs">Cliente</Badge>
                              )}
                              {automation.createAsConsultant && (
                                <Badge variant="secondary" className="text-xs">Consulente</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getLevelBadge(automation.clientLevel)}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              {automation.usersCreatedCount}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={automation.isActive}
                              onCheckedChange={(checked) => 
                                toggleMutation.mutate({ id: automation.id, isActive: checked })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedAutomation(automation);
                                  setIsLogsDialogOpen(true);
                                }}
                                title="Visualizza log"
                              >
                                <History className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm("Sei sicuro di voler eliminare questa automazione?")) {
                                    deleteMutation.mutate(automation.id);
                                  }
                                }}
                                className="text-destructive hover:text-destructive"
                                title="Elimina"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nuova Automazione
            </DialogTitle>
            <DialogDescription>
              Configura come creare automaticamente gli utenti quando ricevi un pagamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="linkName">Nome dell'automazione</Label>
              <Input
                id="linkName"
                placeholder="Es: Abbonamento Gold Mensile"
                value={formData.linkName}
                onChange={(e) => setFormData({ ...formData, linkName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentLinkId">Payment Link ID Stripe</Label>
              <Input
                id="paymentLinkId"
                placeholder="plink_1abc..."
                value={formData.stripePaymentLinkId}
                onChange={(e) => setFormData({ ...formData, stripePaymentLinkId: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Lo trovi nella dashboard Stripe nella sezione Payment Links
              </p>
            </div>

            <div className="space-y-3 border rounded-lg p-4">
              <Label className="font-medium">Ruoli da assegnare</Label>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Crea come Cliente</span>
                </div>
                <Switch
                  checked={formData.createAsClient}
                  onCheckedChange={(checked) => setFormData({ ...formData, createAsClient: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Crea come Consulente</span>
                </div>
                <Switch
                  checked={formData.createAsConsultant}
                  onCheckedChange={(checked) => setFormData({ ...formData, createAsConsultant: checked })}
                />
              </div>
            </div>

            {formData.createAsClient && (
              <div className="space-y-2">
                <Label>Livello Cliente</Label>
                <Select 
                  value={formData.clientLevel} 
                  onValueChange={(value) => setFormData({ ...formData, clientLevel: value as typeof formData.clientLevel })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona livello..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bronze">Bronze</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Invia email di benvenuto</span>
                </div>
                <Switch
                  checked={formData.sendWelcomeEmail}
                  onCheckedChange={(checked) => setFormData({ ...formData, sendWelcomeEmail: checked })}
                />
              </div>

              {formData.sendWelcomeEmail && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="emailSubject">Oggetto email (opzionale)</Label>
                    <Input
                      id="emailSubject"
                      placeholder="Benvenuto! Il tuo accesso e' pronto"
                      value={formData.welcomeEmailSubject}
                      onChange={(e) => setFormData({ ...formData, welcomeEmailSubject: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailTemplate">Template personalizzato (opzionale)</Label>
                    <Textarea
                      id="emailTemplate"
                      placeholder="Usa {{name}}, {{email}}, {{password}}, {{tier}}, {{consultant}}, {{loginUrl}} come variabili..."
                      value={formData.welcomeEmailTemplate}
                      onChange={(e) => setFormData({ ...formData, welcomeEmailTemplate: e.target.value })}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Lascia vuoto per usare il template predefinito
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Annulla
            </Button>
            <Button 
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.linkName || !formData.stripePaymentLinkId || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creazione...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Crea Automazione
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLogsDialogOpen} onOpenChange={setIsLogsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Log Automazione: {selectedAutomation?.linkName}
            </DialogTitle>
            <DialogDescription>
              Storico degli utenti creati da questa automazione
            </DialogDescription>
          </DialogHeader>

          {loadingLogs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessun log disponibile</p>
              <p className="text-sm">I log appariranno quando verranno creati nuovi utenti</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: it })}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{log.customerEmail}</TableCell>
                    <TableCell>{log.customerName || "-"}</TableCell>
                    <TableCell>
                      {log.status === "success" && (
                        <Badge className="bg-green-500 text-white gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Successo
                        </Badge>
                      )}
                      {log.status === "failed" && (
                        <Badge variant="destructive" className="gap-1" title={log.errorMessage || ""}>
                          <XCircle className="h-3 w-3" />
                          Fallito
                        </Badge>
                      )}
                      {log.status === "pending" && (
                        <Badge variant="secondary" className="gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          In corso
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLogsDialogOpen(false)}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
