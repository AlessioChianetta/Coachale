import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Megaphone,
  Plus,
  TrendingUp,
  Users,
  MousePointer,
  DollarSign,
  Eye,
  Target,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Zap,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

interface Campaign {
  id: string;
  name: string;
  status: "attiva" | "in_pausa" | "completata" | "bozza";
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
  cpl: number;
}

export default function ContentStudioCampaigns() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("hook");

  const demoCampaigns: Campaign[] = [
    {
      id: "1",
      name: "[DEMO] Lead Gen Gennaio 2025",
      status: "attiva",
      spend: 1250,
      impressions: 45200,
      clicks: 1446,
      leads: 47,
      ctr: 3.2,
      cpl: 26.6,
    },
    {
      id: "2",
      name: "[DEMO] Promo Corso Online",
      status: "attiva",
      spend: 850,
      impressions: 32100,
      clicks: 963,
      leads: 28,
      ctr: 3.0,
      cpl: 30.36,
    },
    {
      id: "3",
      name: "[DEMO] Retargeting Carrello",
      status: "in_pausa",
      spend: 420,
      impressions: 18500,
      clicks: 555,
      leads: 12,
      ctr: 3.0,
      cpl: 35.0,
    },
    {
      id: "4",
      name: "[DEMO] Black Friday 2024",
      status: "completata",
      spend: 2800,
      impressions: 125000,
      clicks: 5000,
      leads: 156,
      ctr: 4.0,
      cpl: 17.95,
    },
    {
      id: "5",
      name: "[DEMO] Lancio Nuovo Servizio",
      status: "bozza",
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
      ctr: 0,
      cpl: 0,
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "attiva":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Attiva
          </Badge>
        );
      case "in_pausa":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-300">
            <AlertCircle className="h-3 w-3 mr-1" />
            In Pausa
          </Badge>
        );
      case "completata":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 border-blue-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completata
          </Badge>
        );
      case "bozza":
        return (
          <Badge variant="secondary">
            Bozza
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("it-IT").format(value);
  };

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
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  [DEMO] Dati di Esempio
                </Badge>
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
                        <TabsTrigger value="hook">Hook</TabsTrigger>
                        <TabsTrigger value="target">Target</TabsTrigger>
                        <TabsTrigger value="problema">Problema</TabsTrigger>
                        <TabsTrigger value="soluzione">Soluzione</TabsTrigger>
                        <TabsTrigger value="prova">Prova</TabsTrigger>
                        <TabsTrigger value="cta">CTA</TabsTrigger>
                      </TabsList>

                      <TabsContent value="hook" className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="hook_text">Hook Principale</Label>
                          <Textarea
                            id="hook_text"
                            placeholder="La frase che cattura l'attenzione..."
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="hook_visual">Descrizione Visual</Label>
                          <Input
                            id="hook_visual"
                            placeholder="Tipo di immagine/video per l'hook..."
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="target" className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="target_demographics">Demografia</Label>
                          <Input
                            id="target_demographics"
                            placeholder="Es: Donne 25-45, Italia..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="target_interests">Interessi</Label>
                          <Textarea
                            id="target_interests"
                            placeholder="Fitness, Benessere, Nutrizione..."
                            rows={2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="target_behaviors">Comportamenti</Label>
                          <Input
                            id="target_behaviors"
                            placeholder="Acquirenti online, follower influencer..."
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="problema" className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="problema_description">
                            Descrizione del Problema
                          </Label>
                          <Textarea
                            id="problema_description"
                            placeholder="Quale problema risolvi per il tuo cliente ideale?"
                            rows={4}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="problema_pain_points">Pain Points</Label>
                          <Textarea
                            id="problema_pain_points"
                            placeholder="Elenca i punti di dolore principali..."
                            rows={3}
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="soluzione" className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="soluzione_description">
                            La Tua Soluzione
                          </Label>
                          <Textarea
                            id="soluzione_description"
                            placeholder="Come risolvi il problema?"
                            rows={4}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="soluzione_benefits">Benefici Chiave</Label>
                          <Textarea
                            id="soluzione_benefits"
                            placeholder="I 3-5 benefici principali..."
                            rows={3}
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="prova" className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="prova_social">Prova Sociale</Label>
                          <Textarea
                            id="prova_social"
                            placeholder="Testimonianze, numeri, risultati..."
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="prova_credentials">Credenziali</Label>
                          <Input
                            id="prova_credentials"
                            placeholder="Certificazioni, anni di esperienza..."
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="cta" className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="cta_text">Testo CTA</Label>
                          <Input
                            id="cta_text"
                            placeholder="Prenota ora, Scopri di più..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cta_url">URL Destinazione</Label>
                          <Input
                            id="cta_url"
                            type="url"
                            placeholder="https://..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cta_urgency">Elemento di Urgenza</Label>
                          <Input
                            id="cta_urgency"
                            placeholder="Solo per oggi, Ultimi 5 posti..."
                          />
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="flex gap-2 pt-4 border-t">
                      <Button variant="outline" className="flex-1">
                        Salva Bozza
                      </Button>
                      <Button className="flex-1">
                        <Zap className="h-4 w-4 mr-2" />
                        Crea Campagna
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-green-500/10 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <Users className="h-5 w-5" />
                    <span className="text-sm font-medium">[DEMO] Lead Totali</span>
                  </div>
                  <p className="text-2xl font-bold">243</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-500/10 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-blue-600 mb-2">
                    <DollarSign className="h-5 w-5" />
                    <span className="text-sm font-medium">[DEMO] Spesa Totale</span>
                  </div>
                  <p className="text-2xl font-bold">€5,320</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-500/10 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-purple-600 mb-2">
                    <MousePointer className="h-5 w-5" />
                    <span className="text-sm font-medium">[DEMO] CTR Medio</span>
                  </div>
                  <p className="text-2xl font-bold">3.3%</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-500/10 to-transparent">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-amber-600 mb-2">
                    <Target className="h-5 w-5" />
                    <span className="text-sm font-medium">[DEMO] CPL Medio</span>
                  </div>
                  <p className="text-2xl font-bold">€21.89</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {demoCampaigns.map((campaign) => (
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
                          <p className="font-semibold text-green-600">{campaign.leads}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">CTR</p>
                          <p className="font-semibold">{campaign.ctr}%</p>
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
                        <Button variant="ghost" size="sm">
                          Modifica
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
