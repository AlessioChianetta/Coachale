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
  AlertCircle, Users, RefreshCw, History, Zap, Mail, CheckCircle, XCircle, Settings,
  Key, Link as LinkIcon, Pencil, TrendingUp, Euro, Percent, Calendar, Info
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
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
  clientLevel: "bronze" | "silver" | "gold" | "deluxe" | null;
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

interface DirectLink {
  id: string;
  tier: "bronze" | "silver" | "gold" | "deluxe";
  billingInterval: "monthly" | "yearly";
  priceCents: number;
  originalPriceCents: number | null;
  discountPercent: number;
  discountExpiresAt: string | null;
  paymentLinkUrl: string | null;
  isActive: boolean;
}

interface DirectLinkFormState {
  [key: string]: {
    priceEuros: string;
    discountPercent: string;
    discountExpiresAt: Date | null;
  };
}

export default function ConsultantPaymentAutomations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<StripePaymentAutomation | null>(null);
  const [editingAutomation, setEditingAutomation] = useState<StripePaymentAutomation | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedDirectLink, setCopiedDirectLink] = useState<string | null>(null);

  const [directLinkForm, setDirectLinkForm] = useState<DirectLinkFormState>({});

  const [formData, setFormData] = useState({
    stripePaymentLinkId: "",
    linkName: "",
    createAsClient: true,
    createAsConsultant: false,
    clientLevel: "none" as "bronze" | "silver" | "gold" | "deluxe" | "none",
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

  const { data: paymentLinksData, isLoading: loadingPaymentLinks, refetch: refetchPaymentLinks, error: paymentLinksError } = useQuery({
    queryKey: ["/api/stripe-automations/payment-links"],
    queryFn: async () => {
      const res = await fetch("/api/stripe-automations/payment-links", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        return { error: true, ...errorData };
      }
      return res.json();
    },
  });

  const { data: directLinks = [], isLoading: loadingDirectLinks } = useQuery<DirectLink[]>({
    queryKey: ["/api/stripe-automations/direct-links"],
    queryFn: async () => {
      const res = await fetch("/api/stripe-automations/direct-links", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch direct links");
      return res.json();
    },
  });

  const directLinkMutation = useMutation({
    mutationFn: async (data: { tier: string; billingInterval: string; priceEuros: number; discountPercent?: number; discountExpiresAt?: string | null }) => {
      const res = await fetch("/api/stripe-automations/direct-links", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create/update direct link");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe-automations/direct-links"] });
      toast({ title: "Link creato/aggiornato!", description: "Il payment link e' stato generato con successo." });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/stripe-automations", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          clientLevel: data.clientLevel && data.clientLevel !== "none" ? data.clientLevel : null,
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

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof formData) => {
      const { id, ...updates } = data;
      const res = await fetch(`/api/stripe-automations/${id}`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updates,
          clientLevel: updates.clientLevel && updates.clientLevel !== "none" ? updates.clientLevel : null,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update automation");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe-automations"] });
      setIsCreateDialogOpen(false);
      setEditingAutomation(null);
      resetForm();
      toast({ title: "Automazione aggiornata!", description: "Le modifiche sono state salvate." });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const openEditDialog = (automation: StripePaymentAutomation) => {
    setEditingAutomation(automation);
    setFormData({
      stripePaymentLinkId: automation.stripePaymentLinkId,
      linkName: automation.linkName,
      createAsClient: automation.createAsClient,
      createAsConsultant: automation.createAsConsultant,
      clientLevel: automation.clientLevel || "none",
      sendWelcomeEmail: automation.sendWelcomeEmail,
      welcomeEmailSubject: automation.welcomeEmailSubject || "",
      welcomeEmailTemplate: automation.welcomeEmailTemplate || "",
    });
    setIsCreateDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      stripePaymentLinkId: "",
      linkName: "",
      createAsClient: true,
      createAsConsultant: false,
      clientLevel: "none",
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
      case "deluxe":
        return <Badge className="bg-purple-600 text-white">Deluxe</Badge>;
      default:
        return <Badge variant="outline">Nessuno</Badge>;
    }
  };

  const getTierBadge = (tier: "bronze" | "silver" | "gold" | "deluxe") => {
    switch (tier) {
      case "bronze":
        return <Badge className="bg-amber-700 text-white text-sm px-3 py-1">Bronze</Badge>;
      case "silver":
        return <Badge className="bg-slate-400 text-white text-sm px-3 py-1">Silver</Badge>;
      case "gold":
        return <Badge className="bg-yellow-500 text-black text-sm px-3 py-1">Gold</Badge>;
      case "deluxe":
        return <Badge className="bg-purple-600 text-white text-sm px-3 py-1">Deluxe (Cliente + Consulente)</Badge>;
    }
  };

  const getDirectLinkFormKey = (tier: string, interval: string) => `${tier}-${interval}`;

  const getDirectLink = (tier: "bronze" | "silver" | "gold" | "deluxe", interval: "monthly" | "yearly") => {
    return directLinks.find(link => link.tier === tier && link.billingInterval === interval);
  };

  const getFormValue = (tier: string, interval: string) => {
    const key = getDirectLinkFormKey(tier, interval);
    return directLinkForm[key] || { priceEuros: "", discountPercent: "", discountExpiresAt: null };
  };

  const setFormValue = (tier: string, interval: string, field: "priceEuros" | "discountPercent" | "discountExpiresAt", value: string | Date | null) => {
    const key = getDirectLinkFormKey(tier, interval);
    setDirectLinkForm(prev => ({
      ...prev,
      [key]: {
        ...getFormValue(tier, interval),
        [field]: value,
      }
    }));
  };

  const handleGenerateDirectLink = (tier: "bronze" | "silver" | "gold" | "deluxe", interval: "monthly" | "yearly") => {
    const form = getFormValue(tier, interval);
    const priceEuros = parseFloat(form.priceEuros);
    if (isNaN(priceEuros) || priceEuros <= 0) {
      toast({ title: "Errore", description: "Inserisci un prezzo valido", variant: "destructive" });
      return;
    }

    const discountPercent = form.discountPercent ? parseFloat(form.discountPercent) : undefined;
    const discountExpiresAt = form.discountExpiresAt ? form.discountExpiresAt.toISOString() : null;

    directLinkMutation.mutate({
      tier,
      billingInterval: interval,
      priceEuros,
      discountPercent: discountPercent && !isNaN(discountPercent) ? discountPercent : undefined,
      discountExpiresAt,
    });
  };

  const copyDirectLinkUrl = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedDirectLink(key);
    setTimeout(() => setCopiedDirectLink(null), 2000);
    toast({ title: "Link copiato!" });
  };

  const needsUpdate = (tier: "bronze" | "silver" | "gold" | "deluxe", interval: "monthly" | "yearly") => {
    const existingLink = getDirectLink(tier, interval);
    const form = getFormValue(tier, interval);
    if (!existingLink || !existingLink.paymentLinkUrl) return false;
    const formPrice = parseFloat(form.priceEuros);
    if (isNaN(formPrice)) return false;
    const existingPriceEuros = existingLink.priceCents / 100;
    return formPrice !== existingPriceEuros;
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

            {/* Payment Links da Stripe */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ExternalLink className="h-5 w-5 text-blue-500" />
                  I tuoi Payment Links
                </CardTitle>
                <CardDescription>
                  Payment Links creati nel tuo account Stripe
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPaymentLinks ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : paymentLinksData?.needsSecretKey ? (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
                    <p className="font-medium text-amber-700">Chiave pubblica invece di segreta</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Hai configurato una chiave <strong>pubblica</strong> (pk_...).
                      <br />Serve la chiave <strong>SEGRETA</strong> (sk_test_... o sk_live_...).
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Vai su <strong>Impostazioni → Chiavi API → tab Stripe</strong> e inserisci la Secret Key.
                    </p>
                  </div>
                ) : paymentLinksData?.error || !paymentLinksData?.hasApiKey ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Chiavi API Stripe non configurate</p>
                    <p className="text-sm">Vai su Impostazioni → Chiavi API per configurare le tue chiavi Stripe</p>
                  </div>
                ) : paymentLinksData?.links?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <LinkIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nessun Payment Link trovato</p>
                    <p className="text-sm">Crea Payment Links nella dashboard Stripe</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-sm text-muted-foreground">
                        {paymentLinksData.links.filter((l: any) => l.active).length} link attivi
                      </span>
                      <Button variant="outline" size="sm" onClick={() => refetchPaymentLinks()}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Aggiorna
                      </Button>
                    </div>
                    <div className="border rounded-lg divide-y">
                      {paymentLinksData.links.filter((link: any) => link.active).map((link: any) => (
                        <div key={link.id} className="p-4 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {link.name && (
                                <span className="font-medium text-sm">{link.name}</span>
                              )}
                              <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">{link.id}</code>
                              {link.active ? (
                                <Badge variant="secondary" className="bg-green-100 text-green-700">Attivo</Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-gray-100 text-gray-600">Inattivo</Badge>
                              )}
                              {link.hasAutomation && (
                                <Badge className="bg-blue-100 text-blue-700">
                                  <Zap className="h-3 w-3 mr-1" />
                                  Automazione attiva
                                </Badge>
                              )}
                            </div>
                            <a 
                              href={link.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline truncate block"
                            >
                              {link.url}
                            </a>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                navigator.clipboard.writeText(link.id);
                                toast({ title: "Copiato!", description: "ID copiato negli appunti" });
                              }}
                              title="Copia ID"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            {!link.hasAutomation && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setFormData({ ...formData, stripePaymentLinkId: link.id });
                                  setIsCreateDialogOpen(true);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Crea Automazione
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Link Upgrade Diretti */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Link Upgrade Diretti
                </CardTitle>
                <CardDescription>
                  Crea link di pagamento per gli upgrade (100% commissione)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {loadingDirectLinks ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {(["silver", "gold", "deluxe"] as const).map((tier) => (
                      <div key={tier} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center gap-3">
                          {getTierBadge(tier)}
                        </div>
                        
                        {(["monthly", "yearly"] as const).map((interval) => {
                          const existingLink = getDirectLink(tier, interval);
                          const form = getFormValue(tier, interval);
                          const linkKey = getDirectLinkFormKey(tier, interval);
                          const hasExistingLink = existingLink && existingLink.paymentLinkUrl;
                          const showUpdateButton = needsUpdate(tier, interval);

                          return (
                            <div key={interval} className="flex flex-col md:flex-row md:items-center gap-3 p-3 bg-muted/30 rounded-lg">
                              <div className="flex items-center gap-2 min-w-[100px]">
                                <Badge variant="outline" className="text-xs">
                                  {interval === "monthly" ? "Mensile" : "Annuale"}
                                </Badge>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 flex-1">
                                <div className="flex items-center gap-1">
                                  <Euro className="h-4 w-4 text-muted-foreground" />
                                  <Input
                                    type="number"
                                    placeholder="Prezzo"
                                    className="w-24"
                                    value={form.priceEuros || (existingLink ? String(existingLink.priceCents / 100) : "")}
                                    onChange={(e) => setFormValue(tier, interval, "priceEuros", e.target.value)}
                                  />
                                </div>

                                <div className="flex items-center gap-1">
                                  <Percent className="h-4 w-4 text-muted-foreground" />
                                  <Input
                                    type="number"
                                    placeholder="Sconto %"
                                    className="w-20"
                                    value={form.discountPercent}
                                    onChange={(e) => setFormValue(tier, interval, "discountPercent", e.target.value)}
                                  />
                                </div>

                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="w-auto gap-1">
                                      <Calendar className="h-4 w-4" />
                                      {form.discountExpiresAt 
                                        ? format(form.discountExpiresAt, "dd/MM/yyyy")
                                        : "Scadenza"
                                      }
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <CalendarComponent
                                      mode="single"
                                      selected={form.discountExpiresAt || undefined}
                                      onSelect={(date) => setFormValue(tier, interval, "discountExpiresAt", date || null)}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>

                                {hasExistingLink && (
                                  <>
                                    <Badge className="bg-green-100 text-green-700">Attivo</Badge>
                                    <div className="flex items-center gap-1 flex-1 min-w-0">
                                      <Input
                                        value={existingLink.paymentLinkUrl || ""}
                                        readOnly
                                        className="text-xs font-mono flex-1"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => copyDirectLinkUrl(existingLink.paymentLinkUrl!, linkKey)}
                                      >
                                        {copiedDirectLink === linkKey ? (
                                          <Check className="h-4 w-4 text-green-500" />
                                        ) : (
                                          <Copy className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  </>
                                )}

                                {!hasExistingLink ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handleGenerateDirectLink(tier, interval)}
                                    disabled={directLinkMutation.isPending}
                                    className="gap-1"
                                  >
                                    {directLinkMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Plus className="h-4 w-4" />
                                    )}
                                    Genera Link
                                  </Button>
                                ) : showUpdateButton ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => handleGenerateDirectLink(tier, interval)}
                                    disabled={directLinkMutation.isPending}
                                    className="gap-1"
                                  >
                                    {directLinkMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                    Aggiorna Link
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}

                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Questi link vengono usati per gli upgrade in-app quando un utente ha acquistato da Direct Link. 
                        Ricevi il 100% della commissione su questi pagamenti.
                      </AlertDescription>
                    </Alert>
                  </>
                )}
              </CardContent>
            </Card>

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
                                onClick={() => openEditDialog(automation)}
                                title="Modifica"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
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

      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) {
          setEditingAutomation(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingAutomation ? (
                <>
                  <Pencil className="h-5 w-5" />
                  Modifica Automazione
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5" />
                  Nuova Automazione
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingAutomation 
                ? "Modifica le impostazioni dell'automazione"
                : "Configura come creare automaticamente gli utenti quando ricevi un pagamento"
              }
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
              <p className="text-xs text-muted-foreground">
                Puoi selezionare uno o entrambi i ruoli. Se selezioni entrambi, l'utente potra' passare da una modalita' all'altra.
              </p>
              <div className="space-y-1">
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
                <p className="text-xs text-muted-foreground ml-6">
                  L'utente diventa tuo cliente e vedra' la dashboard cliente con esercizi, libreria, AI assistant, ecc.
                </p>
              </div>
              <div className="space-y-1">
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
                <p className="text-xs text-muted-foreground ml-6">
                  L'utente diventa un consulente indipendente con la propria dashboard per gestire i suoi clienti.
                </p>
              </div>
            </div>

            <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
              <Label>Livello Abbonamento</Label>
              <p className="text-xs text-muted-foreground">
                {formData.createAsClient || formData.createAsConsultant
                  ? "Determina quali funzionalita' l'utente potra' utilizzare nella sua area riservata."
                  : "Puoi assegnare solo un livello senza ruoli. L'utente avra' accesso alla pagina Manager per gestire i dipendenti AI."
                }
              </p>
              <Select 
                value={formData.clientLevel} 
                onValueChange={(value) => setFormData({ ...formData, clientLevel: value as typeof formData.clientLevel })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona livello..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <div className="flex flex-col">
                      <span>Nessun livello</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="bronze">
                    <div className="flex flex-col">
                      <span>Bronze (Base)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="silver">
                    <div className="flex flex-col">
                      <span>Silver (Intermedio)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="gold">
                    <div className="flex flex-col">
                      <span>Gold (Completo)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground space-y-1 mt-2 p-2 bg-background rounded border">
                <p><strong>Nessun livello:</strong> Solo i ruoli assegnati sopra, senza abbonamento AI</p>
                <p><strong>Bronze:</strong> Accesso base alla dashboard cliente (gratuito/entry level)</p>
                <p><strong>Silver:</strong> Bronze + messaggi illimitati ai tuoi dipendenti/assistenti</p>
                <p><strong>Gold:</strong> Tutte le funzionalita' complete della piattaforma</p>
                {!formData.createAsClient && !formData.createAsConsultant && formData.clientLevel && formData.clientLevel !== "none" && (
                  <p className="mt-2 pt-2 border-t text-amber-600 dark:text-amber-400">
                    <strong>Nota:</strong> Senza ruoli, l'utente avra' accesso solo alla pagina Manager per gestire i dipendenti AI.
                  </p>
                )}
              </div>
            </div>

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
              onClick={() => {
                if (editingAutomation) {
                  updateMutation.mutate({ id: editingAutomation.id, ...formData });
                } else {
                  createMutation.mutate(formData);
                }
              }}
              disabled={!formData.linkName || !formData.stripePaymentLinkId || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editingAutomation ? "Salvataggio..." : "Creazione..."}
                </>
              ) : (
                <>
                  {editingAutomation ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Salva Modifiche
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Crea Automazione
                    </>
                  )}
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
