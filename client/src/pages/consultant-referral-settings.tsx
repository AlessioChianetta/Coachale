import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Save,
  Loader2,
  Layout,
  Gift,
  Settings,
  Eye,
  Sparkles,
  MessageSquare,
  Palette,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";

interface ReferralLandingConfig {
  headline: string;
  description: string;
  bonusText: string;
  ctaButtonText: string;
  primaryColor: string;
  showAiChat: boolean;
  bonusType: "discount_percentage" | "free_consultation" | "credit" | "months_free" | "cash" | "physical" | "none";
  bonusValue: string;
  maxUsesPerCode: number;
  isActive: boolean;
  welcomeMessage: string;
  bonusDescription: string;
  preferredChannel: "email" | "whatsapp" | "call" | "all";
  agentConfigId: string | null;
  defaultCampaignId: string | null;
}

const defaultFormData: ReferralLandingConfig = {
  headline: "Inizia il tuo percorso con me",
  description: "Sono qui per aiutarti a raggiungere i tuoi obiettivi.",
  bonusText: "Una consulenza gratuita",
  ctaButtonText: "Richiedi il tuo bonus",
  primaryColor: "#6366f1",
  showAiChat: true,
  bonusType: "free_consultation",
  bonusValue: "",
  maxUsesPerCode: 10,
  isActive: true,
  welcomeMessage: "Ciao! Come posso aiutarti oggi?",
  bonusDescription: "",
  preferredChannel: "all",
  agentConfigId: null,
  defaultCampaignId: null,
};

export default function ConsultantReferralSettingsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("landing");

  const [formData, setFormData] = useState<ReferralLandingConfig>(defaultFormData);

  const { data: configData, isLoading } = useQuery({
    queryKey: ["/api/consultant/referral-landing"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/referral-landing", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Errore nel caricamento della configurazione");
      }
      return response.json();
    },
  });

  const { data: agentsData } = useQuery({
    queryKey: ["/api/consultant/whatsapp-agents"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/whatsapp-agents", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { agents: [] };
      return response.json();
    },
  });

  const { data: campaignsData } = useQuery({
    queryKey: ["/api/consultant/campaigns"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/campaigns", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { campaigns: [] };
      return response.json();
    },
  });

  const agents = agentsData?.agents || [];
  const campaigns = campaignsData?.campaigns || [];

  useEffect(() => {
    if (configData?.config) {
      const config = configData.config;
      setFormData({
        headline: config.headline || defaultFormData.headline,
        description: config.description || defaultFormData.description,
        bonusText: config.bonusText || defaultFormData.bonusText,
        ctaButtonText: config.ctaButtonText || defaultFormData.ctaButtonText,
        primaryColor: config.accentColor || defaultFormData.primaryColor,
        showAiChat: config.showAiChat ?? defaultFormData.showAiChat,
        bonusType: config.bonusType || defaultFormData.bonusType,
        bonusValue: config.bonusValue || defaultFormData.bonusValue,
        maxUsesPerCode: config.maxUsesPerCode || defaultFormData.maxUsesPerCode,
        isActive: config.isActive ?? defaultFormData.isActive,
        welcomeMessage: config.welcomeMessage || defaultFormData.welcomeMessage,
        bonusDescription: config.bonusDescription || defaultFormData.bonusDescription,
        preferredChannel: config.preferredChannel || defaultFormData.preferredChannel,
        agentConfigId: config.agentConfigId || null,
        defaultCampaignId: config.defaultCampaignId || null,
      });
    }
  }, [configData]);

  const saveMutation = useMutation({
    mutationFn: async (data: ReferralLandingConfig) => {
      const payload = {
        headline: data.headline,
        description: data.description,
        bonusText: data.bonusText,
        ctaButtonText: data.ctaButtonText,
        accentColor: data.primaryColor,
        showAiChat: data.showAiChat,
        bonusType: data.bonusType,
        bonusValue: data.bonusValue,
        maxUsesPerCode: data.maxUsesPerCode,
        isActive: data.isActive,
        welcomeMessage: data.welcomeMessage,
        bonusDescription: data.bonusDescription,
        preferredChannel: data.preferredChannel,
        agentConfigId: data.agentConfigId,
        defaultCampaignId: data.defaultCampaignId,
      };

      const response = await fetch("/api/consultant/referral-landing", {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Errore nel salvataggio");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/referral-landing"] });
      toast({
        title: "Impostazioni salvate",
        description: "La configurazione referral è stata aggiornata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio delle impostazioni",
        variant: "destructive",
      });
    },
  });

  const updateField = <K extends keyof ReferralLandingConfig>(field: K, value: ReferralLandingConfig[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const LandingPreview = () => (
    <div 
      className="rounded-2xl border bg-white shadow-lg overflow-hidden"
      style={{ minHeight: "400px" }}
    >
      <div 
        className="p-6 text-white"
        style={{ backgroundColor: formData.primaryColor }}
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{formData.headline || "Il tuo titolo"}</h2>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-slate-600">
          {formData.description || "La tua descrizione apparirà qui..."}
        </p>
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Gift className="h-6 w-6 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-900">Il tuo bonus</p>
              <p className="text-amber-700">{formData.bonusText || "Bonus non definito"}</p>
            </div>
          </div>
        </div>
        <Button 
          className="w-full text-white"
          style={{ backgroundColor: formData.primaryColor }}
        >
          {formData.ctaButtonText || "Richiedi il tuo bonus"}
        </Button>
        {formData.showAiChat && (
          <div className="mt-4 p-4 bg-slate-50 rounded-xl border">
            <div className="flex items-center gap-2 text-slate-600">
              <MessageSquare className="h-5 w-5" />
              <span className="text-sm">Chat AI attiva</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-600">Caricamento impostazioni...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="mb-8">
            <div className="bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 rounded-3xl p-8 text-white shadow-2xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => setLocation("/consultant/referrals")}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                    <Gift className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold">Impostazioni Referral</h1>
                    <p className="text-purple-100 text-lg">
                      Configura la landing page e il sistema di bonus
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="bg-white text-purple-600 hover:bg-purple-50"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-5 w-5" />
                      Salva
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 h-12">
                <TabsTrigger value="landing" className="flex items-center gap-2">
                  <Layout className="h-4 w-4" />
                  <span className="hidden sm:inline">Landing Page</span>
                </TabsTrigger>
                <TabsTrigger value="bonus" className="flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  <span className="hidden sm:inline">Configurazione Bonus</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Impostazioni Generali</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="landing" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Layout className="h-6 w-6" />
                        Editor Landing Page
                      </CardTitle>
                      <CardDescription>
                        Personalizza il contenuto della tua landing page referral
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="headline">
                          Titolo <span className="text-xs text-slate-500">(max 100 caratteri)</span>
                        </Label>
                        <Input
                          id="headline"
                          placeholder="Inizia il tuo percorso con me"
                          value={formData.headline}
                          onChange={(e) => updateField("headline", e.target.value.slice(0, 100))}
                          maxLength={100}
                        />
                        <p className="text-xs text-slate-500 text-right">
                          {formData.headline.length}/100
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">
                          Descrizione <span className="text-xs text-slate-500">(max 500 caratteri)</span>
                        </Label>
                        <Textarea
                          id="description"
                          placeholder="Sono qui per aiutarti a raggiungere i tuoi obiettivi..."
                          value={formData.description}
                          onChange={(e) => updateField("description", e.target.value.slice(0, 500))}
                          rows={4}
                          maxLength={500}
                        />
                        <p className="text-xs text-slate-500 text-right">
                          {formData.description.length}/500
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bonusText">Testo Bonus</Label>
                        <Input
                          id="bonusText"
                          placeholder="Una consulenza gratuita"
                          value={formData.bonusText}
                          onChange={(e) => updateField("bonusText", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="ctaButtonText">Testo Pulsante CTA</Label>
                        <Input
                          id="ctaButtonText"
                          placeholder="Richiedi il tuo bonus"
                          value={formData.ctaButtonText}
                          onChange={(e) => updateField("ctaButtonText", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="primaryColor" className="flex items-center gap-2">
                          <Palette className="h-4 w-4" />
                          Colore Primario
                        </Label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            id="primaryColor"
                            value={formData.primaryColor}
                            onChange={(e) => updateField("primaryColor", e.target.value)}
                            className="w-12 h-10 rounded border cursor-pointer"
                          />
                          <Input
                            value={formData.primaryColor}
                            onChange={(e) => updateField("primaryColor", e.target.value)}
                            placeholder="#6366f1"
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                        <div className="space-y-0.5">
                          <Label htmlFor="showAiChat" className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Mostra Chat AI
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Abilita la chat AI sulla landing page
                          </p>
                        </div>
                        <Checkbox
                          id="showAiChat"
                          checked={formData.showAiChat}
                          onCheckedChange={(checked) => updateField("showAiChat", checked as boolean)}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="h-6 w-6" />
                        Anteprima Live
                      </CardTitle>
                      <CardDescription>
                        Visualizza in tempo reale come apparirà la tua landing page
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <LandingPreview />
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="bonus" className="space-y-6">
                <Card className="border-0 shadow-lg max-w-2xl mx-auto">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gift className="h-6 w-6" />
                      Configurazione Bonus
                    </CardTitle>
                    <CardDescription>
                      Definisci il tipo di bonus per chi porta nuovi clienti
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="bonusType">Tipo di Bonus</Label>
                      <Select
                        value={formData.bonusType}
                        onValueChange={(value: any) => updateField("bonusType", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona il tipo di bonus" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="discount_percentage">Sconto Percentuale</SelectItem>
                          <SelectItem value="free_consultation">Consulenza Gratuita</SelectItem>
                          <SelectItem value="credit">Credito</SelectItem>
                          <SelectItem value="months_free">Mesi Gratuiti</SelectItem>
                          <SelectItem value="cash">Contanti</SelectItem>
                          <SelectItem value="physical">Premio Fisico</SelectItem>
                          <SelectItem value="none">Nessun Bonus</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bonusValue">Valore Bonus</Label>
                      <Input
                        id="bonusValue"
                        placeholder="Es: 20%, 50€, 1 mese"
                        value={formData.bonusValue}
                        onChange={(e) => updateField("bonusValue", e.target.value)}
                      />
                      <p className="text-xs text-slate-500">
                        Inserisci il valore del bonus (es: "20" per 20%, "50" per 50€)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bonusDescription">Descrizione Bonus</Label>
                      <Textarea
                        id="bonusDescription"
                        placeholder="Descrivi i dettagli del bonus..."
                        value={formData.bonusDescription}
                        onChange={(e) => updateField("bonusDescription", e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxUsesPerCode">Utilizzi Massimi per Codice</Label>
                      <Input
                        id="maxUsesPerCode"
                        type="number"
                        min={1}
                        placeholder="10"
                        value={formData.maxUsesPerCode}
                        onChange={(e) => updateField("maxUsesPerCode", parseInt(e.target.value) || 10)}
                      />
                      <p className="text-xs text-slate-500">
                        Numero massimo di volte che un singolo codice può essere utilizzato
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6">
                <Card className="border-0 shadow-lg max-w-2xl mx-auto">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-6 w-6" />
                      Impostazioni Generali
                    </CardTitle>
                    <CardDescription>
                      Configura le impostazioni generali del sistema referral
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                      <div className="space-y-0.5">
                        <Label htmlFor="isActive" className="font-semibold">Sistema Referral Attivo</Label>
                        <p className="text-sm text-muted-foreground">
                          Abilita o disabilita il sistema di referral
                        </p>
                      </div>
                      <Switch
                        id="isActive"
                        checked={formData.isActive}
                        onCheckedChange={(checked) => updateField("isActive", checked)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="preferredChannel">Canale Preferito</Label>
                      <Select
                        value={formData.preferredChannel}
                        onValueChange={(value: any) => updateField("preferredChannel", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona il canale preferito" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutti i canali</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="call">Telefonata</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">
                        Come preferisci essere contattato dai nuovi lead
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="agentConfigId">Agente WhatsApp per Lead</Label>
                      <Select
                        value={formData.agentConfigId || "none"}
                        onValueChange={(value) => updateField("agentConfigId", value === "none" ? null : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona l'agente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nessun agente</SelectItem>
                          {agents.map((agent: any) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.agentName || agent.businessName || "Agente senza nome"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">
                        L'agente WhatsApp che contatterà i lead generati dai referral
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="defaultCampaignId">Campagna di Default</Label>
                      <Select
                        value={formData.defaultCampaignId || "none"}
                        onValueChange={(value) => updateField("defaultCampaignId", value === "none" ? null : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona la campagna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nessuna campagna</SelectItem>
                          {campaigns.map((campaign: any) => (
                            <SelectItem key={campaign.id} value={campaign.id}>
                              {campaign.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">
                        La campagna associata ai lead referral (include obiettivi e desideri)
                      </p>
                    </div>

                    {formData.showAiChat && (
                      <div className="space-y-2">
                        <Label htmlFor="welcomeMessage" className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Messaggio di Benvenuto AI
                        </Label>
                        <Textarea
                          id="welcomeMessage"
                          placeholder="Ciao! Come posso aiutarti oggi?"
                          value={formData.welcomeMessage}
                          onChange={(e) => updateField("welcomeMessage", e.target.value)}
                          rows={4}
                        />
                        <p className="text-xs text-slate-500">
                          Questo messaggio verrà mostrato quando un utente apre la chat AI
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
