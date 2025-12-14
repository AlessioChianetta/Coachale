import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Loader2,
  UserPlus,
  Megaphone,
  Zap,
  Check,
  Circle,
  MessageSquare,
  FileText,
  BarChart3,
  Target,
  Users,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Bot,
} from "lucide-react";
import { NavigationTabs } from "@/components/ui/navigation-tabs";
import { CampaignsList } from "@/components/campaigns/CampaignsList";
import { CampaignForm } from "@/components/campaigns/CampaignForm";
import CampaignDetailAnalytics from "@/components/campaigns/CampaignDetailAnalytics";
import {
  useCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  useDeleteCampaign,
} from "@/hooks/useCampaigns";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { MarketingCampaign } from "@db/schema";

interface WhatsAppAgent {
  id: string;
  agentName: string;
  twilioWhatsappNumber: string;
  isProactiveAgent?: boolean;
}

interface CustomTemplate {
  id: string;
  name: string;
  status: string;
}

export default function ConsultantCampaignsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAnalyticsDialogOpen, setIsAnalyticsDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingCampaign | null>(null);
  const [analyticsCampaign, setAnalyticsCampaign] = useState<MarketingCampaign | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const { data: campaignsData, isLoading } = useCampaigns();
  const createMutation = useCreateCampaign();
  const updateMutation = useUpdateCampaign(selectedCampaign?.id || "");
  const deleteMutation = useDeleteCampaign();

  const campaigns = campaignsData?.campaigns || [];

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ["/api/whatsapp/config/proactive"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/config/proactive", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return { configs: [] };
        throw new Error("Failed to fetch WhatsApp agents");
      }
      return response.json();
    },
  });

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ["/api/whatsapp/custom-templates"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/custom-templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return { templates: [] };
        throw new Error("Failed to fetch templates");
      }
      return response.json();
    },
  });

  const agents: WhatsAppAgent[] = agentsData?.configs || [];
  const templates: CustomTemplate[] = templatesData?.templates || [];

  const hasActiveAgent = agents.length > 0;
  const hasTemplates = templates.length > 0;
  const hasCampaigns = campaigns.length > 0;

  const totalLeads = campaigns.reduce((sum, c) => sum + (c.totalLeads || 0), 0);
  const convertedLeads = campaigns.reduce((sum, c) => sum + (c.convertedLeads || 0), 0);
  const avgConversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : "0.0";
  const activeCampaigns = campaigns.filter((c) => c.isActive).length;

  const handleCreateCampaign = (data: any) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        setIsCreateDialogOpen(false);
      },
    });
  };

  const handleUpdateCampaign = (data: any) => {
    if (selectedCampaign) {
      updateMutation.mutate(data, {
        onSuccess: () => {
          setIsEditDialogOpen(false);
          setSelectedCampaign(null);
        },
      });
    }
  };

  const handleEditClick = (campaign: MarketingCampaign) => {
    setSelectedCampaign(campaign);
    setIsEditDialogOpen(true);
  };

  const handleDeleteCampaign = (campaign: MarketingCampaign) => {
    deleteMutation.mutate(campaign.id);
  };

  const handleViewAnalytics = (campaign: MarketingCampaign) => {
    setAnalyticsCampaign(campaign);
    setIsAnalyticsDialogOpen(true);
  };

  const handleCreateClick = () => {
    if (!hasActiveAgent) {
      setShowWarning(true);
    } else {
      setIsCreateDialogOpen(true);
    }
  };

  const guidedSteps = [
    {
      number: 1,
      title: "Configura Agente WhatsApp",
      description: "Imposta il tuo agente AI per gestire le conversazioni",
      href: "/consultant/whatsapp-agent-config",
      isComplete: hasActiveAgent,
      icon: Bot,
    },
    {
      number: 2,
      title: "Crea Template Messaggi",
      description: "Prepara i template per le tue campagne",
      href: "/consultant/whatsapp/custom-templates",
      isComplete: hasTemplates,
      icon: FileText,
    },
    {
      number: 3,
      title: "Crea Campagna",
      description: "Lancia la tua campagna di marketing",
      href: "/consultant/campaigns",
      isComplete: hasCampaigns,
      icon: Megaphone,
      isCurrent: true,
    },
  ];

  const isSetupComplete = hasActiveAgent && hasTemplates;

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />}
      <div className="flex">
        {isMobile ? (
          <Sidebar
            role="consultant"
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        ) : (
          <Sidebar role="consultant" />
        )}

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <NavigationTabs
              tabs={[
                { label: "Lead Proattivi", href: "/consultant/proactive-leads", icon: UserPlus },
                { label: "Campagne", href: "/consultant/campaigns", icon: Megaphone },
                { label: "Automazioni", href: "/consultant/automations", icon: Zap },
              ]}
            />

            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 p-6 md:p-8 text-white shadow-xl">
              <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.5))]" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                    Campagne Marketing
                  </h1>
                  <p className="mt-2 text-white/80 text-lg">
                    Gestisci le tue campagne di lead generation e marketing automation
                  </p>
                </div>
                <Button
                  onClick={handleCreateClick}
                  size="lg"
                  className="bg-white text-purple-700 hover:bg-white/90 font-semibold shadow-lg"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nuova Campagna
                </Button>
              </div>
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -left-10 -top-10 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
            </div>

            {!isSetupComplete && (
              <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5 text-primary" />
                    Flusso Guidato - Configura le tue Campagne
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {guidedSteps.map((step, index) => {
                      const StepIcon = step.icon;
                      const isActive = !guidedSteps.slice(0, index).some((s) => !s.isComplete);
                      
                      return (
                        <div
                          key={step.number}
                          className={cn(
                            "relative rounded-xl border p-4 transition-all duration-200",
                            step.isComplete
                              ? "border-green-500/50 bg-green-50 dark:bg-green-950/20"
                              : step.isCurrent && isActive
                              ? "border-primary shadow-md ring-2 ring-primary/20"
                              : isActive
                              ? "border-muted-foreground/30 hover:border-primary/50 hover:shadow-sm"
                              : "border-muted opacity-60"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm",
                                step.isComplete
                                  ? "bg-green-500 text-white"
                                  : step.isCurrent && isActive
                                  ? "bg-primary text-primary-foreground"
                                  : isActive
                                  ? "bg-muted-foreground/20 text-muted-foreground"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {step.isComplete ? (
                                <Check className="h-5 w-5" />
                              ) : (
                                <StepIcon className="h-5 w-5" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Step {step.number}
                                </span>
                                {step.isComplete && (
                                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    Completato
                                  </span>
                                )}
                              </div>
                              <h4 className="font-semibold text-foreground mt-0.5">
                                {step.title}
                              </h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {step.description}
                              </p>
                              {!step.isComplete && !step.isCurrent && isActive && (
                                <Link href={step.href}>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="h-auto p-0 mt-2 text-primary"
                                  >
                                    Configura ora
                                    <ArrowRight className="h-3 w-3 ml-1" />
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </div>
                          {index < guidedSteps.length - 1 && (
                            <div className="absolute -right-4 top-1/2 hidden md:block">
                              <ArrowRight
                                className={cn(
                                  "h-4 w-4",
                                  step.isComplete ? "text-green-500" : "text-muted-foreground/30"
                                )}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-4">
              <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background border-blue-200/50 dark:border-blue-800/30">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/30">
                      <Megaphone className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Campagne Totali</p>
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {campaigns.length}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {activeCampaigns} attive
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background border-green-200/50 dark:border-green-800/30">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500 text-white shadow-lg shadow-green-500/30">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Lead Totali</p>
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {totalLeads}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    da tutte le campagne
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background border-purple-200/50 dark:border-purple-800/30">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500 text-white shadow-lg shadow-purple-500/30">
                      <Target className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Lead Convertiti</p>
                      <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {convertedLeads}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    clienti acquisiti
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/20 dark:to-background border-orange-200/50 dark:border-orange-800/30">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/30">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Tasso Conversione</p>
                      <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                        {avgConversionRate}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    media globale
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-lg border-0 bg-card">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Le Tue Campagne
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <CampaignsList
                  campaigns={campaigns}
                  isLoading={isLoading}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteCampaign}
                  onViewAnalytics={handleViewAnalytics}
                />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 mb-4">
              <AlertTriangle className="h-7 w-7 text-yellow-600 dark:text-yellow-400" />
            </div>
            <DialogTitle className="text-center">Configurazione Richiesta</DialogTitle>
            <DialogDescription className="text-center">
              Per creare una campagna, devi prima configurare un agente WhatsApp attivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-900/30 dark:bg-yellow-950/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800 dark:text-yellow-400">
                Step mancante
              </AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-500">
                L'agente WhatsApp è necessario per inviare messaggi automatici ai lead della campagna.
              </AlertDescription>
            </Alert>
            <div className="flex flex-col gap-2">
              <Link href="/consultant/whatsapp-agent-config">
                <Button className="w-full" size="lg">
                  <Bot className="h-4 w-4 mr-2" />
                  Configura Agente WhatsApp
                </Button>
              </Link>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowWarning(false);
                  setIsCreateDialogOpen(true);
                }}
              >
                Continua comunque senza agente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crea Nuova Campagna</DialogTitle>
            <DialogDescription>
              Configura una nuova campagna di marketing per i tuoi lead
            </DialogDescription>
          </DialogHeader>
          {!hasActiveAgent && (
            <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-900/30 dark:bg-yellow-950/20 mb-4">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800 dark:text-yellow-400">
                Attenzione
              </AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-500">
                Non hai configurato un agente WhatsApp. I messaggi automatici non saranno inviati ai lead.
              </AlertDescription>
            </Alert>
          )}
          <CampaignForm
            onSubmit={handleCreateCampaign}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Campagna</DialogTitle>
            <DialogDescription>
              Aggiorna le impostazioni della campagna
            </DialogDescription>
          </DialogHeader>
          {selectedCampaign && (
            <CampaignForm
              initialData={selectedCampaign}
              onSubmit={handleUpdateCampaign}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAnalyticsDialogOpen} onOpenChange={setIsAnalyticsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Analytics Campagna</DialogTitle>
            <DialogDescription>
              Visualizza le metriche e le performance della campagna
            </DialogDescription>
          </DialogHeader>
          {analyticsCampaign && (
            <CampaignDetailAnalytics
              campaignId={analyticsCampaign.id}
              campaignName={analyticsCampaign.campaignName}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConsultantAIAssistant />
    </div>
  );
}
