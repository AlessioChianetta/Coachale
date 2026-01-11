import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Megaphone,
  Plus,
  TrendingUp,
  Users,
  MousePointer,
  DollarSign,
  Target,
  AlertCircle,
  CheckCircle,
  Zap,
  Loader2,
  Trash2,
  Sparkles,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
  cpl: number;
  hook?: string;
  targetDemographics?: string;
  targetInterests?: string;
  problemDescription?: string;
  solutionDescription?: string;
  socialProof?: string;
  ctaText?: string;
  ctaUrl?: string;
}

export default function ContentStudioCampaigns() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    objective: "",
    productOrService: "",
    targetAudience: "",
    hook: "",
    targetDemographics: "",
    targetInterests: "",
    problemDescription: "",
    solutionDescription: "",
    socialProof: "",
    ctaText: "",
    ctaUrl: "",
    status: "bozza",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: campaignsResponse, isLoading } = useQuery({
    queryKey: ["/api/content/campaigns"],
    queryFn: async () => {
      const response = await fetch("/api/content/campaigns", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch campaigns");
      return response.json();
    },
  });

  const campaigns: Campaign[] = campaignsResponse?.data || [];

  const createCampaignMutation = useMutation({
    mutationFn: async (campaign: Partial<Campaign>) => {
      const response = await fetch("/api/content/campaigns", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(campaign),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create campaign");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Campagna creata",
        description: "La campagna è stata creata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/campaigns"] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`/api/content/campaigns/${campaignId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete campaign");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Campagna eliminata",
        description: "La campagna è stata eliminata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/campaigns"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerateCampaign = async () => {
    if (!formData.productOrService || !formData.targetAudience || !formData.objective) {
      toast({
        title: "Campi obbligatori",
        description: "Compila prodotto/servizio, target audience e obiettivo",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/content/ai/generate-campaign", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productOrService: formData.productOrService,
          targetAudience: formData.targetAudience,
          objective: formData.objective,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate campaign");
      }

      const result = await response.json();
      const generated = result.data.campaign;

      setFormData((prev) => ({
        ...prev,
        name: generated.name || prev.name,
        hook: generated.hook || prev.hook,
        targetDemographics: generated.targetDemographics || prev.targetDemographics,
        targetInterests: generated.targetInterests || prev.targetInterests,
        problemDescription: generated.problemDescription || prev.problemDescription,
        solutionDescription: generated.solutionDescription || prev.solutionDescription,
        socialProof: generated.socialProof || prev.socialProof,
        ctaText: generated.ctaText || prev.ctaText,
      }));

      toast({
        title: "Campagna generata!",
        description: "I contenuti della campagna sono stati generati con AI",
      });
    } catch (error: any) {
      toast({
        title: "Errore nella generazione",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      objective: "",
      productOrService: "",
      targetAudience: "",
      hook: "",
      targetDemographics: "",
      targetInterests: "",
      problemDescription: "",
      solutionDescription: "",
      socialProof: "",
      ctaText: "",
      ctaUrl: "",
      status: "bozza",
    });
    setActiveTab("basic");
  };

  const handleCreateCampaign = () => {
    if (!formData.name) {
      toast({
        title: "Nome obbligatorio",
        description: "Inserisci un nome per la campagna",
        variant: "destructive",
      });
      return;
    }
    createCampaignMutation.mutate(formData);
  };

  const getStatusBadge = (status: string) => {
    const lowerStatus = status?.toLowerCase();
    switch (lowerStatus) {
      case "attiva":
      case "active":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Attiva
          </Badge>
        );
      case "in_pausa":
      case "paused":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-300">
            <AlertCircle className="h-3 w-3 mr-1" />
            In Pausa
          </Badge>
        );
      case "completata":
      case "completed":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completata
          </Badge>
        );
      case "bozza":
      case "draft":
        return <Badge variant="secondary">Bozza</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(value || 0);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("it-IT").format(value || 0);
  };

  const totalLeads = campaigns.reduce((sum, c) => sum + (c.leads || 0), 0);
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
  const avgCtr = campaigns.length > 0
    ? campaigns.reduce((sum, c) => sum + (c.ctr || 0), 0) / campaigns.length
    : 0;
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                  <Megaphone className="h-8 w-8 text-purple-500" />
                  Campagne Pubblicitarie
                </h1>
                <p className="text-muted-foreground">
                  Gestisci le tue campagne di advertising
                </p>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuova Campagna
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Crea Nuova Campagna</DialogTitle>
                  </DialogHeader>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                    <TabsList className="grid grid-cols-6 w-full">
                      <TabsTrigger value="basic">Base</TabsTrigger>
                      <TabsTrigger value="hook">Hook</TabsTrigger>
                      <TabsTrigger value="target">Target</TabsTrigger>
                      <TabsTrigger value="problema">Problema</TabsTrigger>
                      <TabsTrigger value="soluzione">Soluzione</TabsTrigger>
                      <TabsTrigger value="cta">CTA</TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic" className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome Campagna</Label>
                        <Input
                          id="name"
                          placeholder="Es: Lead Gen Gennaio 2025"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Obiettivo</Label>
                        <Select
                          value={formData.objective}
                          onValueChange={(value) => setFormData({ ...formData, objective: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona obiettivo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="awareness">Brand Awareness</SelectItem>
                            <SelectItem value="engagement">Engagement</SelectItem>
                            <SelectItem value="leads">Lead Generation</SelectItem>
                            <SelectItem value="sales">Vendite</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="product">Prodotto/Servizio</Label>
                        <Input
                          id="product"
                          placeholder="Cosa stai promuovendo?"
                          value={formData.productOrService}
                          onChange={(e) => setFormData({ ...formData, productOrService: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="targetAudience">Target Audience</Label>
                        <Input
                          id="targetAudience"
                          placeholder="Es: Donne 25-45, interessate al fitness"
                          value={formData.targetAudience}
                          onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                        />
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleGenerateCampaign}
                        disabled={isGenerating}
                        className="w-full"
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Genera contenuti con AI
                      </Button>
                    </TabsContent>

                    <TabsContent value="hook" className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="hook_text">Hook Principale</Label>
                        <Textarea
                          id="hook_text"
                          placeholder="La frase che cattura l'attenzione..."
                          rows={3}
                          value={formData.hook}
                          onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="target" className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="target_demographics">Demografia</Label>
                        <Input
                          id="target_demographics"
                          placeholder="Es: Donne 25-45, Italia..."
                          value={formData.targetDemographics}
                          onChange={(e) => setFormData({ ...formData, targetDemographics: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="target_interests">Interessi</Label>
                        <Textarea
                          id="target_interests"
                          placeholder="Fitness, Benessere, Nutrizione..."
                          rows={2}
                          value={formData.targetInterests}
                          onChange={(e) => setFormData({ ...formData, targetInterests: e.target.value })}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="problema" className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="problema_description">Descrizione del Problema</Label>
                        <Textarea
                          id="problema_description"
                          placeholder="Quale problema risolvi per il tuo cliente ideale?"
                          rows={4}
                          value={formData.problemDescription}
                          onChange={(e) => setFormData({ ...formData, problemDescription: e.target.value })}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="soluzione" className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="soluzione_description">La Tua Soluzione</Label>
                        <Textarea
                          id="soluzione_description"
                          placeholder="Come risolvi il problema?"
                          rows={4}
                          value={formData.solutionDescription}
                          onChange={(e) => setFormData({ ...formData, solutionDescription: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prova_social">Prova Sociale</Label>
                        <Textarea
                          id="prova_social"
                          placeholder="Testimonianze, numeri, risultati..."
                          rows={3}
                          value={formData.socialProof}
                          onChange={(e) => setFormData({ ...formData, socialProof: e.target.value })}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="cta" className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="cta_text">Testo CTA</Label>
                        <Input
                          id="cta_text"
                          placeholder="Prenota ora, Scopri di più..."
                          value={formData.ctaText}
                          onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cta_url">URL Destinazione</Label>
                        <Input
                          id="cta_url"
                          type="url"
                          placeholder="https://..."
                          value={formData.ctaUrl}
                          onChange={(e) => setFormData({ ...formData, ctaUrl: e.target.value })}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setFormData({ ...formData, status: "bozza" });
                        handleCreateCampaign();
                      }}
                      disabled={createCampaignMutation.isPending}
                    >
                      Salva Bozza
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => {
                        setFormData({ ...formData, status: "attiva" });
                        handleCreateCampaign();
                      }}
                      disabled={createCampaignMutation.isPending}
                    >
                      {createCampaignMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      Crea Campagna
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-green-500/10 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <Users className="h-5 w-5" />
                    <span className="text-sm font-medium">Lead Totali</span>
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{totalLeads}</p>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-500/10 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <DollarSign className="h-5 w-5" />
                    <span className="text-sm font-medium">Spesa Totale</span>
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : (
                    <p className="text-2xl font-bold">{formatCurrency(totalSpend)}</p>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-500/10 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-purple-600 mb-2">
                    <MousePointer className="h-5 w-5" />
                    <span className="text-sm font-medium">CTR Medio</span>
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-8 w-14" />
                  ) : (
                    <p className="text-2xl font-bold">{avgCtr.toFixed(1)}%</p>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-500/10 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-amber-600 mb-2">
                    <Target className="h-5 w-5" />
                    <span className="text-sm font-medium">CPL Medio</span>
                  </div>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{formatCurrency(avgCpl)}</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-lg" />
                        <div className="flex-1">
                          <Skeleton className="h-5 w-48 mb-2" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : campaigns.length > 0 ? (
              <div className="space-y-4">
                {campaigns.map((campaign) => (
                  <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-purple-500/10">
                            <Megaphone className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{campaign.name}</h3>
                            <div className="mt-1">{getStatusBadge(campaign.status)}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground">Spesa</p>
                            <p className="font-semibold">{formatCurrency(campaign.spend)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Impressioni</p>
                            <p className="font-semibold">{formatNumber(campaign.impressions)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Click</p>
                            <p className="font-semibold">{formatNumber(campaign.clicks)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Lead</p>
                            <p className="font-semibold text-green-600">{campaign.leads || 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">CTR</p>
                            <p className="font-semibold">{campaign.ctr || 0}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">CPL</p>
                            <p className="font-semibold">{formatCurrency(campaign.cpl)}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            Dettagli
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Nessuna campagna creata</h3>
                  <p className="text-muted-foreground mb-4">
                    Crea la tua prima campagna cliccando il pulsante "Nuova Campagna"
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
