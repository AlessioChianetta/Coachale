import { useState, useEffect } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff, Loader2, RefreshCw, Clock, Calendar } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useExternalApiConfigs,
  useCreateExternalApiConfig,
  useUpdateExternalApiConfig,
  useTestConnection,
  useManualImport,
  useStartPolling,
  useStopPolling,
} from "@/hooks/useExternalApiConfig";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useToast } from "@/hooks/use-toast";

export default function ConsultantApiSettings() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();

  const [showApiKey, setShowApiKey] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [existingConfigId, setExistingConfigId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    configName: "Importazione Lead",
    apiKey: "",
    baseUrl: "",
    targetCampaignId: "",
    leadType: "both" as "crm" | "marketing" | "both",
    sourceFilter: "",
    campaignFilter: "",
    daysFilter: "",
    pollingIntervalMinutes: 5,
    pollingEnabled: false,
    isActive: true,
  });

  const { data: configs, isLoading: configsLoading } = useExternalApiConfigs();
  const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns();
  const createMutation = useCreateExternalApiConfig();
  const updateMutation = useUpdateExternalApiConfig(existingConfigId || "");
  const testMutation = useTestConnection();
  const importMutation = useManualImport();
  const startPollingMutation = useStartPolling();
  const stopPollingMutation = useStopPolling();

  const campaigns = campaignsData?.campaigns || [];
  const existingConfig = configs && configs.length > 0 ? configs[0] : null;

  // Fetch pending proactive leads
  const { data: pendingLeads, isLoading: pendingLeadsLoading } = useQuery({
    queryKey: ['/api/proactive-leads', { status: 'pending' }],
    queryFn: async () => {
      const response = await fetch('/api/proactive-leads?status=pending', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch pending leads');
      const data = await response.json();
      return data.leads || [];
    },
    refetchInterval: 30000 // Refresh ogni 30 secondi
  });

  useEffect(() => {
    if (existingConfig) {
      setExistingConfigId(existingConfig.id);
      setFormData({
        configName: existingConfig.configName,
        apiKey: "",
        baseUrl: existingConfig.baseUrl,
        targetCampaignId: existingConfig.targetCampaignId,
        leadType: existingConfig.leadType,
        sourceFilter: existingConfig.sourceFilter || "",
        campaignFilter: existingConfig.campaignFilter || "",
        daysFilter: existingConfig.daysFilter || "",
        pollingIntervalMinutes: existingConfig.pollingIntervalMinutes,
        pollingEnabled: existingConfig.pollingEnabled,
        isActive: existingConfig.isActive,
      });
    }
  }, [existingConfig]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!formData.apiKey && !existingConfig) {
      toast({
        title: "❌ Errore validazione",
        description: "API Key è obbligatoria",
        variant: "destructive",
      });
      return false;
    }

    if (formData.apiKey && formData.apiKey.length < 10) {
      toast({
        title: "❌ Errore validazione",
        description: "API Key deve contenere almeno 10 caratteri",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.baseUrl) {
      toast({
        title: "❌ Errore validazione",
        description: "Base URL è obbligatorio",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.baseUrl.startsWith("https://") && !formData.baseUrl.startsWith("http://")) {
      toast({
        title: "❌ Errore validazione",
        description: "Base URL deve iniziare con https:// o http://",
        variant: "destructive",
      });
      return false;
    }

    if (!formData.targetCampaignId) {
      toast({
        title: "❌ Errore validazione",
        description: "Campagna Marketing è obbligatoria",
        variant: "destructive",
      });
      return false;
    }

    if (formData.pollingIntervalMinutes < 1 || formData.pollingIntervalMinutes > 1440) {
      toast({
        title: "❌ Errore validazione",
        description: "Intervallo polling deve essere tra 1 e 1440 minuti",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleTestConnection = async () => {
    if (!existingConfigId) {
      toast({
        title: "❌ Errore",
        description: "Devi prima salvare la configurazione prima di testarla",
        variant: "destructive",
      });
      return;
    }

    testMutation.mutate(existingConfigId);
  };

  const handleSaveConfiguration = async () => {
    if (!validateForm()) return;

    const dataToSave: any = {
      configName: formData.configName,
      baseUrl: formData.baseUrl,
      targetCampaignId: formData.targetCampaignId,
      leadType: formData.leadType,
      sourceFilter: formData.sourceFilter || null,
      campaignFilter: formData.campaignFilter || null,
      daysFilter: formData.daysFilter || null,
      pollingIntervalMinutes: formData.pollingIntervalMinutes,
      pollingEnabled: formData.pollingEnabled,
      isActive: formData.isActive,
    };

    if (formData.apiKey) {
      dataToSave.apiKey = formData.apiKey;
    }

    if (existingConfigId) {
      updateMutation.mutate(dataToSave);
    } else {
      if (!formData.apiKey) {
        toast({
          title: "❌ Errore",
          description: "API Key è obbligatoria per creare una nuova configurazione",
          variant: "destructive",
        });
        return;
      }
      createMutation.mutate(dataToSave);
    }
  };

  const handleManualImport = async () => {
    if (!existingConfigId) {
      toast({
        title: "❌ Errore",
        description: "Devi prima salvare la configurazione prima di importare",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    importMutation.mutate(existingConfigId, {
      onSettled: () => {
        setIsImporting(false);
      },
    });
  };

  const handleTogglePolling = async () => {
    if (!existingConfigId) {
      toast({
        title: "❌ Errore",
        description: "Devi prima salvare la configurazione",
        variant: "destructive",
      });
      return;
    }

    if (formData.pollingEnabled) {
      stopPollingMutation.mutate(existingConfigId, {
        onSuccess: () => {
          setFormData((prev) => ({ ...prev, pollingEnabled: false }));
        },
      });
    } else {
      startPollingMutation.mutate(existingConfigId, {
        onSuccess: () => {
          setFormData((prev) => ({ ...prev, pollingEnabled: true }));
        },
      });
    }
  };

  const formatLastImport = (timestamp?: string | null) => {
    if (!timestamp) return "Mai";
    const date = new Date(timestamp);
    return date.toLocaleString("it-IT");
  };

  // Helper functions for pending leads section
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (contactSchedule: string | Date) => {
    const now = new Date();
    const scheduled = new Date(contactSchedule);
    const diffMs = scheduled.getTime() - now.getTime();
    
    if (diffMs < 0) return 'In corso';
    
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}g ${diffHours % 24}h`;
    if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
    return `${diffMins}m`;
  };

  const getTimeRemainingColor = (contactSchedule: string | Date) => {
    const now = new Date();
    const scheduled = new Date(contactSchedule);
    const diffMs = scheduled.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 0) return 'bg-red-100 text-red-800 border-red-300';
    if (diffMins < 30) return 'bg-orange-100 text-orange-800 border-orange-300';
    if (diffMins < 120) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-green-100 text-green-800 border-green-300';
  };

  const getCampaignName = (campaignId: string | null) => {
    if (!campaignId) return '-';
    const campaign = campaigns?.find(c => c.id === campaignId);
    return campaign?.campaignName || '-';
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />}
      <div className="flex">
        {isMobile ? (
          <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        ) : (
          <Sidebar role="consultant" />
        )}

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Impostazioni API</h1>
              <p className="text-muted-foreground mt-2">
                Configura l'integrazione con il sistema esterno per l'importazione automatica dei lead
              </p>
            </div>

            <div className="space-y-6">
              {/* Sezione 1: Stato Importazione */}
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                <CardHeader>
                  <CardTitle className="text-lg">Stato Importazione</CardTitle>
                  <CardDescription>Stato attuale del servizio di importazione lead</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-medium">Stato Polling:</Label>
                      <Badge
                        variant={formData.pollingEnabled ? "default" : "secondary"}
                        className={
                          formData.pollingEnabled
                            ? "bg-green-500 hover:bg-green-600"
                            : "bg-gray-500 hover:bg-gray-600"
                        }
                      >
                        {formData.pollingEnabled ? "Attivo" : "Inattivo"}
                      </Badge>
                      <Button
                        variant={formData.pollingEnabled ? "outline" : "default"}
                        size="sm"
                        onClick={handleTogglePolling}
                        disabled={
                          !existingConfigId ||
                          startPollingMutation.isPending ||
                          stopPollingMutation.isPending
                        }
                      >
                        {startPollingMutation.isPending || stopPollingMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : formData.pollingEnabled ? (
                          "Ferma"
                        ) : (
                          "Avvia"
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Ultima Importazione:</span>
                    <span className="text-muted-foreground">
                      {formatLastImport(existingConfig?.lastImportAt)}
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleManualImport}
                    disabled={!existingConfigId || isImporting || importMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {isImporting || importMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importazione in corso...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Importazione Manuale
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Lead in Attesa Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-gray-600" />
                        Lead in Attesa
                      </CardTitle>
                      <CardDescription>
                        Lead importati schedulati per contatto WhatsApp
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-lg">
                      {pendingLeads?.length || 0} in coda
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {pendingLeadsLoading ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : pendingLeads && pendingLeads.length > 0 ? (
                    <div className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Telefono</TableHead>
                            <TableHead>Prossimo Contatto</TableHead>
                            <TableHead>Tempo Rimanente</TableHead>
                            <TableHead>Campagna</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingLeads.slice(0, 10).map((lead: any) => (
                            <TableRow key={lead.id}>
                              <TableCell className="font-medium">
                                {lead.firstName} {lead.lastName}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {lead.phoneNumber}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                  {formatDate(lead.contactSchedule)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={getTimeRemainingColor(lead.contactSchedule)}>
                                  {getTimeRemaining(lead.contactSchedule)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {getCampaignName(lead.campaignId)}
                              </TableCell>
                              <TableCell>
                                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                                  In Attesa
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      {pendingLeads.length > 10 && (
                        <div className="text-center pt-4 border-t">
                          <p className="text-sm text-gray-600">
                            Mostrati 10 di {pendingLeads.length} lead in attesa.{' '}
                            <Link to="/consultant/proactive-leads" className="text-blue-600 hover:underline">
                              Vedi tutti →
                            </Link>
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center p-8 text-gray-500">
                      <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>Nessun lead in attesa</p>
                      <p className="text-sm mt-1">I lead importati appariranno qui</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sezione 2: Configurazione API */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configurazione API</CardTitle>
                  <CardDescription>Inserisci le credenziali API per l'integrazione</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* API Key */}
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key *</Label>
                    <div className="relative">
                      <Input
                        id="apiKey"
                        type={showApiKey ? "text" : "password"}
                        placeholder="crm_live_..."
                        value={formData.apiKey}
                        onChange={(e) => handleInputChange("apiKey", e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Base URL */}
                  <div className="space-y-2">
                    <Label htmlFor="baseUrl">Base URL *</Label>
                    <Input
                      id="baseUrl"
                      type="url"
                      placeholder="https://..."
                      value={formData.baseUrl}
                      onChange={(e) => handleInputChange("baseUrl", e.target.value)}
                    />
                  </div>

                  {/* Campagna Marketing */}
                  <div className="space-y-2">
                    <Label htmlFor="targetCampaign">Campagna Marketing *</Label>
                    <Select
                      value={formData.targetCampaignId}
                      onValueChange={(value) => handleInputChange("targetCampaignId", value)}
                    >
                      <SelectTrigger id="targetCampaign">
                        <SelectValue placeholder="Seleziona una campagna" />
                      </SelectTrigger>
                      <SelectContent>
                        {campaignsLoading ? (
                          <div className="p-2 text-sm text-muted-foreground">Caricamento...</div>
                        ) : campaigns.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            Nessuna campagna disponibile
                          </div>
                        ) : (
                          campaigns.map((campaign: any) => (
                            <SelectItem key={campaign.id} value={campaign.id}>
                              {campaign.campaignName}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tipo Lead */}
                  <div className="space-y-2">
                    <Label htmlFor="leadType">Tipo Lead</Label>
                    <Select
                      value={formData.leadType}
                      onValueChange={(value: any) => handleInputChange("leadType", value)}
                    >
                      <SelectTrigger id="leadType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Entrambi (CRM + Marketing)</SelectItem>
                        <SelectItem value="crm">Solo CRM</SelectItem>
                        <SelectItem value="marketing">Solo Marketing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filtri Opzionali */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Filtri Opzionali</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sourceFilter">Sorgente</Label>
                        <Input
                          id="sourceFilter"
                          placeholder="es: facebook"
                          value={formData.sourceFilter}
                          onChange={(e) => handleInputChange("sourceFilter", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="campaignFilter">Campagna</Label>
                        <Input
                          id="campaignFilter"
                          placeholder="es: metodo-orbitale"
                          value={formData.campaignFilter}
                          onChange={(e) => handleInputChange("campaignFilter", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="daysFilter">Giorni</Label>
                        <Input
                          id="daysFilter"
                          placeholder="es: 7, 30, all"
                          value={formData.daysFilter}
                          onChange={(e) => handleInputChange("daysFilter", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Intervallo Polling */}
                  <div className="space-y-2">
                    <Label htmlFor="pollingInterval">Intervallo Polling (minuti)</Label>
                    <Input
                      id="pollingInterval"
                      type="number"
                      min="1"
                      max="1440"
                      value={formData.pollingIntervalMinutes}
                      onChange={(e) =>
                        handleInputChange("pollingIntervalMinutes", parseInt(e.target.value) || 5)
                      }
                    />
                  </div>

                  {/* Abilita Importazione Automatica */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="pollingEnabled">Abilita Importazione Automatica</Label>
                      <p className="text-sm text-muted-foreground">
                        Attiva il polling automatico dei lead
                      </p>
                    </div>
                    <Switch
                      id="pollingEnabled"
                      checked={formData.pollingEnabled}
                      onCheckedChange={(checked) => handleInputChange("pollingEnabled", checked)}
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={!existingConfigId || testMutation.isPending}
                      className="w-full sm:w-auto"
                    >
                      {testMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Test in corso...
                        </>
                      ) : (
                        "Testa Connessione"
                      )}
                    </Button>

                    <Button
                      onClick={handleSaveConfiguration}
                      disabled={isLoading}
                      className="w-full sm:flex-1"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Salvataggio...
                        </>
                      ) : (
                        "Salva Configurazione"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      <ConsultantAIAssistant />
    </div>
  );
}
