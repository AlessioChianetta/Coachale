import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Bot, Key, Mail, MessageSquare, Server, Cloud, Sparkles, Save, 
  AlertCircle, Clock, CheckCircle, Plus, Trash2, Users, Calendar, XCircle,
  RefreshCw, Eye, EyeOff, Loader2, ExternalLink, FileText, CalendarDays, Video,
  BookOpen, ChevronDown, Shield, Database, Plug, Copy, Check
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link, useSearch } from "wouter";
import {
  useExternalApiConfigs,
  useCreateExternalApiConfig,
  useUpdateExternalApiConfig,
  useTestConnection,
  useManualImport,
  useStartPolling,
  useStopPolling,
  useImportLogs,
} from "@/hooks/useExternalApiConfig";
import { useCampaigns } from "@/hooks/useCampaigns";
import CalendarView from "@/components/calendar/CalendarView";
import CalendarSettingsContent from "@/components/calendar/CalendarSettingsContent";

interface SMTPSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  emailTone: "professionale" | "amichevole" | "motivazionale";
  emailSignature: string;
}

interface WhatsAppSettings {
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioWhatsappNumber: string;
}

interface CalendarOAuthSettings {
  googleOAuthClientId: string;
  googleOAuthClientSecret: string;
  googleOAuthRedirectUri: string;
  isConnected: boolean;
  connectedEmail?: string;
}

interface ClientAIConfig {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  preferredAiProvider: "vertex_admin" | "google_studio" | "custom" | "vertex_self";
  geminiApiKeys: string[];
  geminiApiKeyIndex: number;
  vertexSettings?: {
    projectId: string;
    location: string;
    expiresAt: string | null;
    enabled: boolean;
  } | null;
}

function ClientAIConfigRow({ client, onSave }: { client: ClientAIConfig; onSave: () => void }) {
  const { toast } = useToast();
  const [provider, setProvider] = useState<"vertex_admin" | "google_studio" | "custom" | "vertex_self">(client.preferredAiProvider);
  const [customKeys, setCustomKeys] = useState<string[]>(client.geminiApiKeys || []);
  const [vertexConfig, setVertexConfig] = useState({
    projectId: client.vertexSettings?.projectId || "",
    location: client.vertexSettings?.location || "us-central1",
    serviceAccountJson: "", // Always empty for security (consultant must re-enter if changing)
  });
  const [hasExistingVertex, setHasExistingVertex] = useState(!!client.vertexSettings?.projectId);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state with props when client data updates
  useEffect(() => {
    setProvider(client.preferredAiProvider);
    setCustomKeys(client.geminiApiKeys || []);
    // hasExistingVertex = true if vertexSettings exist (even if disabled)
    setHasExistingVertex(!!client.vertexSettings?.projectId);
    setVertexConfig({
      projectId: client.vertexSettings?.projectId || "",
      location: client.vertexSettings?.location || "us-central1",
      serviceAccountJson: "", // Always empty for security
    });
  }, [client]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: any = {
        preferredAiProvider: provider,
      };

      if (provider === "custom") {
        payload.geminiApiKeys = customKeys.filter(k => k.trim());
      } else if (provider === "vertex_self") {
        // New setup: require all fields
        if (!hasExistingVertex) {
          if (!vertexConfig.projectId || !vertexConfig.location || !vertexConfig.serviceAccountJson.trim()) {
            setIsSaving(false);
            return toast({
              title: "Campi mancanti",
              description: "Per configurare Vertex AI sono necessari: Project ID, Location e Service Account JSON",
              variant: "destructive",
            });
          }
          payload.vertexProjectId = vertexConfig.projectId;
          payload.vertexLocation = vertexConfig.location;
          payload.vertexServiceAccountJson = vertexConfig.serviceAccountJson;
        } else {
          // Existing setup: only send if updating credentials (JSON provided)
          if (vertexConfig.serviceAccountJson.trim()) {
            payload.vertexProjectId = vertexConfig.projectId;
            payload.vertexLocation = vertexConfig.location;
            payload.vertexServiceAccountJson = vertexConfig.serviceAccountJson;
          }
          // If no JSON provided, just switch provider without touching credentials
        }
      }

      const response = await fetch(`/api/consultant/client-ai-config/${client.id}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore durante il salvataggio");
      }

      toast({
        title: "Successo",
        description: `Configurazione AI per ${client.firstName} salvata`,
      });

      // Update local state after successful vertex_self save
      if (provider === "vertex_self" && vertexConfig.serviceAccountJson.trim()) {
        setHasExistingVertex(true); // Mark credentials as saved
        setVertexConfig(prev => ({ ...prev, serviceAccountJson: "" })); // Clear JSON for security
      }

      onSave();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addKey = () => {
    if (customKeys.length < 10) {
      setCustomKeys([...customKeys, ""]);
    }
  };

  const removeKey = (index: number) => {
    setCustomKeys(customKeys.filter((_, i) => i !== index));
  };

  const updateKey = (index: number, value: string) => {
    const newKeys = [...customKeys];
    newKeys[index] = value;
    setCustomKeys(newKeys);
  };

  return (
    <Card className="border border-gray-200 hover:border-indigo-300 transition-colors">
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">{client.firstName} {client.lastName}</p>
              <p className="text-sm text-gray-500">{client.email}</p>
            </div>
            <Badge variant="outline" className={
              provider === "vertex_admin" ? "bg-green-50 text-green-700 border-green-300" :
              provider === "vertex_self" ? "bg-blue-50 text-blue-700 border-blue-300" :
              provider === "google_studio" ? "bg-yellow-50 text-yellow-700 border-yellow-300" :
              "bg-purple-50 text-purple-700 border-purple-300"
            }>
              {provider === "vertex_admin" ? "Vertex AI" : 
               provider === "vertex_self" ? "Vertex AI (proprio)" :
               provider === "google_studio" ? "Google Studio" : "Custom"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Provider AI</Label>
              <Select value={provider} onValueChange={(val: any) => setProvider(val)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vertex_admin">Vertex AI (predefinito)</SelectItem>
                  <SelectItem value="vertex_self">Vertex AI (proprio)</SelectItem>
                  <SelectItem value="google_studio">Google AI Studio</SelectItem>
                  <SelectItem value="custom">Custom (API proprie)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleSave}
                disabled={
                  isSaving || 
                  (provider === "custom" && customKeys.filter(k => k.trim()).length === 0) ||
                  (provider === "vertex_self" && !hasExistingVertex && (!vertexConfig.projectId || !vertexConfig.location || !vertexConfig.serviceAccountJson))
                }
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {isSaving ? "Salvataggio..." : "Salva"}
              </Button>
            </div>
          </div>

          {provider === "custom" && (
            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm">API Keys Custom ({customKeys.length}/10)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addKey}
                  disabled={customKeys.length >= 10}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Aggiungi
                </Button>
              </div>

              {customKeys.length === 0 ? (
                <div className="text-sm text-gray-500 italic py-2 text-center border-2 border-dashed border-gray-200 rounded-lg">
                  Nessuna API key. Clicca "Aggiungi" per iniziare.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {customKeys.map((key, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500 w-6">#{index + 1}</span>
                      <Input
                        type="password"
                        value={key}
                        onChange={(e) => updateKey(index, e.target.value)}
                        placeholder={`API Key ${index + 1}`}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeKey(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {provider === "vertex_self" && (
            <div className="space-y-3 pt-3 border-t">
              <Label className="text-sm font-semibold text-blue-700">Configurazione Vertex AI</Label>

              <div>
                <Label className="text-xs">Project ID</Label>
                <Input
                  value={vertexConfig.projectId}
                  onChange={(e) => setVertexConfig({ ...vertexConfig, projectId: e.target.value })}
                  placeholder="my-gcp-project-id"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label className="text-xs">Location</Label>
                <Select 
                  value={vertexConfig.location} 
                  onValueChange={(val) => setVertexConfig({ ...vertexConfig, location: val })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us-central1">US Central 1</SelectItem>
                    <SelectItem value="us-east1">US East 1</SelectItem>
                    <SelectItem value="europe-west1">Europe West 1</SelectItem>
                    <SelectItem value="europe-west4">Europe West 4</SelectItem>
                    <SelectItem value="asia-southeast1">Asia Southeast 1</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Service Account JSON</Label>
                <Textarea
                  value={vertexConfig.serviceAccountJson}
                  onChange={(e) => setVertexConfig({ ...vertexConfig, serviceAccountJson: e.target.value })}
                  placeholder='{"type": "service_account", "project_id": "...", "private_key": "...", ...}'
                  rows={6}
                  className="mt-1.5 font-mono text-xs"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Incolla qui il JSON completo del service account Google Cloud
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConsultantApiKeysUnified() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("ai");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = useSearch();

  // Read tab parameter from URL and set active tab
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const tabParam = params.get('tab');
    const validTabs = ['ai', 'client-ai', 'email', 'calendar', 'lead-import', 'video-meeting', 'twilio'];
    if (tabParam === 'whatsapp') {
      setActiveTab('twilio');
    } else if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const [vertexFormData, setVertexFormData] = useState({
    projectId: "",
    location: "us-central1",
    serviceAccountJson: "",
    usageScope: "both" as "both" | "consultant_only" | "clients_only" | "selective",
  });

  const [geminiApiKeys, setGeminiApiKeys] = useState<string[]>([]);

  const [smtpFormData, setSmtpFormData] = useState<SMTPSettings>({
    host: "",
    port: 587,
    secure: true,
    username: "",
    password: "",
    fromEmail: "",
    fromName: "",
    emailTone: "professionale",
    emailSignature: "",
  });

  const [whatsappFormData, setWhatsappFormData] = useState<WhatsAppSettings>({
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioWhatsappNumber: "",
  });

  const [calendarFormData, setCalendarFormData] = useState<CalendarOAuthSettings>({
    googleOAuthClientId: "",
    googleOAuthClientSecret: "",
    googleOAuthRedirectUri: "",
    isConnected: false,
    connectedEmail: "",
  });

  // TURN Config for Video Meetings state
  const [turnConfigFormData, setTurnConfigFormData] = useState({
    username: "",
    password: "",
    enabled: true,
  });
  const [showTurnPassword, setShowTurnPassword] = useState(false);
  const [isSavingTurnConfig, setIsSavingTurnConfig] = useState(false);

  // Twilio Centralized Settings state
  const [twilioFormData, setTwilioFormData] = useState({
    accountSid: "",
    authToken: "",
    whatsappNumber: "",
  });
  const [showTwilioAuthToken, setShowTwilioAuthToken] = useState(false);
  const [isSavingTwilio, setIsSavingTwilio] = useState(false);
  const [isTestingTwilio, setIsTestingTwilio] = useState(false);
  const [twilioValidationErrors, setTwilioValidationErrors] = useState<{
    accountSid?: string;
    authToken?: string;
    whatsappNumber?: string;
  }>({});

  // Lead Import state
  const [showLeadApiKey, setShowLeadApiKey] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [leadImportConfigId, setLeadImportConfigId] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<"crmale" | "hubdigital">("crmale");
  const [leadImportFormData, setLeadImportFormData] = useState({
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

  // Hubdigital Webhook state
  const [hubdigitalFormData, setHubdigitalFormData] = useState({
    displayName: "Hubdigital.io",
    targetCampaignId: "",
  });
  const [hubdigitalCopied, setHubdigitalCopied] = useState(false);

  const { data: vertexAiData, isLoading: isLoadingVertex } = useQuery({
    queryKey: ["/api/vertex-ai/settings"],
    queryFn: async () => {
      const response = await fetch("/api/vertex-ai/settings", {
        headers: getAuthHeaders(),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("Failed to fetch Vertex AI settings");
      }
      return response.json();
    },
  });

  const { data: consultant, isLoading: isLoadingConsultant } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch consultant data");
      }
      const data = await response.json();
      setGeminiApiKeys(data.geminiApiKeys || []);
      return data;
    },
  });

  const { data: existingSMTP, isLoading: isLoadingSMTP } = useQuery({
    queryKey: ["/api/consultant/smtp-settings"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/smtp-settings", {
        headers: getAuthHeaders(),
      });
      if (!response.ok && response.status !== 404) throw new Error("Failed to fetch SMTP");
      return response.json();
    },
  });

  const { data: whatsappConfigs, isLoading: isLoadingWhatsapp } = useQuery({
    queryKey: ["/api/whatsapp/configs"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/configs", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch WhatsApp configs");
      return response.json();
    },
  });

  const { data: activeProvider } = useQuery({
    queryKey: ["/api/ai/active-provider"],
    queryFn: async () => {
      const response = await fetch("/api/ai/active-provider", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch active provider");
      return response.json();
    },
    refetchInterval: 30000, // Refresh ogni 30s
  });

  const { data: clientsAiConfig, isLoading: isLoadingClientsAi } = useQuery<{ clients: ClientAIConfig[] }>({
    queryKey: ["/api/consultant/client-ai-config"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/client-ai-config", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients AI config");
      return response.json();
    },
  });

  const { data: calendarSettings, isLoading: isLoadingCalendar } = useQuery({
    queryKey: ["/api/calendar-settings"],
    queryFn: async () => {
      const response = await fetch("/api/calendar-settings", {
        headers: getAuthHeaders(),
      });
      if (!response.ok && response.status !== 404) throw new Error("Failed to fetch calendar settings");
      if (response.status === 404) return null;
      return response.json();
    },
  });

  const { data: calendarGlobalOAuth } = useQuery({
    queryKey: ["/api/calendar-settings/oauth/global-status"],
    queryFn: async () => {
      const response = await fetch("/api/calendar-settings/oauth/global-status", {
        headers: getAuthHeaders(),
      });
      if (!response.ok && response.status !== 404) throw new Error("Failed to fetch global OAuth status");
      if (response.status === 404) return { globalOAuthConfigured: false };
      return response.json();
    },
  });

  // TURN Config for Video Meetings query
  const { data: turnConfigData, isLoading: isLoadingTurnConfig } = useQuery({
    queryKey: ["/api/consultant/turn-config"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/turn-config", {
        headers: getAuthHeaders(),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("Failed to fetch TURN config");
      }
      if (response.status === 404) return null;
      return response.json();
    },
  });

  // Twilio Centralized Settings query
  const { data: twilioSettingsData, isLoading: isLoadingTwilioSettings } = useQuery({
    queryKey: ["/api/consultant/twilio-settings"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/twilio-settings", {
        headers: getAuthHeaders(),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("Failed to fetch Twilio settings");
      }
      if (response.status === 404) return null;
      return response.json();
    },
  });

  // Lead Import queries and mutations
  const { data: leadImportConfigs } = useExternalApiConfigs();
  const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns();
  const createLeadConfigMutation = useCreateExternalApiConfig();
  const updateLeadConfigMutation = useUpdateExternalApiConfig(leadImportConfigId || "");
  const testConnectionMutation = useTestConnection();
  const manualImportMutation = useManualImport();
  const startPollingMutation = useStartPolling();
  const stopPollingMutation = useStopPolling();
  const { data: importLogs, isLoading: importLogsLoading } = useImportLogs(leadImportConfigId || "", 20);

  const campaigns = campaignsData?.campaigns || [];
  const existingLeadConfig = leadImportConfigs && leadImportConfigs.length > 0 ? leadImportConfigs[0] : null;

  const { data: webhookConfigs } = useQuery({
    queryKey: ["/api/external-api/webhook-configs"],
    queryFn: async () => {
      const response = await fetch("/api/external-api/webhook-configs", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return data.data || [];
    },
  });
  const hubdigitalConfig = webhookConfigs?.find((c: any) => c.providerName === "hubdigital");

  // Hubdigital Webhook mutations
  const createHubdigitalMutation = useMutation({
    mutationFn: async (data: { displayName: string; targetCampaignId: string }) => {
      const response = await fetch("/api/external-api/webhook-configs", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          providerName: "hubdigital",
          displayName: data.displayName,
          targetCampaignId: data.targetCampaignId,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore durante la creazione del webhook");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Webhook Attivato",
        description: "La configurazione Hubdigital.io è stata creata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/external-api/webhook-configs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateHubdigitalMutation = useMutation({
    mutationFn: async (data: { id: string; targetCampaignId?: string; isActive?: boolean }) => {
      const response = await fetch(`/api/external-api/webhook-configs/${data.id}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetCampaignId: data.targetCampaignId,
          isActive: data.isActive,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore durante l'aggiornamento");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configurazione Aggiornata",
        description: "Le modifiche sono state salvate",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/external-api/webhook-configs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const regenerateHubdigitalKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/external-api/webhook-configs/${id}/regenerate-key`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore durante la rigenerazione della chiave");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Chiave Rigenerata",
        description: "La nuova chiave webhook è stata generata. Aggiorna l'URL nel tuo sistema esterno.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/external-api/webhook-configs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteHubdigitalMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/external-api/webhook-configs/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore durante l'eliminazione");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Webhook Eliminato",
        description: "La configurazione Hubdigital.io è stata rimossa",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/external-api/webhook-configs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
    refetchInterval: 30000
  });

  // Vertex Preference query - determines if consultant uses SuperAdmin Vertex or own
  const { data: vertexPreference, isLoading: isLoadingVertexPreference } = useQuery({
    queryKey: ["/api/consultant/vertex-preference"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/vertex-preference", {
        headers: getAuthHeaders(),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("Failed to fetch Vertex preference");
      }
      if (response.status === 404) return { useSuperAdminVertex: true, superAdminVertexAvailable: false, hasOwnVertex: false };
      return response.json();
    },
  });

  const [isSavingVertexPreference, setIsSavingVertexPreference] = useState(false);

  const handleToggleVertexPreference = async (useSuperAdmin: boolean) => {
    setIsSavingVertexPreference(true);
    try {
      const response = await fetch("/api/consultant/vertex-preference", {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ useSuperAdminVertex: useSuperAdmin }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore durante l'aggiornamento");
      }

      toast({
        title: "Preferenza salvata",
        description: useSuperAdmin 
          ? "Stai usando Vertex AI del SuperAdmin" 
          : "Stai usando le tue credenziali Vertex AI",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/consultant/vertex-preference"] });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingVertexPreference(false);
    }
  };

  useEffect(() => {
    if (vertexAiData?.settings) {
      setVertexFormData({
        projectId: vertexAiData.settings.projectId || "",
        location: vertexAiData.settings.location || "us-central1",
        serviceAccountJson: "",
        usageScope: vertexAiData.settings.usageScope || "both",
      });
    }
  }, [vertexAiData]);

  useEffect(() => {
    if (existingSMTP) {
      setSmtpFormData({
        host: existingSMTP.smtpHost || "",
        port: existingSMTP.smtpPort || 587,
        secure: existingSMTP.smtpSecure ?? true,
        username: existingSMTP.smtpUser || "",
        password: existingSMTP.smtpPassword || "",
        fromEmail: existingSMTP.fromEmail || "",
        fromName: existingSMTP.fromName || "",
        emailTone: existingSMTP.emailTone || "professionale",
        emailSignature: existingSMTP.emailSignature || "",
      });
    }
  }, [existingSMTP]);

  useEffect(() => {
    if (existingLeadConfig) {
      setLeadImportConfigId(existingLeadConfig.id);
      setLeadImportFormData({
        configName: existingLeadConfig.configName,
        apiKey: "",
        baseUrl: existingLeadConfig.baseUrl,
        targetCampaignId: existingLeadConfig.targetCampaignId,
        leadType: existingLeadConfig.leadType,
        sourceFilter: existingLeadConfig.sourceFilter || "",
        campaignFilter: existingLeadConfig.campaignFilter || "",
        daysFilter: existingLeadConfig.daysFilter || "",
        pollingIntervalMinutes: existingLeadConfig.pollingIntervalMinutes,
        pollingEnabled: existingLeadConfig.pollingEnabled,
        isActive: existingLeadConfig.isActive,
      });
    }
  }, [existingLeadConfig]);

  useEffect(() => {
    if (whatsappConfigs && whatsappConfigs.length > 0) {
      const config = whatsappConfigs[0];
      setWhatsappFormData({
        twilioAccountSid: config.twilioAccountSid || "",
        twilioAuthToken: "",
        twilioWhatsappNumber: config.twilioWhatsappNumber || "",
      });
    }
  }, [whatsappConfigs]);

  // Sync TURN config settings
  useEffect(() => {
    if (turnConfigData?.config) {
      setTurnConfigFormData({
        username: turnConfigData.config.username || "",
        password: "", // Password is never sent back for security
        enabled: turnConfigData.config.enabled ?? true,
      });
    }
  }, [turnConfigData]);

  // Sync Twilio settings
  useEffect(() => {
    if (twilioSettingsData?.settings) {
      setTwilioFormData({
        accountSid: twilioSettingsData.settings.accountSid || "",
        authToken: "", // Never sent back for security
        whatsappNumber: twilioSettingsData.settings.whatsappNumber || "",
      });
    }
  }, [twilioSettingsData]);

  const [newWhatsAppApiKey, setNewWhatsAppApiKey] = useState("");

  // WhatsApp API Keys Query
  const { data: whatsAppApiKeysData, isLoading: isLoadingWhatsAppKeys } = useQuery({
    queryKey: ["/api/whatsapp/api-keys"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/api-keys", {
        headers: getAuthHeaders(),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("Failed to fetch WhatsApp API keys");
      }
      if (response.status === 404) return { keys: [], count: 0, maxKeys: 50 };
      return response.json();
    },
  });

  const whatsAppApiKeys = whatsAppApiKeysData?.keys || [];
  const whatsAppKeysCount = whatsAppApiKeysData?.count || 0;
  const whatsAppMaxKeys = whatsAppApiKeysData?.maxKeys || 50;

  const handleVertexSave = async () => {
    try {
      const response = await fetch("/api/vertex-ai/settings", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(vertexFormData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore durante il salvataggio");
      }

      toast({
        title: "Successo",
        description: "Vertex AI configurato con successo",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/vertex-ai/settings"] });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleVertexToggle = async (checked: boolean) => {
    if (!vertexAiData?.settings?.id) return;

    try {
      const response = await fetch(`/api/vertex-ai/settings/${vertexAiData.settings.id}/toggle`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error("Errore durante il toggle");

      toast({
        title: checked ? "Vertex AI abilitato" : "Vertex AI disabilitato",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/vertex-ai/settings"] });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddApiKey = () => {
    if (geminiApiKeys.length < 10) {
      setGeminiApiKeys(prev => [...prev, '']);
    }
  };

  const handleRemoveApiKey = (index: number) => {
    setGeminiApiKeys(prev => prev.filter((_, i) => i !== index));
  };

  const handleApiKeyChange = (index: number, value: string) => {
    setGeminiApiKeys(prev => {
      const newKeys = [...prev];
      newKeys[index] = value;
      return newKeys;
    });
  };

  const handleGeminiSave = async () => {
    if (!consultant) return;

    const validApiKeys = geminiApiKeys.filter(key => key.trim() !== '');

    try {
      const updateData = {
        gemini_api_keys: validApiKeys
      };

      const response = await fetch(`/api/users/${consultant.id}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        throw new Error('Errore durante il salvataggio');
      }

      toast({
        title: "Successo",
        description: "API keys Google AI Studio aggiornate con successo",
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (error: any) {
      console.error('Errore salvataggio API keys:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio",
        variant: "destructive",
      });
    }
  };

  const handleSMTPSave = async () => {
    try {
      const response = await fetch("/api/consultant/smtp-settings", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(smtpFormData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save SMTP");
      }

      toast({
        title: "Successo",
        description: "Configurazione SMTP salvata",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/consultant/smtp-settings"] });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleWhatsAppSave = async () => {
    try {
      const configId = whatsappConfigs?.[0]?.id;
      const url = configId 
        ? `/api/whatsapp/configs/${configId}` 
        : `/api/whatsapp/configs`;

      const method = configId ? "PUT" : "POST";

      const body = {
        agentName: "AI Agent WhatsApp",
        ...whatsappFormData,
      };

      const response = await fetch(url, {
        method,
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save WhatsApp");
      }

      toast({
        title: "Successo",
        description: "Configurazione WhatsApp salvata",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/configs"] });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddWhatsAppGeminiKey = async () => {
    if (!newWhatsAppApiKey.trim() || newWhatsAppApiKey.trim().length < 20) {
      toast({
        title: "⚠️ API Key non valida",
        description: "Inserisci una API key Gemini valida (minimo 20 caratteri)",
        variant: "destructive",
      });
      return;
    }

    if (whatsAppKeysCount >= whatsAppMaxKeys) {
      toast({
        title: "⚠️ Limite raggiunto",
        description: `Hai già raggiunto il limite massimo di ${whatsAppMaxKeys} API keys`,
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/whatsapp/api-keys", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey: newWhatsAppApiKey.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore durante l'aggiunta");
      }

      toast({
        title: "✅ API Key aggiunta",
        description: "La chiave è stata aggiunta con successo al pool WhatsApp",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/api-keys"] });
      setNewWhatsAppApiKey("");
    } catch (error: any) {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteWhatsAppApiKey = async (keyId: string) => {
    if (!confirm("Sei sicuro di voler rimuovere questa API key?")) {
      return;
    }

    try {
      const response = await fetch(`/api/whatsapp/api-keys/${keyId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore durante la rimozione");
      }

      toast({
        title: "✅ API Key rimossa",
        description: "La chiave è stata rimossa con successo",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/api-keys"] });
    } catch (error: any) {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleWhatsAppApiKey = async (keyId: string) => {
    try {
      const response = await fetch(`/api/whatsapp/api-keys/${keyId}/toggle`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore durante il toggle");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/api-keys"] });
    } catch (error: any) {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveTurnConfig = async () => {
    if (!turnConfigFormData.username || !turnConfigFormData.password) {
      toast({
        title: "Errore",
        description: "Username e password sono obbligatori",
        variant: "destructive",
      });
      return;
    }

    setIsSavingTurnConfig(true);
    try {
      const response = await fetch("/api/consultant/turn-config", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: turnConfigFormData.username,
          password: turnConfigFormData.password,
          enabled: turnConfigFormData.enabled,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore durante il salvataggio");
      }

      toast({
        title: "Successo",
        description: "Configurazione TURN salvata con successo",
      });

      // Clear password field for security
      setTurnConfigFormData(prev => ({ ...prev, password: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/turn-config"] });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingTurnConfig(false);
    }
  };

  const validateTwilioCredentials = (): boolean => {
    const errors: typeof twilioValidationErrors = {};
    
    if (!twilioFormData.accountSid.startsWith('AC')) {
      errors.accountSid = "L'Account SID deve iniziare con 'AC'";
    } else if (twilioFormData.accountSid.length !== 34) {
      errors.accountSid = `L'Account SID deve avere esattamente 34 caratteri (attualmente: ${twilioFormData.accountSid.length})`;
    }
    
    if (twilioFormData.authToken && twilioFormData.authToken.length !== 32) {
      errors.authToken = `L'Auth Token deve avere esattamente 32 caratteri (attualmente: ${twilioFormData.authToken.length})`;
    }
    
    if (twilioFormData.whatsappNumber) {
      if (!twilioFormData.whatsappNumber.startsWith('+')) {
        errors.whatsappNumber = "Il numero deve iniziare con '+' (es: +393500220129)";
      } else if (!/^\+\d+$/.test(twilioFormData.whatsappNumber)) {
        errors.whatsappNumber = "Il numero deve contenere solo cifre dopo il '+'";
      }
    }
    
    setTwilioValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveTwilioSettings = async () => {
    if (!validateTwilioCredentials()) {
      toast({
        title: "Errore di validazione",
        description: "Controlla i campi evidenziati in rosso",
        variant: "destructive",
      });
      return;
    }

    setIsSavingTwilio(true);
    try {
      const response = await fetch("/api/consultant/twilio-settings", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountSid: twilioFormData.accountSid,
          authToken: twilioFormData.authToken || undefined,
          whatsappNumber: twilioFormData.whatsappNumber,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore durante il salvataggio");
      }

      toast({
        title: "Successo",
        description: "Configurazione Twilio salvata con successo",
      });

      setTwilioFormData(prev => ({ ...prev, authToken: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/twilio-settings"] });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingTwilio(false);
    }
  };

  const handleTestTwilioConnection = async () => {
    if (!twilioFormData.accountSid) {
      toast({
        title: "Errore",
        description: "Account SID è obbligatorio per il test",
        variant: "destructive",
      });
      return;
    }

    setIsTestingTwilio(true);
    try {
      const response = await fetch("/api/consultant/twilio-settings/test", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountSid: twilioFormData.accountSid,
          authToken: twilioFormData.authToken || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Test connessione fallito");
      }

      toast({
        title: "✅ Connessione riuscita",
        description: result.message || "Le credenziali Twilio sono valide",
      });
    } catch (error: any) {
      toast({
        title: "❌ Test fallito",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTestingTwilio(false);
    }
  };

  const handleLeadInputChange = (field: string, value: any) => {
    setLeadImportFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateLeadImportForm = () => {
    if (!leadImportFormData.apiKey && !existingLeadConfig) {
      toast({
        title: "❌ Errore validazione",
        description: "API Key è obbligatoria",
        variant: "destructive",
      });
      return false;
    }

    if (leadImportFormData.apiKey && leadImportFormData.apiKey.length < 10) {
      toast({
        title: "❌ Errore validazione",
        description: "API Key deve contenere almeno 10 caratteri",
        variant: "destructive",
      });
      return false;
    }

    if (!leadImportFormData.baseUrl) {
      toast({
        title: "❌ Errore validazione",
        description: "Base URL è obbligatorio",
        variant: "destructive",
      });
      return false;
    }

    if (!leadImportFormData.baseUrl.startsWith("https://") && !leadImportFormData.baseUrl.startsWith("http://")) {
      toast({
        title: "❌ Errore validazione",
        description: "Base URL deve iniziare con https:// o http://",
        variant: "destructive",
      });
      return false;
    }

    if (!leadImportFormData.targetCampaignId) {
      toast({
        title: "❌ Errore validazione",
        description: "Campagna Marketing è obbligatoria",
        variant: "destructive",
      });
      return false;
    }

    if (leadImportFormData.pollingIntervalMinutes < 1 || leadImportFormData.pollingIntervalMinutes > 1440) {
      toast({
        title: "❌ Errore validazione",
        description: "Intervallo polling deve essere tra 1 e 1440 minuti",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleTestLeadConnection = async () => {
    if (!leadImportConfigId) {
      toast({
        title: "❌ Errore",
        description: "Devi prima salvare la configurazione prima di testarla",
        variant: "destructive",
      });
      return;
    }

    testConnectionMutation.mutate(leadImportConfigId);
  };

  const handleSaveLeadConfiguration = async () => {
    if (!validateLeadImportForm()) return;

    const dataToSave: any = {
      configName: leadImportFormData.configName,
      baseUrl: leadImportFormData.baseUrl,
      targetCampaignId: leadImportFormData.targetCampaignId,
      leadType: leadImportFormData.leadType,
      sourceFilter: leadImportFormData.sourceFilter || null,
      campaignFilter: leadImportFormData.campaignFilter || null,
      daysFilter: leadImportFormData.daysFilter || null,
      pollingIntervalMinutes: leadImportFormData.pollingIntervalMinutes,
      pollingEnabled: leadImportFormData.pollingEnabled,
      isActive: leadImportFormData.isActive,
    };

    if (leadImportFormData.apiKey) {
      dataToSave.apiKey = leadImportFormData.apiKey;
    }

    if (leadImportConfigId) {
      updateLeadConfigMutation.mutate(dataToSave);
    } else {
      if (!leadImportFormData.apiKey) {
        toast({
          title: "❌ Errore",
          description: "API Key è obbligatoria per creare una nuova configurazione",
          variant: "destructive",
        });
        return;
      }
      createLeadConfigMutation.mutate(dataToSave);
    }
  };

  const handleManualLeadImport = async () => {
    if (!leadImportConfigId) {
      toast({
        title: "❌ Errore",
        description: "Devi prima salvare la configurazione prima di importare",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    manualImportMutation.mutate(leadImportConfigId, {
      onSettled: () => {
        setIsImporting(false);
      },
    });
  };

  const handleToggleLeadPolling = async () => {
    if (!leadImportConfigId) {
      toast({
        title: "❌ Errore",
        description: "Devi prima salvare la configurazione",
        variant: "destructive",
      });
      return;
    }

    if (leadImportFormData.pollingEnabled) {
      stopPollingMutation.mutate(leadImportConfigId, {
        onSuccess: () => {
          setLeadImportFormData((prev) => ({ ...prev, pollingEnabled: false }));
        },
      });
    } else {
      startPollingMutation.mutate(leadImportConfigId, {
        onSuccess: () => {
          setLeadImportFormData((prev) => ({ ...prev, pollingEnabled: true }));
        },
      });
    }
  };

  const formatLastImport = (timestamp?: string | null) => {
    if (!timestamp) return "Mai";
    const date = new Date(timestamp);
    return date.toLocaleString("it-IT");
  };

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
    const campaign = campaigns?.find((c: any) => c.id === campaignId);
    return campaign?.campaignName || '-';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto">
          {/* Premium Header */}
          <div className="mb-4 sm:mb-6 md:mb-8">
            <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl">
                      <Key className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">Impostazioni API</h1>
                      <p className="text-blue-100 text-xs sm:text-sm md:text-base lg:text-lg hidden sm:block">
                        Gestisci tutte le tue chiavi API e connessioni in un unico posto
                      </p>
                    </div>
                  </div>
                </div>

                {/* Active AI Provider Badge */}
                {activeProvider && (
                  <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl border-2 border-white/30">
                    <div className={`w-3 h-3 rounded-full ${activeProvider.source === 'google' ? 'bg-yellow-400' : 'bg-green-400'} animate-pulse`} />
                    <div className="text-right">
                      <p className="text-xs font-semibold text-white/80">AI Attivo</p>
                      <p className="text-sm font-bold">{activeProvider.provider}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs Container */}
          <div className="max-w-6xl mx-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="flex flex-wrap justify-start gap-2 bg-white/50 backdrop-blur-sm p-2 rounded-xl shadow-lg h-auto">
                <TabsTrigger value="ai" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 text-xs sm:text-sm">
                  <Bot className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">AI (Gemini)</span>
                  <span className="sm:hidden">AI</span>
                </TabsTrigger>
                <TabsTrigger value="client-ai" className="data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 text-xs sm:text-sm">
                  <Users className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">API Clienti</span>
                  <span className="sm:hidden">Clienti</span>
                </TabsTrigger>
                <TabsTrigger value="email" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 text-xs sm:text-sm">
                  <Mail className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Email SMTP</span>
                  <span className="sm:hidden">Email</span>
                </TabsTrigger>
                <TabsTrigger value="twilio" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700 text-xs sm:text-sm">
                  <MessageSquare className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">WhatsApp Twilio</span>
                  <span className="sm:hidden">Twilio</span>
                </TabsTrigger>
                <TabsTrigger value="calendar" className="data-[state=active]:bg-cyan-100 data-[state=active]:text-cyan-700 text-xs sm:text-sm">
                  <Calendar className="h-4 w-4 mr-1 sm:mr-2" />
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="lead-import" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 text-xs sm:text-sm">
                  <Server className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Lead Import</span>
                  <span className="sm:hidden">Lead</span>
                </TabsTrigger>
                <TabsTrigger value="video-meeting" className="data-[state=active]:bg-teal-100 data-[state=active]:text-teal-700 text-xs sm:text-sm">
                  <Video className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Video Meeting</span>
                  <span className="sm:hidden">Video</span>
                </TabsTrigger>
              </TabsList>

              {/* AI Tab Content */}
              <TabsContent value="ai" className="space-y-6">
                <Alert className="mb-6 bg-purple-50 border-purple-200">
                  <Bot className="h-5 w-5" />
                  <AlertDescription className="text-sm">
                    <strong>Come funziona il Sistema AI a 3 Livelli</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Livello 1: Vertex AI (priorità massima) - $300 gratis per 90 giorni, migliori performance</li>
                      <li>Livello 2: Google AI Studio (fallback automatico) - fino a 10 API keys con rotazione LRU</li>
                      <li>Livello 3: Errore se nessuno disponibile</li>
                      <li>Sistema automatico: nessuna configurazione manuale necessaria</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                {/* Guida Setup Vertex AI */}
                <Card className="border-2 border-purple-200 shadow-xl bg-gradient-to-br from-purple-50 to-blue-50">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-purple-600 rounded-xl">
                        <Cloud className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-purple-900">📖 Guida Completa Setup Vertex AI</CardTitle>
                        <CardDescription className="text-purple-700">
                          Segui questi passaggi per attivare $300 di crediti gratuiti per 90 giorni
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-blue-50 border-blue-200">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-sm text-blue-800">
                        <strong>Perché Vertex AI?</strong> Ottieni $300 di crediti gratuiti per 90 giorni, modelli più avanzati (Gemini Pro 1.5), migliori limiti di rate e performance superiori rispetto a Google AI Studio.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4 pl-4 border-l-4 border-purple-300">
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            1
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-purple-900">Accedi a Google Cloud Console</p>
                            <p className="text-sm text-gray-700 mt-1">
                              Vai su <a href="https://console.cloud.google.com/" target="_blank" rel="noopener" className="text-purple-600 hover:text-purple-800 underline font-medium">console.cloud.google.com</a>
                            </p>
                            <p className="text-xs text-gray-600 mt-1">💡 Se è la prima volta, Google ti chiederà di attivare la fatturazione e ti darà $300 di crediti gratuiti validi 90 giorni</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            2
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-purple-900">Crea un nuovo progetto</p>
                            <p className="text-sm text-gray-700 mt-1">
                              • Clicca sul menu a tendina del progetto (in alto a sinistra)<br/>
                              • Clicca "Nuovo Progetto"<br/>
                              • Dai un nome al progetto (es: "AI Assistant Project")<br/>
                              • Clicca "Crea"
                            </p>
                            <p className="text-xs text-gray-600 mt-1">💡 Annota il <strong>Project ID</strong> che verrà generato (es: "my-ai-project-123456")</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            3
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-purple-900">Abilita Vertex AI API</p>
                            <p className="text-sm text-gray-700 mt-1">
                              • Nel menu di navigazione (☰), vai su "API e servizi" → "Libreria"<br/>
                              • Cerca "Vertex AI API"<br/>
                              • Clicca su "Vertex AI API"<br/>
                              • Clicca "Abilita"
                            </p>
                            <p className="text-xs text-gray-600 mt-1">⏳ L'attivazione richiede circa 1-2 minuti</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            4
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-purple-900">Crea un Service Account</p>
                            <p className="text-sm text-gray-700 mt-1">
                              • Vai direttamente su <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener" className="text-purple-600 hover:text-purple-800 underline font-medium">Service Accounts Console</a><br/>
                              • Oppure: Nel menu (☰), vai su "IAM e amministrazione" → "Account di servizio"<br/>
                              • Clicca "Crea account di servizio"<br/>
                              • Nome: "vertex-ai-service-account" (o quello che preferisci)<br/>
                              • Descrizione: "Service account per Vertex AI"<br/>
                              • Clicca "Crea e continua"
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            5
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-purple-900">Assegna i ruoli necessari</p>
                            <p className="text-sm text-gray-700 mt-1">
                              Nella sezione "Concedi a questo account di servizio l'accesso al progetto":<br/>
                              • Clicca "Seleziona un ruolo"<br/>
                              • Cerca e seleziona <strong>"Vertex AI User"</strong><br/>
                              • Clicca "Aggiungi un altro ruolo"<br/>
                              • Cerca e seleziona <strong>"Vertex AI Service Agent"</strong><br/>
                              • Clicca "Aggiungi un altro ruolo"<br/>
                              • Cerca e seleziona <strong>"Service Account Token Creator"</strong><br/>
                              • Clicca "Continua" e poi "Fine"
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            6
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-purple-900">Genera la chiave JSON</p>
                            <p className="text-sm text-gray-700 mt-1">
                              • Trova il service account appena creato nella lista<br/>
                              • Clicca sui tre puntini (⋮) a destra → "Gestisci chiavi"<br/>
                              • Clicca "Aggiungi chiave" → "Crea nuova chiave"<br/>
                              • Seleziona formato <strong>JSON</strong><br/>
                              • Clicca "Crea"
                            </p>
                            <p className="text-xs text-gray-600 mt-1">⬇️ Il file JSON verrà scaricato automaticamente - conservalo al sicuro!</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            7
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-green-900">Configura qui sotto</p>
                            <p className="text-sm text-gray-700 mt-1">
                              • <strong>Project ID</strong>: Copia il Project ID del progetto Google Cloud<br/>
                              • <strong>Location</strong>: Scegli la region più vicina (es: "europe-west1" per Europa)<br/>
                              • <strong>Service Account JSON</strong>: Apri il file JSON scaricato, copia tutto il contenuto e incollalo nel campo qui sotto
                            </p>
                            <p className="text-xs text-green-700 mt-2 font-semibold">✅ Clicca "Salva Vertex AI" e il sistema è pronto!</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Alert className="bg-yellow-50 border-yellow-200 mt-4">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-sm text-yellow-800">
                        <strong>⚠️ Importante:</strong> Mantieni il file JSON al sicuro e non condividerlo mai pubblicamente. Contiene credenziali che danno accesso al tuo progetto Google Cloud.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl">
                          <Cloud className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <CardTitle>Configurazione Vertex AI</CardTitle>
                          <CardDescription>
                            Scegli se usare Vertex AI del SuperAdmin o configurare il tuo
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className={
                        vertexPreference?.useSuperAdminVertex && vertexPreference?.superAdminVertexAvailable
                          ? "bg-green-50 text-green-700 border-green-300"
                          : !vertexPreference?.useSuperAdminVertex && vertexPreference?.hasOwnVertex
                          ? "bg-blue-50 text-blue-700 border-blue-300"
                          : "bg-gray-50 text-gray-700 border-gray-300"
                      }>
                        {vertexPreference?.useSuperAdminVertex && vertexPreference?.superAdminVertexAvailable
                          ? "Vertex SuperAdmin"
                          : !vertexPreference?.useSuperAdminVertex && vertexPreference?.hasOwnVertex
                          ? "Vertex Proprietario"
                          : "Non configurato"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {vertexPreference?.superAdminVertexAvailable && (
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-3">
                          <Cloud className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium text-green-800">Usa Vertex AI del SuperAdmin</p>
                            <p className="text-sm text-green-600">
                              Usa la configurazione centralizzata invece di configurare le tue credenziali
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={vertexPreference?.useSuperAdminVertex ?? true}
                          onCheckedChange={handleToggleVertexPreference}
                          disabled={isSavingVertexPreference}
                        />
                      </div>
                    )}

                    {vertexPreference?.useSuperAdminVertex && vertexPreference?.superAdminVertexAvailable ? (
                      <Alert className="bg-green-50 border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-sm text-green-800">
                          Stai usando la configurazione Vertex AI centralizzata del SuperAdmin. 
                          Non è necessario configurare le tue credenziali.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <>
                        {!vertexPreference?.superAdminVertexAvailable && (
                          <Alert className="bg-yellow-50 border-yellow-200">
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-sm text-yellow-800">
                              Il SuperAdmin non ha configurato Vertex AI. Configura le tue credenziali qui sotto.
                            </AlertDescription>
                          </Alert>
                        )}

                        {vertexAiData?.settings && vertexAiData.settings.daysRemaining !== undefined && (
                          <Alert className={vertexAiData.settings.daysRemaining < 7 ? "bg-red-50 border-red-200" : vertexAiData.settings.daysRemaining < 30 ? "bg-yellow-50 border-yellow-200" : "bg-blue-50 border-blue-200"}>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              {vertexAiData.settings.daysRemaining < 0 ? (
                                "⚠️ Vertex AI è scaduto! Aggiorna le credenziali."
                              ) : vertexAiData.settings.daysRemaining < 7 ? (
                                `⚠️ Vertex AI scade tra ${vertexAiData.settings.daysRemaining} giorni! Rinnova ora.`
                              ) : vertexAiData.settings.daysRemaining < 30 ? (
                                `Vertex AI scade tra ${vertexAiData.settings.daysRemaining} giorni.`
                              ) : (
                                `Attivo. Scade tra ${vertexAiData.settings.daysRemaining} giorni.`
                              )}
                            </AlertDescription>
                          </Alert>
                        )}

                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="vertex-project-id">Project ID *</Label>
                            <Input
                              id="vertex-project-id"
                              value={vertexFormData.projectId}
                              onChange={(e) => setVertexFormData({ ...vertexFormData, projectId: e.target.value })}
                              placeholder="my-gcp-project-123"
                              className="mt-1.5"
                            />
                          </div>

                          <div>
                            <Label htmlFor="vertex-location">Location *</Label>
                            <Select
                              value={vertexFormData.location}
                              onValueChange={(value) => setVertexFormData({ ...vertexFormData, location: value })}
                            >
                              <SelectTrigger id="vertex-location" className="mt-1.5">
                                <SelectValue placeholder="Seleziona location" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="us-central1">US Central 1 (Iowa)</SelectItem>
                                <SelectItem value="us-east1">US East 1 (South Carolina)</SelectItem>
                                <SelectItem value="europe-west1">Europe West 1 (Belgium)</SelectItem>
                                <SelectItem value="europe-west4">Europe West 4 (Netherlands)</SelectItem>
                                <SelectItem value="asia-southeast1">Asia Southeast 1 (Singapore)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label htmlFor="vertex-usage-scope">Chi può usare questa configurazione? *</Label>
                            <Select
                              value={vertexFormData.usageScope}
                              onValueChange={(value: "both" | "consultant_only" | "clients_only" | "selective") => 
                                setVertexFormData({ ...vertexFormData, usageScope: value })
                              }
                            >
                              <SelectTrigger id="vertex-usage-scope" className="mt-1.5">
                                <SelectValue placeholder="Seleziona chi può usare Vertex AI" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="both">Tutti (consultant e clienti)</SelectItem>
                                <SelectItem value="consultant_only">Solo io (consultant)</SelectItem>
                                <SelectItem value="clients_only">Solo i clienti</SelectItem>
                                <SelectItem value="selective">Clienti selezionati (configurare dopo il salvataggio)</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500 mt-1">
                              Controlla chi può usare questa configurazione Vertex AI
                            </p>
                          </div>

                          <div>
                            <Label htmlFor="vertex-service-account">Service Account JSON *</Label>
                            <div className="mt-1.5">
                              <Input
                                id="vertex-service-account"
                                type="file"
                                accept=".json"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    try {
                                      const text = await file.text();
                                      const json = JSON.parse(text);
                                      setVertexFormData({ ...vertexFormData, serviceAccountJson: JSON.stringify(json) });
                                      toast({
                                        title: "✅ File caricato",
                                        description: `Service Account JSON caricato con successo (${file.name})`,
                                      });
                                    } catch (error) {
                                      toast({
                                        title: "❌ Errore",
                                        description: "Il file non è un JSON valido",
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                }}
                                className="cursor-pointer"
                              />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Carica il file JSON del Service Account di Google Cloud (salvato in chiaro nel database)
                            </p>
                          </div>
                        </div>

                        <Alert className="bg-blue-50 border-blue-200">
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm text-blue-800">
                            Vertex AI offre $300 gratuiti per 90 giorni, modelli più avanzati e migliori limiti di rate. 
                            Configuralo per ottenere la migliore esperienza!
                          </AlertDescription>
                        </Alert>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                          <Button
                            onClick={handleVertexSave}
                            disabled={!vertexFormData.projectId || !vertexFormData.location || !vertexFormData.serviceAccountJson}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Salva Vertex AI
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
                          <Key className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle>Google AI Studio</CardTitle>
                          <CardDescription>
                            Fallback automatico con rotazione API keys
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                        Fallback
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Alert info */}
                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm text-amber-800">
                        Google AI Studio viene usato automaticamente come fallback se Vertex AI non è configurato o disabilitato.
                      </AlertDescription>
                    </Alert>

                    {/* API Keys management */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Bot className="h-4 w-4 text-blue-600" />
                          Le tue API Keys ({geminiApiKeys.length}/10)
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddApiKey}
                          disabled={geminiApiKeys.length >= 10}
                          className="text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Aggiungi Key
                        </Button>
                      </div>

                      {geminiApiKeys.length === 0 ? (
                        <div className="text-sm text-slate-500 italic py-8 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                          <Bot className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                          <p className="font-medium text-slate-600 mb-1">Nessuna API key configurata</p>
                          <p className="text-xs">Clicca "Aggiungi Key" per iniziare</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {geminiApiKeys.map((apiKey, index) => (
                            <div key={index} className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg hover:bg-slate-100 transition-colors">
                              <div className="flex-shrink-0 w-8 text-center">
                                <span className="text-xs font-medium text-slate-500">#{index + 1}</span>
                              </div>
                              <Input
                                type="password"
                                value={apiKey}
                                onChange={(e) => handleApiKeyChange(index, e.target.value)}
                                className="flex-1 border-slate-200 focus:border-blue-400 focus:ring-blue-400"
                                placeholder={`API Key ${index + 1}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveApiKey(index)}
                                className="flex-shrink-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-xs text-blue-800 flex items-start gap-2">
                          <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <span>
                            Le API keys verranno ruotate automaticamente ad ogni interazione per distribuire il carico. 
                            Puoi aggiungere fino a 10 keys per massimizzare la capacità.
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <Button
                        onClick={handleGeminiSave}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Salva Modifiche
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Client AI Tab Content */}
              <TabsContent value="client-ai">
                <Alert className="mb-6 bg-indigo-50 border-indigo-200">
                  <Users className="h-5 w-5" />
                  <AlertDescription className="text-sm">
                    <strong>Gestione Multi-Tenant per Clienti</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Ogni cliente può avere le proprie credenziali AI separate</li>
                      <li>Default: usa le tue credenziali Vertex AI/Google Studio</li>
                      <li>Custom: cliente usa le sue API keys personali (se registrato)</li>
                      <li>Utile per separare i costi e i limiti di rate per cliente</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl">
                        <Users className="h-6 w-6 text-indigo-600" />
                      </div>
                      <div>
                        <CardTitle>Gestione API per Clienti</CardTitle>
                        <CardDescription>
                          Configura quale provider AI utilizzare per ogni cliente (default: Vertex AI)
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    {isLoadingClientsAi ? (
                      <div className="text-center py-8">
                        <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3" />
                        <p className="text-sm text-gray-600">Caricamento clienti...</p>
                      </div>
                    ) : !clientsAiConfig?.clients || clientsAiConfig.clients.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
                        <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-600 font-medium">Nessun cliente trovato</p>
                        <p className="text-sm text-gray-500 mt-1">Aggiungi clienti per gestire le loro API</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Alert className="bg-indigo-50 border-indigo-200">
                          <AlertCircle className="h-4 w-4 text-indigo-600" />
                          <AlertDescription className="text-sm text-indigo-800">
                            <strong>Vertex AI (default)</strong>: usa le tue credenziali Vertex AI · 
                            <strong> Google Studio</strong>: usa le tue API keys Google AI Studio · 
                            <strong> Custom</strong>: usa API keys specifiche del cliente
                          </AlertDescription>
                        </Alert>

                        <div className="space-y-3">
                          {clientsAiConfig.clients.map((client) => (
                            <ClientAIConfigRow 
                              key={client.id}
                              client={client}
                              onSave={() => queryClient.invalidateQueries({ queryKey: ["/api/consultant/client-ai-config"] })}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Email Tab Content */}
              <TabsContent value="email">
                <Alert className="mb-6 bg-blue-50 border-blue-200">
                  <Mail className="h-5 w-5" />
                  <AlertDescription className="text-sm">
                    <strong>Configurazione Email Marketing Automatico</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Configura il tuo server SMTP per inviare email automatiche ai lead</li>
                      <li>Supporta Gmail, Outlook, server custom</li>
                      <li>L'AI genererà email personalizzate basate sul tono selezionato</li>
                      <li>Testa prima con email personale per verificare la consegna</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
                        <Mail className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle>Configurazione Server SMTP</CardTitle>
                        <CardDescription>
                          Configura il server SMTP per l'invio automatico di email ai tuoi clienti
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="smtp-host">Host SMTP *</Label>
                        <Input
                          id="smtp-host"
                          placeholder="smtp.gmail.com"
                          value={smtpFormData.host}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, host: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-port">Porta *</Label>
                        <Input
                          id="smtp-port"
                          type="number"
                          placeholder="587"
                          value={smtpFormData.port}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, port: parseInt(e.target.value) })}
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                      <div className="space-y-0.5">
                        <Label htmlFor="smtp-secure">Connessione Sicura (SSL/TLS)</Label>
                        <p className="text-sm text-muted-foreground">
                          Abilita la crittografia SSL/TLS per la connessione
                        </p>
                      </div>
                      <Switch
                        id="smtp-secure"
                        checked={smtpFormData.secure}
                        onCheckedChange={(checked) => setSmtpFormData({ ...smtpFormData, secure: checked })}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="smtp-username">Username/Email *</Label>
                        <Input
                          id="smtp-username"
                          placeholder="username@example.com"
                          value={smtpFormData.username}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, username: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-password">Password *</Label>
                        <Input
                          id="smtp-password"
                          type="password"
                          placeholder="••••••••"
                          value={smtpFormData.password}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, password: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        Impostazioni Email
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="smtp-from-email">Email Mittente *</Label>
                          <Input
                            id="smtp-from-email"
                            type="email"
                            placeholder="noreply@example.com"
                            value={smtpFormData.fromEmail}
                            onChange={(e) => setSmtpFormData({ ...smtpFormData, fromEmail: e.target.value })}
                            className="mt-1.5"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="smtp-from-name">Nome Mittente *</Label>
                          <Input
                            id="smtp-from-name"
                            placeholder="Il Tuo Nome"
                            value={smtpFormData.fromName}
                            onChange={(e) => setSmtpFormData({ ...smtpFormData, fromName: e.target.value })}
                            className="mt-1.5"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="smtp-tone">Tono Email</Label>
                        <Select
                          value={smtpFormData.emailTone}
                          onValueChange={(value: "professionale" | "amichevole" | "motivazionale") => setSmtpFormData({ ...smtpFormData, emailTone: value })}
                        >
                          <SelectTrigger id="smtp-tone" className="mt-1.5">
                            <SelectValue placeholder="Seleziona il tono delle email" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professionale">Professionale</SelectItem>
                            <SelectItem value="amichevole">Amichevole</SelectItem>
                            <SelectItem value="motivazionale">Motivazionale</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="smtp-signature">Firma Email</Label>
                        <Textarea
                          id="smtp-signature"
                          placeholder="La tua firma personalizzata..."
                          rows={4}
                          value={smtpFormData.emailSignature}
                          onChange={(e) => setSmtpFormData({ ...smtpFormData, emailSignature: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                      <Button
                        onClick={async () => {
                          try {
                            const response = await fetch("/api/consultant/smtp-settings/test", {
                              method: "POST",
                              headers: {
                                ...getAuthHeaders(),
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify(smtpFormData),
                            });

                            if (!response.ok) {
                              const errorData = await response.json();
                              throw new Error(errorData.message || "Test connessione fallito");
                            }

                            toast({
                              title: "✅ Connessione Riuscita",
                              description: "La connessione SMTP è stata verificata con successo",
                            });
                          } catch (error: any) {
                            toast({
                              title: "❌ Errore di Connessione",
                              description: error.message || "Impossibile connettersi al server SMTP",
                              variant: "destructive",
                            });
                          }
                        }}
                        variant="outline"
                        className="w-full sm:w-auto"
                      >
                        Test Connessione
                      </Button>
                      <Button
                        onClick={handleSMTPSave}
                        disabled={!smtpFormData.host || !smtpFormData.username || !smtpFormData.password}
                        className="w-full sm:flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Salva SMTP
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Guida Configurazione SMTP */}
                <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm mt-6">
                  <CardHeader>
                    <Collapsible>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl">
                              <BookOpen className="h-6 w-6 text-amber-600" />
                            </div>
                            <div className="text-left">
                              <CardTitle className="text-lg">Guida Completa Configurazione SMTP</CardTitle>
                              <CardDescription>Clicca per espandere la guida passo-passo per Amazon SES e altri provider</CardDescription>
                            </div>
                          </div>
                          <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-6 space-y-8 text-sm">
                          {/* AMAZON SES SECTION */}
                          <div className="space-y-4">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-orange-600">
                              <Cloud className="h-5 w-5" />
                              Amazon SES (Consigliato)
                            </h3>
                            
                            {/* Fase 1-11 con tutte le istruzioni */}
                            <div className="space-y-4 pl-4 border-l-2 border-orange-200">
                              <div className="space-y-2">
                                <h4 className="font-semibold">FASE 1: Creare account AWS</h4>
                                <p className="text-muted-foreground">Vai su <a href="https://aws.amazon.com" target="_blank" className="text-blue-600 underline">aws.amazon.com</a> e accedi alla console</p>
                              </div>
                              
                              <div className="space-y-2">
                                <h4 className="font-semibold">FASE 2: Aprire Amazon SES</h4>
                                <p className="text-muted-foreground">Dalla console AWS vai su <a href="https://console.aws.amazon.com/ses/" target="_blank" className="text-blue-600 underline">Amazon SES</a></p>
                                <p className="text-muted-foreground">Scegli la regione Europa (Francoforte - eu-central-1)</p>
                              </div>
                              
                              <div className="space-y-2">
                                <h4 className="font-semibold">FASE 3-4: Verifica email contatto</h4>
                                <p className="text-muted-foreground">Inserisci un'email (es. Gmail), Amazon invierà una verifica. Clicca il link nell'email.</p>
                              </div>
                              
                              <div className="space-y-2">
                                <h4 className="font-semibold">FASE 5: Aggiungere dominio</h4>
                                <p className="text-muted-foreground">Dominio di invio: tuodominio.it</p>
                                <p className="text-muted-foreground">Dominio MAIL FROM: mail.tuodominio.it</p>
                              </div>
                              
                              <div className="space-y-2">
                                <h4 className="font-semibold text-red-600">FASE 6: Configurare DNS (IMPORTANTE)</h4>
                                <p className="text-muted-foreground">Clicca "Ottieni record DNS" e aggiungi nel tuo DNS:</p>
                                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                                  <li>3 record CNAME (DKIM)</li>
                                  <li>1 record MX per mail.tuodominio.it</li>
                                  <li>1 record TXT (SPF)</li>
                                  <li>1 record TXT (DMARC)</li>
                                </ul>
                                <p className="text-muted-foreground">Attendi 5-30 minuti per la verifica.</p>
                              </div>
                              
                              <div className="space-y-2">
                                <h4 className="font-semibold">FASE 7-8: Richiedi accesso produzione</h4>
                                <p className="text-muted-foreground">Dalla dashboard SES clicca "Richiedi accesso alla produzione"</p>
                                <p className="text-muted-foreground">Nel ticket indica: uso SaaS legittimo, email transazionali, solo utenti registrati, nessuna cold email.</p>
                              </div>
                              
                              <div className="space-y-2">
                                <h4 className="font-semibold text-green-600">FASE 9: Creare credenziali SMTP</h4>
                                <p className="text-muted-foreground">Vai su <a href="https://console.aws.amazon.com/ses/home#/smtp" target="_blank" className="text-blue-600 underline">SES → SMTP Settings</a></p>
                                <p className="text-muted-foreground">Clicca "Create SMTP credentials" e salva Username e Password</p>
                              </div>
                              
                              <Alert className="bg-red-50 border-red-200">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <AlertDescription className="text-red-800">
                                  <strong>ATTENZIONE:</strong> Lo Username SMTP di Amazon SES inizia con "AKIA..." e NON è la tua email! La Password è una stringa lunga random. Non usare email/password del tuo account AWS.
                                </AlertDescription>
                              </Alert>
                              
                              <div className="space-y-2">
                                <h4 className="font-semibold">FASE 10: Configurazione nel form sopra</h4>
                                <div className="bg-slate-100 p-4 rounded-lg font-mono text-xs space-y-2">
                                  <p><strong>Host:</strong> email-smtp.eu-central-1.amazonaws.com</p>
                                  <p><strong>Porta:</strong> 587</p>
                                  <p><strong>SSL/TLS:</strong> ✅ Attivo</p>
                                  <p><strong>Username:</strong> AKIA... (dallo step 9)</p>
                                  <p><strong>Password:</strong> (stringa lunga dallo step 9)</p>
                                  <p><strong>Email Mittente:</strong> no-reply@tuodominio.it</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* GMAIL SECTION */}
                          <div className="space-y-4 pt-6 border-t">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-blue-600">
                              <Mail className="h-5 w-5" />
                              Gmail (Solo per test)
                            </h3>
                            <div className="bg-slate-100 p-4 rounded-lg font-mono text-xs space-y-2">
                              <p><strong>Host:</strong> smtp.gmail.com</p>
                              <p><strong>Porta:</strong> 587</p>
                              <p><strong>SSL/TLS:</strong> ✅ Attivo</p>
                              <p><strong>Username:</strong> tuoemail@gmail.com</p>
                              <p><strong>Password:</strong> App Password (vai su myaccount.google.com → Sicurezza → Password per le app)</p>
                            </div>
                          </div>
                          
                          {/* OUTLOOK SECTION */}
                          <div className="space-y-4 pt-6 border-t">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-purple-600">
                              <Mail className="h-5 w-5" />
                              Outlook / Office 365
                            </h3>
                            <div className="bg-slate-100 p-4 rounded-lg font-mono text-xs space-y-2">
                              <p><strong>Host:</strong> smtp.office365.com</p>
                              <p><strong>Porta:</strong> 587</p>
                              <p><strong>SSL/TLS:</strong> ✅ Attivo</p>
                              <p><strong>Username:</strong> tuoemail@outlook.com</p>
                              <p><strong>Password:</strong> Password account</p>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardHeader>
                </Card>
              </TabsContent>

              {/* Calendar Tab Content - Unified View */}
              <TabsContent value="calendar" className="space-y-6">
                {/* Section 1: Connection Status Header */}
                <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-xl">
                          <Calendar className="h-6 w-6 text-cyan-600" />
                        </div>
                        <div>
                          <CardTitle>Stato Connessione Google Calendar</CardTitle>
                          <CardDescription>
                            Gestisci la connessione al tuo Google Calendar per sincronizzare gli appuntamenti
                          </CardDescription>
                        </div>
                      </div>
                      {calendarSettings?.googleCalendarConnected && !calendarSettings?.oauthNeedsReconnection && (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connesso
                        </Badge>
                      )}
                      {calendarSettings?.oauthNeedsReconnection && (
                        <Badge variant="destructive" className="bg-red-500">
                          <XCircle className="h-3 w-3 mr-1" />
                          Riconnessione necessaria
                        </Badge>
                      )}
                      {!calendarSettings?.googleCalendarConnected && !calendarSettings?.oauthNeedsReconnection && (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Non connesso
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Check if global OAuth is configured */}
                    {!calendarGlobalOAuth?.globalOAuthConfigured ? (
                      <Alert className="bg-yellow-50 border-yellow-200">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                        <AlertDescription className="text-sm text-yellow-800">
                          <strong>Configurazione in attesa</strong>
                          <p className="mt-2">
                            L'amministratore non ha ancora configurato le credenziali Google OAuth.
                            Contatta il tuo amministratore per abilitare la connessione a Google Calendar.
                          </p>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <>
                        {/* Connection Status Messages */}
                        {calendarSettings?.oauthNeedsReconnection && (
                          <Alert className="bg-red-50 border-red-200">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-sm text-red-800">
                              <strong>Riconnessione necessaria</strong>
                              <p className="mt-1">
                                {calendarSettings.oauthError || 'Il token OAuth è scaduto o revocato. Clicca "Connetti" per ripristinare la connessione.'}
                              </p>
                            </AlertDescription>
                          </Alert>
                        )}

                        {calendarSettings?.googleCalendarConnected && !calendarSettings?.oauthNeedsReconnection && (
                          <Alert className="bg-green-50 border-green-200">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-sm text-green-800">
                              <strong>Google Calendar connesso!</strong>
                              <p className="mt-1">
                                I tuoi appuntamenti vengono sincronizzati automaticamente.
                                {calendarSettings.googleCalendarEmail && (
                                  <span className="block mt-1 text-green-700">
                                    Account: <strong>{calendarSettings.googleCalendarEmail}</strong>
                                  </span>
                                )}
                              </p>
                            </AlertDescription>
                          </Alert>
                        )}

                        {!calendarSettings?.googleCalendarConnected && (
                          <Alert className="bg-blue-50 border-blue-200">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-sm text-blue-800">
                              <strong>Collega il tuo Google Calendar</strong>
                              <p className="mt-1">
                                Clicca il pulsante qui sotto per autorizzare l'accesso al tuo calendario.
                                Questo permetterà di sincronizzare automaticamente gli appuntamenti.
                              </p>
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* Buttons */}
                        <div className="flex flex-wrap gap-3">
                          <Button
                            onClick={async () => {
                              try {
                                const response = await fetch("/api/calendar-settings/oauth/start", {
                                  headers: getAuthHeaders(),
                                });

                                if (!response.ok) {
                                  const error = await response.json();
                                  throw new Error(error.message || "Errore durante l'avvio dell'autenticazione");
                                }

                                const { authUrl } = await response.json();
                                window.open(authUrl, "_blank");

                                toast({
                                  title: "Autenticazione avviata",
                                  description: "Completa l'autorizzazione nella finestra aperta, poi torna qui e aggiorna la pagina.",
                                });
                              } catch (error: any) {
                                toast({
                                  title: "Errore",
                                  description: error.message,
                                  variant: "destructive",
                                });
                              }
                            }}
                            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                          >
                            <Calendar className="h-4 w-4 mr-2" />
                            {calendarSettings?.googleCalendarConnected ? "Riconnetti Google Calendar" : "Connetti Google Calendar"}
                          </Button>

                          {calendarSettings?.googleCalendarConnected && (
                            <Button
                              onClick={async () => {
                                try {
                                  toast({
                                    title: "Test in corso...",
                                    description: "Verifico la connessione a Google Calendar",
                                  });
                                  
                                  const response = await fetch("/api/calendar-settings/test-connection", {
                                    method: "POST",
                                    headers: getAuthHeaders(),
                                  });

                                  const result = await response.json();

                                  if (result.success) {
                                    queryClient.invalidateQueries({ queryKey: ["/api/calendar-settings"] });
                                    queryClient.invalidateQueries({ queryKey: ["/api/calendar-settings/connection-status"] });
                                    toast({
                                      title: "Connessione OK!",
                                      description: `${result.message} Eventi trovati: ${result.eventsFound}${result.calendarEmail ? ` - Account: ${result.calendarEmail}` : ''}`,
                                    });
                                  } else {
                                    toast({
                                      title: "Errore Connessione",
                                      description: result.message,
                                      variant: "destructive",
                                    });
                                  }
                                } catch (error: any) {
                                  toast({
                                    title: "Errore",
                                    description: error.message,
                                    variant: "destructive",
                                  });
                                }
                              }}
                              variant="outline"
                              className="text-green-600 hover:bg-green-50 border-green-300"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Test Connessione
                            </Button>
                          )}

                          {calendarSettings?.googleCalendarConnected && (
                            <Button
                              onClick={async () => {
                                if (!confirm("Vuoi disconnettere Google Calendar? Gli appuntamenti non saranno più sincronizzati.")) return;

                                try {
                                  const response = await fetch("/api/calendar-settings/disconnect", {
                                    method: "POST",
                                    headers: getAuthHeaders(),
                                  });

                                  if (!response.ok) throw new Error("Errore durante la disconnessione");

                                  queryClient.invalidateQueries({ queryKey: ["/api/calendar-settings"] });
                                  toast({
                                    title: "Disconnesso",
                                    description: "Google Calendar disconnesso con successo",
                                  });
                                } catch (error: any) {
                                  toast({
                                    title: "Errore",
                                    description: error.message,
                                    variant: "destructive",
                                  });
                                }
                              }}
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Disconnetti
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Section 2: Calendar View */}
                {calendarSettings?.googleCalendarConnected ? (
                  <CalendarView />
                ) : (
                  <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                    <CardContent className="py-12 text-center">
                      <CalendarDays className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">Calendario non disponibile</h3>
                      <p className="text-muted-foreground">
                        Connetti il tuo Google Calendar nella sezione sopra per visualizzare i tuoi appuntamenti qui.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Section 3: Availability Settings */}
                <div className="pt-4">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-cyan-600" />
                    Configurazione Disponibilità
                  </h2>
                  <CalendarSettingsContent />
                </div>
              </TabsContent>

              {/* Lead Import Tab Content */}
              <TabsContent value="lead-import">
                {/* Integration Selector Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* CrmAle Card */}
                  <Card 
                    className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                      selectedIntegration === "crmale" 
                        ? "border-2 border-blue-500 bg-blue-50/50 shadow-md" 
                        : "border border-gray-200 bg-white hover:border-blue-300"
                    }`}
                    onClick={() => setSelectedIntegration("crmale")}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${selectedIntegration === "crmale" ? "bg-blue-100" : "bg-blue-50"}`}>
                            <Database className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">CrmAle</h3>
                            <p className="text-sm text-gray-500">Importazione automatica via API</p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={existingLeadConfig 
                            ? "bg-green-50 text-green-700 border-green-300" 
                            : "bg-gray-50 text-gray-500 border-gray-300"
                          }
                        >
                          {existingLeadConfig ? "Connesso" : "Da configurare"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>Polling ogni {leadImportFormData.pollingIntervalMinutes} minuti</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Hubdigital.io Card */}
                  <Card 
                    className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                      selectedIntegration === "hubdigital" 
                        ? "border-2 border-green-500 bg-green-50/50 shadow-md" 
                        : "border border-gray-200 bg-white hover:border-green-300"
                    }`}
                    onClick={() => setSelectedIntegration("hubdigital")}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${selectedIntegration === "hubdigital" ? "bg-green-100" : "bg-green-50"}`}>
                            <Plug className="h-6 w-6 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">Hubdigital.io</h3>
                            <p className="text-sm text-gray-500">Ricezione lead via Webhook</p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={hubdigitalConfig 
                            ? "bg-green-50 text-green-700 border-green-300" 
                            : "bg-gray-50 text-gray-500 border-gray-300"
                          }
                        >
                          {hubdigitalConfig ? "Connesso" : "Da configurare"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <Sparkles className="h-3 w-3" />
                        <span>Push istantaneo</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* CrmAle Configuration */}
                {selectedIntegration === "crmale" && (
                  <>
                    <Alert className="mb-6 bg-orange-50 border-orange-200">
                      <Server className="h-5 w-5" />
                      <AlertDescription className="text-sm">
                        <strong>Importazione Automatica Lead da API Esterna</strong>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Connetti il tuo CRM/sistema esterno per importare lead automaticamente</li>
                          <li>Polling automatico: controlla nuovi lead ogni X minuti</li>
                          <li>Lead vengono schedulati per contatto WhatsApp proattivo</li>
                          <li>Filtra per tipo, sorgente, campagna per importare solo lead rilevanti</li>
                        </ul>
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4 sm:space-y-6">
                  {/* Sezione 1: Stato Importazione */}
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-cyan-50 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <RefreshCw className="h-5 w-5 text-blue-600" />
                        Stato Importazione
                      </CardTitle>
                      <CardDescription>Stato attuale del servizio di importazione lead</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Label className="text-sm font-medium">Stato Polling:</Label>
                          <Badge
                            variant={leadImportFormData.pollingEnabled ? "default" : "secondary"}
                            className={
                              leadImportFormData.pollingEnabled
                                ? "bg-green-500 hover:bg-green-600"
                                : "bg-gray-500 hover:bg-gray-600"
                            }
                          >
                            {leadImportFormData.pollingEnabled ? "Attivo" : "Inattivo"}
                          </Badge>
                          <Button
                            variant={leadImportFormData.pollingEnabled ? "outline" : "default"}
                            size="sm"
                            onClick={handleToggleLeadPolling}
                            disabled={
                              !leadImportConfigId ||
                              startPollingMutation.isPending ||
                              stopPollingMutation.isPending
                            }
                          >
                            {startPollingMutation.isPending || stopPollingMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : leadImportFormData.pollingEnabled ? (
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
                          {formatLastImport(existingLeadConfig?.lastImportAt)}
                        </span>
                      </div>

                      <Button
                        variant="outline"
                        onClick={handleManualLeadImport}
                        disabled={!leadImportConfigId || isImporting || manualImportMutation.isPending}
                        className="w-full sm:w-auto"
                      >
                        {isImporting || manualImportMutation.isPending ? (
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
                  <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
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
                          <div className="overflow-x-auto">
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
                          </div>

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
                  <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Server className="h-5 w-5 text-indigo-600" />
                        Configurazione API
                      </CardTitle>
                      <CardDescription>Inserisci le credenziali API per l'integrazione</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* API Key */}
                      <div className="space-y-2">
                        <Label htmlFor="leadApiKey">API Key *</Label>
                        <div className="relative">
                          <Input
                            id="leadApiKey"
                            type={showLeadApiKey ? "text" : "password"}
                            placeholder="crm_live_..."
                            value={leadImportFormData.apiKey}
                            onChange={(e) => handleLeadInputChange("apiKey", e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2"
                            onClick={() => setShowLeadApiKey(!showLeadApiKey)}
                          >
                            {showLeadApiKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Base URL */}
                      <div className="space-y-2">
                        <Label htmlFor="leadBaseUrl">Base URL *</Label>
                        <Input
                          id="leadBaseUrl"
                          type="url"
                          placeholder="https://..."
                          value={leadImportFormData.baseUrl}
                          onChange={(e) => handleLeadInputChange("baseUrl", e.target.value)}
                        />
                      </div>

                      {/* Campagna Marketing */}
                      <div className="space-y-2">
                        <Label htmlFor="leadTargetCampaign">Campagna Marketing *</Label>
                        <Select
                          value={leadImportFormData.targetCampaignId}
                          onValueChange={(value) => handleLeadInputChange("targetCampaignId", value)}
                        >
                          <SelectTrigger id="leadTargetCampaign">
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
                        <Label htmlFor="leadLeadType">Tipo Lead</Label>
                        <Select
                          value={leadImportFormData.leadType}
                          onValueChange={(value: any) => handleLeadInputChange("leadType", value)}
                        >
                          <SelectTrigger id="leadLeadType">
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
                            <Label htmlFor="leadSourceFilter">Sorgente</Label>
                            <Input
                              id="leadSourceFilter"
                              placeholder="es: facebook"
                              value={leadImportFormData.sourceFilter}
                              onChange={(e) => handleLeadInputChange("sourceFilter", e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="leadCampaignFilter">Campagna</Label>
                            <Input
                              id="leadCampaignFilter"
                              placeholder="es: metodo-orbitale"
                              value={leadImportFormData.campaignFilter}
                              onChange={(e) => handleLeadInputChange("campaignFilter", e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="leadDaysFilter">Giorni</Label>
                            <Input
                              id="leadDaysFilter"
                              placeholder="es: 7, 30, all"
                              value={leadImportFormData.daysFilter}
                              onChange={(e) => handleLeadInputChange("daysFilter", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Intervallo Polling */}
                      <div className="space-y-2">
                        <Label htmlFor="leadPollingInterval">Intervallo Polling (minuti)</Label>
                        <Input
                          id="leadPollingInterval"
                          type="number"
                          min="1"
                          max="1440"
                          value={leadImportFormData.pollingIntervalMinutes}
                          onChange={(e) =>
                            handleLeadInputChange("pollingIntervalMinutes", parseInt(e.target.value) || 5)
                          }
                        />
                      </div>

                      {/* Abilita Importazione Automatica */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="leadPollingEnabled">Abilita Importazione Automatica</Label>
                          <p className="text-sm text-muted-foreground">
                            Attiva il polling automatico dei lead
                          </p>
                        </div>
                        <Switch
                          id="leadPollingEnabled"
                          checked={leadImportFormData.pollingEnabled}
                          onCheckedChange={(checked) => handleLeadInputChange("pollingEnabled", checked)}
                        />
                      </div>

                      {/* Buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <Button
                          variant="outline"
                          onClick={handleTestLeadConnection}
                          disabled={!leadImportConfigId || testConnectionMutation.isPending}
                          className="w-full sm:w-auto"
                        >
                          {testConnectionMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Test in corso...
                            </>
                          ) : (
                            "Testa Connessione"
                          )}
                        </Button>

                        <Button
                          onClick={handleSaveLeadConfiguration}
                          disabled={createLeadConfigMutation.isPending || updateLeadConfigMutation.isPending}
                          className="w-full sm:flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                        >
                          {createLeadConfigMutation.isPending || updateLeadConfigMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Salvataggio...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Salva Configurazione
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sezione 3: Storico Importazioni */}
                  <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5 text-purple-600" />
                        Storico Importazioni
                      </CardTitle>
                      <CardDescription>Cronologia delle importazioni lead recenti</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {importLogsLoading ? (
                        <div className="flex justify-center p-8">
                          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                      ) : importLogs && importLogs.length > 0 ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Data/Ora</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Lead Importati</TableHead>
                                <TableHead>Lead Aggiornati</TableHead>
                                <TableHead>Errori</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Durata</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {importLogs.map((log: any) => (
                                <TableRow key={log.id}>
                                  <TableCell className="text-sm">
                                    {log.startedAt ? new Date(log.startedAt).toLocaleString('it-IT', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    }) : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={
                                      log.importType === 'manual' 
                                        ? 'bg-blue-50 text-blue-700 border-blue-300'
                                        : 'bg-green-50 text-green-700 border-green-300'
                                    }>
                                      {log.importType === 'manual' ? 'Manuale' : 'Automatico'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center font-medium">
                                    {log.leadsImported || 0}
                                  </TableCell>
                                  <TableCell className="text-center font-medium">
                                    {log.leadsUpdated || 0}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className={log.leadsErrored > 0 ? 'text-red-600 font-medium' : ''}>
                                      {log.leadsErrored || 0}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Badge className={
                                      log.status === 'success' 
                                        ? 'bg-green-100 text-green-800 border-green-300'
                                        : log.status === 'partial'
                                        ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                                        : 'bg-red-100 text-red-800 border-red-300'
                                    }>
                                      {log.status === 'success' ? 'Successo' : log.status === 'partial' ? 'Parziale' : 'Errore'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : '-'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center p-8 text-gray-500">
                          <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p>Nessuna importazione registrata</p>
                          <p className="text-sm mt-1">Le importazioni appariranno qui dopo la prima esecuzione</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                    </div>
                  </>
                )}

                {/* Hubdigital.io Configuration */}
                {selectedIntegration === "hubdigital" && (
                  <>
                    <Alert className="mb-6 bg-green-50 border-green-200">
                      <Sparkles className="h-5 w-5 text-green-600" />
                      <AlertDescription className="text-sm text-green-800">
                        <strong>Webhook Push Istantaneo</strong> - I lead vengono ricevuti in tempo reale non appena Hubdigital.io li invia, senza necessità di polling periodico.
                      </AlertDescription>
                    </Alert>

                    {!hubdigitalConfig ? (
                      <Card className="border-0 shadow-xl bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-sm">
                        <CardHeader>
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                              <Plug className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                              <CardTitle>Configura Webhook Hubdigital.io</CardTitle>
                              <CardDescription>
                                Crea un endpoint webhook per ricevere lead da Hubdigital.io
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="space-y-2">
                            <Label htmlFor="hubdigitalDisplayName">Nome visualizzato</Label>
                            <Input
                              id="hubdigitalDisplayName"
                              value={hubdigitalFormData.displayName}
                              onChange={(e) => setHubdigitalFormData({ ...hubdigitalFormData, displayName: e.target.value })}
                              placeholder="Hubdigital.io"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="hubdigitalCampaign">Campagna di destinazione *</Label>
                            <Select
                              value={hubdigitalFormData.targetCampaignId}
                              onValueChange={(value) => setHubdigitalFormData({ ...hubdigitalFormData, targetCampaignId: value })}
                            >
                              <SelectTrigger id="hubdigitalCampaign">
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

                          <Button
                            onClick={() => createHubdigitalMutation.mutate({
                              displayName: hubdigitalFormData.displayName || "Hubdigital.io",
                              targetCampaignId: hubdigitalFormData.targetCampaignId,
                            })}
                            disabled={!hubdigitalFormData.targetCampaignId || createHubdigitalMutation.isPending}
                            className="w-full bg-green-600 hover:bg-green-700"
                          >
                            {createHubdigitalMutation.isPending ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Attivazione in corso...
                              </>
                            ) : (
                              <>
                                <Plug className="h-4 w-4 mr-2" />
                                Attiva Webhook
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-4 sm:space-y-6">
                        <Card className="border-0 shadow-xl bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-sm">
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              Stato Webhook
                            </CardTitle>
                            <CardDescription>Stato attuale del webhook Hubdigital.io</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <Label className="text-sm font-medium">Stato:</Label>
                                <Badge
                                  variant={hubdigitalConfig.isActive ? "default" : "secondary"}
                                  className={
                                    hubdigitalConfig.isActive
                                      ? "bg-green-500 hover:bg-green-600"
                                      : "bg-gray-500 hover:bg-gray-600"
                                  }
                                >
                                  {hubdigitalConfig.isActive ? "Webhook Attivo" : "Webhook Inattivo"}
                                </Badge>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                              <div className="bg-white/60 rounded-lg p-4">
                                <p className="text-sm text-gray-500">Lead ricevuti totali</p>
                                <p className="text-2xl font-bold text-green-700">
                                  {hubdigitalConfig.totalLeadsReceived || 0}
                                </p>
                              </div>
                              <div className="bg-white/60 rounded-lg p-4">
                                <p className="text-sm text-gray-500">Ultimo lead ricevuto</p>
                                <p className="text-lg font-medium text-gray-700">
                                  {hubdigitalConfig.lastWebhookAt
                                    ? new Date(hubdigitalConfig.lastWebhookAt).toLocaleString('it-IT', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })
                                    : 'Nessun lead ricevuto'}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <ExternalLink className="h-5 w-5 text-blue-600" />
                              URL Webhook
                            </CardTitle>
                            <CardDescription>Endpoint per ricevere i lead da Hubdigital.io</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <Alert className="bg-blue-50 border-blue-200">
                              <AlertCircle className="h-4 w-4 text-blue-600" />
                              <AlertDescription className="text-sm text-blue-800">
                                Fornisci questo URL al tuo cliente per ricevere i lead automaticamente da Hubdigital.io
                              </AlertDescription>
                            </Alert>

                            <div className="space-y-2">
                              <Label>URL Webhook</Label>
                              <div className="flex gap-2">
                                <Input
                                  readOnly
                                  value={`https://${window.location.host}/api/webhook/hubdigital/${hubdigitalConfig.secretKey}`}
                                  className="font-mono text-sm bg-gray-50"
                                />
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      `https://${window.location.host}/api/webhook/hubdigital/${hubdigitalConfig.secretKey}`
                                    );
                                    setHubdigitalCopied(true);
                                    setTimeout(() => setHubdigitalCopied(false), 2000);
                                    toast({
                                      title: "URL Copiato",
                                      description: "L'URL webhook è stato copiato negli appunti",
                                    });
                                  }}
                                  className="shrink-0"
                                >
                                  {hubdigitalCopied ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            <p className="text-sm text-muted-foreground">
                              Il tuo cliente deve configurare questo URL su Hubdigital.io per l'evento <strong>ContactCreate</strong>
                            </p>
                          </CardContent>
                        </Card>

                        <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Server className="h-5 w-5 text-indigo-600" />
                              Configurazione
                            </CardTitle>
                            <CardDescription>Modifica le impostazioni del webhook</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            <div className="space-y-2">
                              <Label htmlFor="hubdigitalCampaignEdit">Campagna di destinazione</Label>
                              <Select
                                value={hubdigitalConfig.targetCampaignId}
                                onValueChange={(value) => updateHubdigitalMutation.mutate({
                                  id: hubdigitalConfig.id,
                                  targetCampaignId: value,
                                })}
                              >
                                <SelectTrigger id="hubdigitalCampaignEdit">
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

                            <div className="flex items-center justify-between py-3 border-t border-b">
                              <div>
                                <Label className="text-base">Webhook Attivo</Label>
                                <p className="text-sm text-muted-foreground">
                                  Attiva o disattiva la ricezione dei lead
                                </p>
                              </div>
                              <Switch
                                checked={hubdigitalConfig.isActive}
                                onCheckedChange={(checked) => updateHubdigitalMutation.mutate({
                                  id: hubdigitalConfig.id,
                                  isActive: checked,
                                })}
                                disabled={updateHubdigitalMutation.isPending}
                              />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  if (confirm("Sei sicuro di voler rigenerare la chiave? Dovrai aggiornare l'URL nel sistema esterno.")) {
                                    regenerateHubdigitalKeyMutation.mutate(hubdigitalConfig.id);
                                  }
                                }}
                                disabled={regenerateHubdigitalKeyMutation.isPending}
                                className="flex-1"
                              >
                                {regenerateHubdigitalKeyMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                )}
                                Rigenera Chiave
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => {
                                  if (confirm("Sei sicuro di voler eliminare questa configurazione webhook? I lead non verranno più ricevuti.")) {
                                    deleteHubdigitalMutation.mutate(hubdigitalConfig.id);
                                  }
                                }}
                                disabled={deleteHubdigitalMutation.isPending}
                                className="flex-1"
                              >
                                {deleteHubdigitalMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 mr-2" />
                                )}
                                Elimina Webhook
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              {/* Video Meeting Tab Content */}
              <TabsContent value="video-meeting" className="space-y-6">
                <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-xl">
                        <Video className="h-6 w-6 text-teal-600" />
                      </div>
                      <div>
                        <CardTitle>Configurazione TURN Server per Video Meeting</CardTitle>
                        <CardDescription>
                          Configurazione centralizzata gestita dal SuperAdmin
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-sm text-blue-800">
                        <strong>Perché serve un TURN server?</strong> Quando i partecipanti sono su reti restrittive 
                        (es. NAT simmetrico, firewall aziendali, mobile 4G/5G), le connessioni dirette WebRTC falliscono. 
                        Un server TURN fa da relay per garantire che la videochiamata funzioni sempre.
                      </AlertDescription>
                    </Alert>

                    {turnConfigData?.configured ? (
                      <Alert className={turnConfigData.config?.enabled ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}>
                        {turnConfigData.config?.enabled ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                        )}
                        <AlertDescription className="text-sm">
                          {turnConfigData.config?.enabled 
                            ? "TURN server configurato e attivo dal SuperAdmin. Le videochiamate useranno il relay quando necessario."
                            : "TURN server configurato dal SuperAdmin ma attualmente disabilitato."}
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="bg-orange-50 border-orange-200">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-sm text-orange-800">
                          <strong>TURN server non configurato.</strong> Il SuperAdmin non ha ancora configurato il server TURN. 
                          Le videochiamate potrebbero non funzionare su reti restrittive. 
                          Contatta l'amministratore per richiedere la configurazione.
                        </AlertDescription>
                      </Alert>
                    )}

                    {turnConfigData?.configured && turnConfigData.config && (
                      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          <Shield className="h-4 w-4 text-teal-600" />
                          Dettagli Configurazione (dal SuperAdmin)
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Provider:</span>
                            <p className="font-medium">{turnConfigData.config.provider || "Metered"}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Stato:</span>
                            <p className={`font-medium ${turnConfigData.config.enabled ? 'text-green-600' : 'text-yellow-600'}`}>
                              {turnConfigData.config.enabled ? 'Attivo' : 'Disabilitato'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Username:</span>
                            <p className="font-medium font-mono text-xs">{turnConfigData.config.username}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Password:</span>
                            <p className="font-medium font-mono text-xs">{turnConfigData.config.password}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-teal-50 rounded-lg p-4">
                      <p className="text-sm text-teal-800">
                        <strong>Nota:</strong> La configurazione del server TURN è gestita centralmente dal SuperAdmin 
                        per garantire stabilità e sicurezza su tutte le videochiamate della piattaforma. 
                        Non è necessaria alcuna azione da parte tua.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Twilio Centralized Settings Tab Content */}
              <TabsContent value="twilio" className="space-y-6">
                {/* Guida Setup Twilio + WhatsApp */}
                <Card className="border-2 border-green-200 shadow-xl bg-gradient-to-br from-green-50 to-emerald-50">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-green-600 rounded-xl">
                        <MessageSquare className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-green-900">📖 Guida Setup Twilio + WhatsApp Business</CardTitle>
                        <CardDescription className="text-green-700">
                          Collega il tuo numero di telefono italiano a WhatsApp Business tramite Twilio
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-blue-50 border-blue-200">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-sm text-blue-800">
                        <strong>Importante:</strong> Usa un numero di telefono italiano (TIM, Vodafone, Wind, Kena, Iliad, etc.) 
                        da collegare a WhatsApp Business tramite Twilio. Non è necessario acquistare un numero virtuale su Twilio.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4 pl-4 border-l-4 border-green-300">
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            1
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-green-900">Crea un account Twilio</p>
                            <p className="text-sm text-gray-700 mt-1">
                              Vai su <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener" className="text-green-600 hover:text-green-800 underline font-medium">twilio.com/try-twilio</a> e registrati gratuitamente.
                            </p>
                            <p className="text-xs text-gray-600 mt-1">💡 L'account di prova include crediti gratuiti per iniziare</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            2
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-green-900">Ricarica il tuo account (consigliato: 20€)</p>
                            <p className="text-sm text-gray-700 mt-1">
                              Vai su <a href="https://console.twilio.com/us1/billing/manage-billing/billing-overview" target="_blank" rel="noopener" className="text-green-600 hover:text-green-800 underline font-medium">Billing → Overview</a> e aggiungi credito
                            </p>
                            <p className="text-xs text-gray-600 mt-1">💰 Puoi iniziare con 20€ per testare il servizio</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            3
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-green-900">Registra il tuo numero WhatsApp</p>
                            <p className="text-sm text-gray-700 mt-1">
                              Nel menu Twilio vai su: <a href="https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders" target="_blank" rel="noopener" className="text-green-600 hover:text-green-800 underline font-medium">Messaging → Senders → WhatsApp Senders</a>
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              📱 Inserisci il tuo numero italiano (es: +39 350 xxx xxxx) e segui la procedura di verifica
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            4
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-green-900">Collega a Meta Business Manager (se richiesto)</p>
                            <p className="text-sm text-gray-700 mt-1">
                              Se richiesto, vai su <a href="https://business.facebook.com/settings/" target="_blank" rel="noopener" className="text-green-600 hover:text-green-800 underline font-medium">Meta Business Suite</a> e verifica la tua azienda
                            </p>
                            <p className="text-xs text-gray-600 mt-1">⏳ La verifica aziendale può richiedere 1-3 giorni lavorativi</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            5
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-blue-900">Copia le credenziali API</p>
                            <p className="text-sm text-gray-700 mt-1">
                              Vai su <a href="https://console.twilio.com/" target="_blank" rel="noopener" className="text-green-600 hover:text-green-800 underline font-medium">Console Twilio (Home)</a> e copia:
                            </p>
                            <div className="bg-slate-100 p-3 rounded-lg font-mono text-xs space-y-1 mt-2">
                              <p><strong>Account SID:</strong> ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</p>
                              <p><strong>Auth Token:</strong> (clicca "Show" per visualizzarlo)</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            6
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-emerald-900">Configura qui sotto</p>
                            <p className="text-sm text-gray-700 mt-1">
                              Incolla le credenziali nei campi qui sotto e salva la configurazione
                            </p>
                            <p className="text-xs text-emerald-700 mt-2 font-semibold">✅ Clicca "Salva Configurazione" e il sistema è pronto!</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Alert className="bg-yellow-50 border-yellow-200 mt-4">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-sm text-yellow-800">
                        <strong>⚠️ Costi indicativi:</strong> Twilio addebita circa 0,005€ per messaggio WhatsApp inviato/ricevuto. 
                        Con 20€ puoi gestire circa 4.000 messaggi.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>

                {/* Form di configurazione */}
                <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl">
                        <MessageSquare className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div>
                        <CardTitle>Inserisci le tue Credenziali Twilio</CardTitle>
                        <CardDescription>
                          Queste credenziali saranno usate da tutti i tuoi agenti WhatsApp
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {twilioSettingsData?.settings && (
                      <Alert className="bg-green-50 border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-sm">
                          Twilio configurato. Account SID: {twilioSettingsData.settings.accountSid?.substring(0, 10)}...
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-4 pt-4 border-t">
                      <div className="space-y-2">
                        <Label htmlFor="twilioAccountSid">Account SID *</Label>
                        <Input
                          id="twilioAccountSid"
                          type="text"
                          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          value={twilioFormData.accountSid}
                          onChange={(e) => {
                            setTwilioFormData(prev => ({ ...prev, accountSid: e.target.value }));
                            setTwilioValidationErrors(prev => ({ ...prev, accountSid: undefined }));
                          }}
                          className={twilioValidationErrors.accountSid ? "border-red-500" : ""}
                        />
                        {twilioValidationErrors.accountSid ? (
                          <p className="text-xs text-red-500">{twilioValidationErrors.accountSid}</p>
                        ) : (
                          <p className="text-xs text-gray-500">
                            Trovi l'Account SID nella dashboard Twilio
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="twilioAuthToken">Auth Token *</Label>
                        <div className="relative">
                          <Input
                            id="twilioAuthToken"
                            type={showTwilioAuthToken ? "text" : "password"}
                            placeholder="Il tuo Auth Token Twilio"
                            value={twilioFormData.authToken}
                            onChange={(e) => {
                              setTwilioFormData(prev => ({ ...prev, authToken: e.target.value }));
                              setTwilioValidationErrors(prev => ({ ...prev, authToken: undefined }));
                            }}
                            className={twilioValidationErrors.authToken ? "border-red-500" : ""}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2"
                            onClick={() => setShowTwilioAuthToken(!showTwilioAuthToken)}
                          >
                            {showTwilioAuthToken ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        {twilioValidationErrors.authToken ? (
                          <p className="text-xs text-red-500">{twilioValidationErrors.authToken}</p>
                        ) : twilioSettingsData?.settings ? (
                          <p className="text-xs text-gray-500">
                            Auth Token già salvato. Lascia vuoto per mantenere quello esistente, oppure inserisci un nuovo token.
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="twilioWhatsappNumber">Numero WhatsApp</Label>
                        <Input
                          id="twilioWhatsappNumber"
                          type="text"
                          placeholder="+393500220129"
                          value={twilioFormData.whatsappNumber}
                          onChange={(e) => {
                            setTwilioFormData(prev => ({ ...prev, whatsappNumber: e.target.value }));
                            setTwilioValidationErrors(prev => ({ ...prev, whatsappNumber: undefined }));
                          }}
                          className={twilioValidationErrors.whatsappNumber ? "border-red-500" : ""}
                        />
                        {twilioValidationErrors.whatsappNumber ? (
                          <p className="text-xs text-red-500">{twilioValidationErrors.whatsappNumber}</p>
                        ) : (
                          <p className="text-xs text-gray-500">
                            Formato internazionale con prefisso (es: +393500220129)
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <Button
                          variant="outline"
                          onClick={handleTestTwilioConnection}
                          disabled={isTestingTwilio || !twilioFormData.accountSid}
                          className="w-full sm:w-auto"
                        >
                          {isTestingTwilio ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Test in corso...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Testa Connessione
                            </>
                          )}
                        </Button>

                        <Button
                          onClick={handleSaveTwilioSettings}
                          disabled={isSavingTwilio || !twilioFormData.accountSid || (!twilioFormData.authToken && !twilioSettingsData?.settings)}
                          className="w-full sm:flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                        >
                          {isSavingTwilio ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Salvataggio...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              {twilioSettingsData?.settings ? "Aggiorna" : "Salva"} Configurazione
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* AI Assistant */}
      <ConsultantAIAssistant />
    </div>
  );
}