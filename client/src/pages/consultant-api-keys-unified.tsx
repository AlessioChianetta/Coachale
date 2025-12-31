import { useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  BookOpen, ChevronDown, ChevronUp, Shield, Database, Plug, Copy, Check, Filter,
  MapPin, Tag, Settings, Send, User, Zap, Instagram, FileSpreadsheet, ArrowRight, X,
  History, Phone, Target
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
    const validTabs = ['ai', 'client-ai', 'email', 'calendar', 'lead-import', 'video-meeting', 'twilio', 'instagram'];
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

  // Instagram DM state (OAuth flow)
  const [instagramConnectionStatus, setInstagramConnectionStatus] = useState<"connected" | "not_configured" | "error">("not_configured");
  const [isConnectingInstagram, setIsConnectingInstagram] = useState(false);
  const [isDisconnectingInstagram, setIsDisconnectingInstagram] = useState(false);
  const [instagramOAuthData, setInstagramOAuthData] = useState<{
    username?: string;
    connectedAt?: string;
  } | null>(null);

  // Lead Import state
  const [showLeadApiKey, setShowLeadApiKey] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [leadImportConfigId, setLeadImportConfigId] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<"crmale" | "hubdigital" | "activecampaign" | "googlesheets">("crmale");
  const [googleSheetsConfigs, setGoogleSheetsConfigs] = useState<any[]>([]);
  const [selectedSheetConfig, setSelectedSheetConfig] = useState<any>(null);
  const [sheetLeadsDialogOpen, setSheetLeadsDialogOpen] = useState(false);
  const [sheetHistoryDialogOpen, setSheetHistoryDialogOpen] = useState(false);
  const [sheetLeads, setSheetLeads] = useState<any[]>([]);
  const [sheetHistory, setSheetHistory] = useState<any[]>([]);
  const [loadingSheetLeads, setLoadingSheetLeads] = useState(false);
  const [loadingSheetHistory, setLoadingSheetHistory] = useState(false);
  const [googleSheetsFormData, setGoogleSheetsFormData] = useState({
    configName: "",
    sheetUrl: "",
    agentConfigId: "",
    targetCampaignId: "",
    pollingIntervalMinutes: 15,
    pollingEnabled: false,
    startFromDate: "",
    columnMappings: {} as Record<string, string>,
    notesColumns: [] as string[],
    contactTiming: "immediate" as "immediate" | "tomorrow" | "custom",
    customContactDelay: 60,
  });
  const [isTestingGoogleSheets, setIsTestingGoogleSheets] = useState(false);
  const [isSavingGoogleSheets, setIsSavingGoogleSheets] = useState(false);
  const [googleSheetsPreview, setGoogleSheetsPreview] = useState<{
    columns: string[];
    previewRows: any[];
    totalRows: number;
    suggestedMappings: Record<string, string>;
  } | null>(null);
  const [isLoadingAiMap, setIsLoadingAiMap] = useState(false);
  const [aiMappingSuggestions, setAiMappingSuggestions] = useState<{
    columnName: string;
    suggestedField: string | null;
    confidence: number;
    rationale: string;
  }[]>([]);
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

  // Hubdigital Webhook state - Multi-config support
  const [hubdigitalFormData, setHubdigitalFormData] = useState({
    configName: "",
    agentConfigId: "",
    targetCampaignId: "",
    defaultSource: "",
    isActive: true,
  });
  const [selectedWebhookConfigId, setSelectedWebhookConfigId] = useState<string | null>(null);
  const [isCreatingNewConfig, setIsCreatingNewConfig] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [hubdigitalCopied, setHubdigitalCopied] = useState<string | null>(null);

  // ActiveCampaign Webhook state - Multi-config support
  const [activecampaignFormData, setActivecampaignFormData] = useState({
    configName: "",
    agentConfigId: "",
    targetCampaignId: "",
    defaultSource: "",
    isActive: true,
  });
  const [selectedACWebhookConfigId, setSelectedACWebhookConfigId] = useState<string | null>(null);
  const [isCreatingNewACConfig, setIsCreatingNewACConfig] = useState(false);
  const [isDuplicatingAC, setIsDuplicatingAC] = useState(false);
  const [activecampaignCopied, setActivecampaignCopied] = useState<string | null>(null);

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

  // Agents Calendar Status query for dashboard
  interface AgentCalendarStatus {
    id: string;
    agentName: string;
    agentType: string;
    isActive: boolean;
    calendarConnected: boolean;
    calendarEmail: string | null;
    calendarConnectedAt: string | null;
  }

  const { data: agentsCalendarStatus, isLoading: isLoadingAgentsCalendar } = useQuery<AgentCalendarStatus[]>({
    queryKey: ["/api/whatsapp/agents/calendar-status"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/agents/calendar-status", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch agents calendar status");
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

  // Instagram OAuth Status query
  const { data: instagramOAuthStatus, isLoading: isLoadingInstagramOAuth } = useQuery({
    queryKey: ["/api/instagram/oauth/status"],
    queryFn: async () => {
      const response = await fetch("/api/instagram/oauth/status", {
        headers: getAuthHeaders(),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("Failed to fetch Instagram OAuth status");
      }
      if (response.status === 404) return { connected: false };
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
  
  // Filter all hubdigital configs from webhook configs
  const hubdigitalConfigs = webhookConfigs?.filter((c: any) => c.providerName === "hubdigital") || [];
  
  // Filter all activecampaign configs from webhook configs
  const activecampaignConfigs = webhookConfigs?.filter((c: any) => c.providerName === "activecampaign") || [];
  
  // Query for proactive WhatsApp agents (only agents with isProactiveAgent=true AND Twilio configured)
  const { data: proactiveAgentsData } = useQuery({
    queryKey: ["/api/whatsapp/config/proactive"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/config/proactive", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return { configs: [] };
        return { configs: [] };
      }
      return response.json();
    },
  });
  
  const proactiveAgents = proactiveAgentsData?.configs || [];

  // Query for Google Sheets import jobs
  const { data: googleSheetsJobsData, refetch: refetchGoogleSheetsJobs } = useQuery({
    queryKey: ["/api/consultant/lead-import/sheets"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/lead-import/sheets", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return { data: [] };
        return { data: [] };
      }
      return response.json();
    },
  });

  // Update googleSheetsConfigs when data is loaded
  useEffect(() => {
    if (googleSheetsJobsData?.data) {
      setGoogleSheetsConfigs(googleSheetsJobsData.data);
    }
  }, [googleSheetsJobsData]);

  // Auto-select first proactive agent for Google Sheets form
  useEffect(() => {
    if (proactiveAgents.length > 0 && !googleSheetsFormData.agentConfigId) {
      setGoogleSheetsFormData(prev => ({
        ...prev,
        agentConfigId: proactiveAgents[0].id,
      }));
    }
  }, [proactiveAgents, googleSheetsFormData.agentConfigId]);
  
  // Helper function to get agent name by ID
  const getAgentName = (agentId: string) => {
    const agent = proactiveAgents?.find((a: any) => a.id === agentId);
    return agent?.agentName || agent?.whatsappNumber || "Agente non trovato";
  };

  // Hubdigital Webhook mutations
  const createHubdigitalMutation = useMutation({
    mutationFn: async (data: { configName: string; agentConfigId: string; targetCampaignId: string; defaultSource?: string; isActive: boolean }) => {
      const response = await fetch("/api/external-api/webhook-configs", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          providerName: "hubdigital",
          displayName: "Hubdigital.io",
          configName: data.configName,
          agentConfigId: data.agentConfigId,
          targetCampaignId: data.targetCampaignId,
          defaultSource: data.defaultSource || null,
          isActive: data.isActive,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Errore durante la creazione del webhook");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Webhook Creato",
        description: "La configurazione Hubdigital.io è stata creata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/external-api/webhook-configs"] });
      setIsCreatingNewConfig(false);
      setIsDuplicating(false);
      setHubdigitalFormData({ configName: "", agentConfigId: "", targetCampaignId: "", defaultSource: "", isActive: true });
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
    mutationFn: async (data: { id: string; configName?: string; agentConfigId?: string; targetCampaignId?: string; defaultSource?: string | null; isActive?: boolean }) => {
      const response = await fetch(`/api/external-api/webhook-configs/${data.id}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          configName: data.configName,
          agentConfigId: data.agentConfigId,
          targetCampaignId: data.targetCampaignId,
          defaultSource: data.defaultSource,
          isActive: data.isActive,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Errore durante l'aggiornamento");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configurazione Aggiornata",
        description: "Le modifiche sono state salvate",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/external-api/webhook-configs"] });
      setSelectedWebhookConfigId(null);
      setHubdigitalFormData({ configName: "", agentConfigId: "", targetCampaignId: "", defaultSource: "", isActive: true });
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

  // ActiveCampaign Webhook mutations
  const createActivecampaignMutation = useMutation({
    mutationFn: async (data: { configName: string; agentConfigId: string; targetCampaignId: string; defaultSource?: string; isActive: boolean }) => {
      const response = await fetch("/api/external-api/webhook-configs", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          providerName: "activecampaign",
          displayName: "ActiveCampaign",
          configName: data.configName,
          agentConfigId: data.agentConfigId,
          targetCampaignId: data.targetCampaignId,
          defaultSource: data.defaultSource || null,
          isActive: data.isActive,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Errore durante la creazione del webhook");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Webhook Creato",
        description: "La configurazione ActiveCampaign è stata creata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/external-api/webhook-configs"] });
      setIsCreatingNewACConfig(false);
      setIsDuplicatingAC(false);
      setActivecampaignFormData({ configName: "", agentConfigId: "", targetCampaignId: "", defaultSource: "", isActive: true });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateActivecampaignMutation = useMutation({
    mutationFn: async (data: { id: string; configName?: string; agentConfigId?: string; targetCampaignId?: string; defaultSource?: string | null; isActive?: boolean }) => {
      const response = await fetch(`/api/external-api/webhook-configs/${data.id}`, {
        method: "PATCH",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          configName: data.configName,
          agentConfigId: data.agentConfigId,
          targetCampaignId: data.targetCampaignId,
          defaultSource: data.defaultSource,
          isActive: data.isActive,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Errore durante l'aggiornamento");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configurazione Aggiornata",
        description: "Le modifiche sono state salvate",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/external-api/webhook-configs"] });
      setSelectedACWebhookConfigId(null);
      setActivecampaignFormData({ configName: "", agentConfigId: "", targetCampaignId: "", defaultSource: "", isActive: true });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const regenerateActivecampaignKeyMutation = useMutation({
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
        description: "La nuova chiave webhook è stata generata. Aggiorna l'URL in ActiveCampaign.",
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

  const deleteActivecampaignMutation = useMutation({
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
        description: "La configurazione ActiveCampaign è stata rimossa",
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

  // State per il test del webhook Hubdigital - Expanded with all fields
  const [hubdigitalTestData, setHubdigitalTestData] = useState({
    // Dati base
    firstName: "Mario",
    lastName: "Rossi",
    email: "mario.rossi@test.com",
    phone: "+39 333 1234567",
    companyName: "Test SRL",
    source: "hubdigital-test",
    website: "",
    dateOfBirth: "",
    // Indirizzo
    address1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Italia",
    // GHL IDs
    locationId: "loc_test123",
    contactId: "contact_test456",
    assignedTo: "",
    // Tags
    tags: [] as string[],
    tagInput: "",
    // Custom fields
    customFieldKey: "",
    customFieldValue: "",
    customFields: [] as Array<{id: string, value: string}>,
    // DND
    dnd: false,
  });
  const [showAdvancedTest, setShowAdvancedTest] = useState(false);
  const [hubdigitalTestResult, setHubdigitalTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const [isTestingHubdigital, setIsTestingHubdigital] = useState(false);

  // State for selected test config
  const [selectedTestConfigId, setSelectedTestConfigId] = useState<string | null>(null);

  // State for ActiveCampaign webhook test
  const [activecampaignTestData, setActivecampaignTestData] = useState({
    firstName: "Mario",
    lastName: "Rossi",
    email: "mario.rossi@test.com",
    phone: "+39 333 1234567",
    tags: [] as string[],
    tagInput: "",
    customFieldKey: "",
    customFieldValue: "",
    customFields: [] as Array<{field: string, value: string}>,
  });
  const [showAdvancedACTest, setShowAdvancedACTest] = useState(false);
  const [activecampaignTestResult, setActivecampaignTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const [isTestingActivecampaign, setIsTestingActivecampaign] = useState(false);
  const [selectedACTestConfigId, setSelectedACTestConfigId] = useState<string | null>(null);

  const handleTestHubdigitalWebhook = async () => {
    // Use the selected test config or the first available one
    const testConfig = selectedTestConfigId 
      ? hubdigitalConfigs.find((c: any) => c.id === selectedTestConfigId)
      : hubdigitalConfigs[0];
    
    if (!testConfig?.secretKey) return;
    
    setIsTestingHubdigital(true);
    setHubdigitalTestResult(null);

    try {
      const payload: any = {
        type: "ContactCreate",
        firstName: hubdigitalTestData.firstName,
        lastName: hubdigitalTestData.lastName,
        email: hubdigitalTestData.email || undefined,
        phone: hubdigitalTestData.phone,
        companyName: hubdigitalTestData.companyName || undefined,
        source: hubdigitalTestData.source,
        dateAdded: new Date().toISOString(),
        // GHL IDs
        locationId: hubdigitalTestData.locationId || undefined,
        id: hubdigitalTestData.contactId || undefined,
        // Extra fields
        website: hubdigitalTestData.website || undefined,
        dateOfBirth: hubdigitalTestData.dateOfBirth || undefined,
        assignedTo: hubdigitalTestData.assignedTo || undefined,
        // Address
        address1: hubdigitalTestData.address1 || undefined,
        city: hubdigitalTestData.city || undefined,
        state: hubdigitalTestData.state || undefined,
        postalCode: hubdigitalTestData.postalCode || undefined,
        country: hubdigitalTestData.country || undefined,
        // Tags
        tags: hubdigitalTestData.tags.length > 0 ? hubdigitalTestData.tags : undefined,
        // Custom fields
        customFields: hubdigitalTestData.customFields.length > 0 ? hubdigitalTestData.customFields : undefined,
        // DND
        dnd: hubdigitalTestData.dnd || undefined,
      };
      
      // Remove undefined values
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      const response = await fetch(`/api/webhook/hubdigital/${testConfig.secretKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setHubdigitalTestResult({
          success: true,
          message: `Lead creato con successo nella configurazione "${testConfig.configName || testConfig.displayName || 'Hubdigital.io'}"!`,
          details: data,
        });
        toast({
          title: "Test Riuscito",
          description: `Lead di test creato con ID: ${data.leadId}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/external-api/webhook-configs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/proactive-leads"] });
      } else {
        setHubdigitalTestResult({
          success: false,
          message: data.error || "Errore durante il test",
          details: data,
        });
        toast({
          title: "Test Fallito",
          description: data.error || "Errore sconosciuto",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setHubdigitalTestResult({
        success: false,
        message: error.message || "Errore di connessione",
      });
      toast({
        title: "Errore",
        description: "Impossibile contattare il webhook",
        variant: "destructive",
      });
    } finally {
      setIsTestingHubdigital(false);
    }
  };

  const handleTestActivecampaignWebhook = async () => {
    const testConfig = selectedACTestConfigId 
      ? activecampaignConfigs.find((c: any) => c.id === selectedACTestConfigId)
      : activecampaignConfigs[0];
    
    if (!testConfig?.secretKey) return;
    
    setIsTestingActivecampaign(true);
    setActivecampaignTestResult(null);

    try {
      // Build payload matching ActiveCampaign webhook format
      const payload: any = {
        type: "contact_add",
        date_time: new Date().toISOString(),
        initiated_by: "admin",
        initiated_from: "test-ui",
        contact: {
          id: `ac_test_${Date.now()}`,
          email: activecampaignTestData.email || undefined,
          phone: activecampaignTestData.phone,
          firstName: activecampaignTestData.firstName,
          lastName: activecampaignTestData.lastName,
          tags: activecampaignTestData.tags.length > 0 ? activecampaignTestData.tags.join(",") : undefined,
          fieldValues: activecampaignTestData.customFields.length > 0 ? activecampaignTestData.customFields : undefined,
        },
      };

      const response = await fetch(`/api/webhook/activecampaign/${testConfig.secretKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setActivecampaignTestResult({
          success: true,
          message: `Lead creato con successo nella configurazione "${testConfig.configName || testConfig.displayName || 'ActiveCampaign'}"!`,
          details: data,
        });
        toast({
          title: "Test Riuscito",
          description: `Lead di test creato con ID: ${data.leadId}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/external-api/webhook-configs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/proactive-leads"] });
      } else {
        setActivecampaignTestResult({
          success: false,
          message: data.error || "Errore durante il test",
          details: data,
        });
        toast({
          title: "Test Fallito",
          description: data.error || "Errore sconosciuto",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setActivecampaignTestResult({
        success: false,
        message: error.message || "Errore di connessione",
      });
      toast({
        title: "Errore",
        description: "Impossibile contattare il webhook",
        variant: "destructive",
      });
    } finally {
      setIsTestingActivecampaign(false);
    }
  };

  const { data: pendingLeads, isLoading: pendingLeadsLoading } = useQuery({
    queryKey: ['/api/proactive-leads', { status: 'pending' }],
    queryFn: async () => {
      const response = await fetch('/api/proactive-leads?status=pending', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch pending leads');
      const data = await response.json();
      return data.leads || [];
    },
    refetchInterval: 30000,
    enabled: false, // Disabled - not needed in this page
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

  // Gemini Preference query - determines if consultant uses SuperAdmin Gemini keys or own
  const { data: geminiPreference, isLoading: isLoadingGeminiPreference } = useQuery({
    queryKey: ["/api/consultant/gemini-preference"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/gemini-preference", {
        headers: getAuthHeaders(),
      });
      if (response.status === 404) return { useSuperAdminGemini: true, superAdminGeminiAvailable: false, hasOwnGeminiKeys: false };
      if (!response.ok) throw new Error("Errore nel caricamento preferenza Gemini");
      return response.json();
    },
  });

  const [isSavingGeminiPreference, setIsSavingGeminiPreference] = useState(false);

  const handleToggleGeminiPreference = async () => {
    setIsSavingGeminiPreference(true);
    try {
      const newValue = !geminiPreference?.useSuperAdminGemini;
      const response = await fetch("/api/consultant/gemini-preference", {
        method: "PUT",
        headers: { 
          ...getAuthHeaders(),
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ useSuperAdminGemini: newValue }),
      });
      if (!response.ok) throw new Error("Errore nel salvataggio");
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/gemini-preference"] });
      toast({
        title: newValue ? "SuperAdmin Gemini abilitato" : "Gemini personale abilitato",
        description: newValue 
          ? "Userai le API keys Gemini del SuperAdmin"
          : "Userai le tue API keys Gemini personali",
      });
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingGeminiPreference(false);
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

  // Sync Instagram OAuth status
  useEffect(() => {
    if (instagramOAuthStatus) {
      if (instagramOAuthStatus.connected) {
        setInstagramConnectionStatus("connected");
        setInstagramOAuthData({
          username: instagramOAuthStatus.username,
          connectedAt: instagramOAuthStatus.connectedAt,
        });
      } else {
        setInstagramConnectionStatus("not_configured");
        setInstagramOAuthData(null);
      }
    }
  }, [instagramOAuthStatus]);

  // Handle Instagram OAuth callback query params (success/error)
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const instagramSuccess = params.get('instagram_success');
    const instagramError = params.get('instagram_error');
    
    if (instagramSuccess) {
      toast({
        title: "Instagram Connesso!",
        description: "Il tuo account Instagram è stato collegato con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/oauth/status"] });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (instagramError) {
      toast({
        title: "Errore Connessione",
        description: decodeURIComponent(instagramError),
        variant: "destructive",
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, toast, queryClient]);

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
                <TabsTrigger value="instagram" className="data-[state=active]:bg-cyan-100 data-[state=active]:text-cyan-700 text-xs sm:text-sm">
                  <Instagram className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Instagram DM</span>
                  <span className="sm:hidden">IG</span>
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
                      <Badge variant="outline" className={
                        geminiPreference?.useSuperAdminGemini && geminiPreference?.superAdminGeminiAvailable
                          ? "bg-blue-50 text-blue-700 border-blue-300"
                          : geminiPreference?.hasOwnGeminiKeys
                          ? "bg-green-50 text-green-700 border-green-300"
                          : "bg-gray-50 text-gray-700 border-gray-300"
                      }>
                        {geminiPreference?.useSuperAdminGemini && geminiPreference?.superAdminGeminiAvailable
                          ? "Gemini SuperAdmin"
                          : geminiPreference?.hasOwnGeminiKeys
                          ? "Gemini Personale"
                          : "Non configurato"}
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

                    {/* SuperAdmin Gemini Toggle */}
                    {geminiPreference?.superAdminGeminiAvailable && (
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-3">
                          <Key className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="font-medium text-blue-800">Usa Gemini API Keys del SuperAdmin</p>
                            <p className="text-sm text-blue-600">
                              Usa la configurazione centralizzata invece di configurare le tue API keys
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={geminiPreference?.useSuperAdminGemini ?? true}
                          onCheckedChange={handleToggleGeminiPreference}
                          disabled={isSavingGeminiPreference}
                        />
                      </div>
                    )}

                    {geminiPreference?.useSuperAdminGemini && geminiPreference?.superAdminGeminiAvailable ? (
                      <Alert className="bg-blue-50 border-blue-200">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-sm text-blue-800">
                          Stai usando le API keys Gemini centralizzate del SuperAdmin. 
                          Non è necessario configurare le tue API keys.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <>
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
                      </>
                    )}
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

              {/* Calendar Tab Content - Agents Dashboard */}
              <TabsContent value="calendar" className="space-y-6">
                {/* Header */}
                <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-xl">
                          <Calendar className="h-6 w-6 text-cyan-600" />
                        </div>
                        <div>
                          <CardTitle>Calendari Agenti WhatsApp</CardTitle>
                          <CardDescription>
                            Ogni agente WhatsApp ha il proprio calendario Google dedicato per gestire gli appuntamenti
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {agentsCalendarStatus && (
                          <>
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {agentsCalendarStatus.filter(a => a.calendarConnected).length} Collegati
                            </Badge>
                            <Badge variant="secondary">
                              <XCircle className="h-3 w-3 mr-1" />
                              {agentsCalendarStatus.filter(a => !a.calendarConnected).length} Non collegati
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>

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
                    {/* Agents Grid */}
                    {isLoadingAgentsCalendar ? (
                      <div className="flex justify-center items-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        <span className="ml-3 text-gray-500">Caricamento agenti...</span>
                      </div>
                    ) : agentsCalendarStatus && agentsCalendarStatus.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {agentsCalendarStatus.map((agent) => (
                          <Card 
                            key={agent.id} 
                            className={`border-2 transition-all hover:shadow-lg ${
                              agent.calendarConnected 
                                ? "border-green-200 bg-green-50/50" 
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-lg ${agent.calendarConnected ? "bg-green-100" : "bg-gray-100"}`}>
                                    <Calendar className={`h-5 w-5 ${agent.calendarConnected ? "text-green-600" : "text-gray-400"}`} />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-gray-900">{agent.agentName}</h3>
                                    <p className="text-xs text-gray-500 capitalize">
                                      {agent.agentType?.replace(/_/g, " ") || "Agente"}
                                    </p>
                                  </div>
                                </div>
                                <Badge 
                                  variant={agent.isActive ? "default" : "secondary"}
                                  className={agent.isActive ? "bg-blue-500 text-xs" : "text-xs"}
                                >
                                  {agent.isActive ? "Attivo" : "Inattivo"}
                                </Badge>
                              </div>

                              {/* Calendar Status */}
                              <div className="mb-4">
                                {agent.calendarConnected ? (
                                  <div className="flex items-center gap-2 p-2 bg-green-100 rounded-lg">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-green-700">Calendario Collegato</p>
                                      <p className="text-xs text-green-600 truncate">{agent.calendarEmail}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
                                    <XCircle className="h-4 w-4 text-gray-400" />
                                    <p className="text-xs text-gray-500">Nessun calendario collegato</p>
                                  </div>
                                )}
                              </div>

                              {/* Action Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  window.location.href = `/consultant/whatsapp?edit=${agent.id}&step=1`;
                                }}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                {agent.calendarConnected ? "Gestisci Calendario" : "Collega Calendario"}
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                        <CardContent className="py-12 text-center">
                          <CalendarDays className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                          <h3 className="text-lg font-semibold text-gray-600 mb-2">Nessun agente WhatsApp</h3>
                          <p className="text-muted-foreground mb-4">
                            Crea un agente WhatsApp per poter configurare il suo calendario.
                          </p>
                          <Button
                            onClick={() => {
                              window.location.href = "/consultant/whatsapp";
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Crea Agente WhatsApp
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </TabsContent>

              {/* Lead Import Tab Content */}
              <TabsContent value="lead-import">
                {/* Integration Selector Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
                          className={hubdigitalConfigs.length > 0 
                            ? "bg-green-50 text-green-700 border-green-300" 
                            : "bg-gray-50 text-gray-500 border-gray-300"
                          }
                        >
                          {hubdigitalConfigs.length > 0 ? `${hubdigitalConfigs.length} Config.` : "Da configurare"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <Sparkles className="h-3 w-3" />
                        <span>Push istantaneo</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ActiveCampaign Card */}
                  <Card 
                    className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                      selectedIntegration === "activecampaign" 
                        ? "border-2 border-purple-500 bg-purple-50/50 shadow-md" 
                        : "border border-gray-200 bg-white hover:border-purple-300"
                    }`}
                    onClick={() => setSelectedIntegration("activecampaign")}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${selectedIntegration === "activecampaign" ? "bg-purple-100" : "bg-purple-50"}`}>
                            <Zap className="h-6 w-6 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">ActiveCampaign</h3>
                            <p className="text-sm text-gray-500">Ricezione lead via Webhook</p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={activecampaignConfigs.length > 0 
                            ? "bg-green-50 text-green-700 border-green-300" 
                            : "bg-gray-50 text-gray-500 border-gray-300"
                          }
                        >
                          {activecampaignConfigs.length > 0 ? `${activecampaignConfigs.length} Config.` : "Da configurare"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <Sparkles className="h-3 w-3" />
                        <span>Push istantaneo</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Google Sheets Card */}
                  <Card 
                    className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                      selectedIntegration === "googlesheets" 
                        ? "border-2 border-blue-500 bg-blue-50/50 shadow-md" 
                        : "border border-gray-200 bg-white hover:border-blue-300"
                    }`}
                    onClick={() => setSelectedIntegration("googlesheets")}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${selectedIntegration === "googlesheets" ? "bg-blue-100" : "bg-blue-50"}`}>
                            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">Google Sheets</h3>
                            <p className="text-sm text-gray-500">Sync automatico da foglio</p>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={googleSheetsConfigs.length > 0 
                            ? "bg-green-50 text-green-700 border-green-300" 
                            : "bg-gray-50 text-gray-500 border-gray-300"
                          }
                        >
                          {googleSheetsConfigs.length > 0 ? `${googleSheetsConfigs.length} Config.` : "Da configurare"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>Polling ogni {googleSheetsFormData.pollingIntervalMinutes} minuti</span>
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

                {/* Hubdigital.io Configuration - Multi-config support */}
                {selectedIntegration === "hubdigital" && (
                  <>
                    <Alert className="mb-4 bg-green-50 border-green-200">
                      <Sparkles className="h-5 w-5 text-green-600" />
                      <AlertDescription className="text-sm text-green-800">
                        <strong>Webhook Push Istantaneo</strong> - I lead vengono ricevuti in tempo reale non appena Hubdigital.io li invia, senza necessità di polling periodico. Puoi configurare più webhook per diverse campagne e agenti.
                      </AlertDescription>
                    </Alert>

                    {/* Source Filter Explanation */}
                    <Alert className="mb-4 bg-purple-50 border-purple-200">
                      <Filter className="h-5 w-5 text-purple-600" />
                      <AlertDescription className="text-sm text-purple-800">
                        <strong>Filtro Fonte (Source Filter)</strong> - Se imposti un "Filtro Fonte" nella configurazione, il webhook accetterà <strong>SOLO</strong> i lead che arrivano con quella fonte esatta nel campo <code className="bg-purple-100 px-1 rounded">source</code>. I lead con fonte diversa verranno scartati automaticamente e conteggiati nella colonna "Scartati". Se lasci il filtro vuoto, tutti i lead verranno accettati.
                      </AlertDescription>
                    </Alert>

                    {/* Field Mapping Legend */}
                    <Collapsible className="mb-6">
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-between bg-blue-50 border-blue-200 hover:bg-blue-100">
                          <span className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-blue-800">Legenda Campi Mappati da Hubdigital</span>
                          </span>
                          <ChevronDown className="h-4 w-4 text-blue-600" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <Card className="border-blue-200 bg-blue-50/50">
                          <CardContent className="pt-4 space-y-4">
                            <p className="text-sm text-blue-800">
                              Tabella completa dei campi che Hubdigital.io invia via webhook:
                            </p>
                            
                            {/* Metadati Evento */}
                            <div>
                              <h4 className="text-xs font-semibold text-blue-700 uppercase mb-2">Metadati Evento</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 shrink-0">type</Badge>
                                  <span className="text-gray-700">Tipo evento - Solo "ContactCreate" viene processato</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 shrink-0">locationId</Badge>
                                  <span className="text-gray-700">ID location GHL → leadInfo.ghlLocationId</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 shrink-0">id</Badge>
                                  <span className="text-gray-700">ID contatto GHL → leadInfo.ghlContactId</span>
                                </div>
                              </div>
                            </div>

                            {/* Dati Anagrafici */}
                            <div>
                              <h4 className="text-xs font-semibold text-blue-700 uppercase mb-2">Dati Anagrafici</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 shrink-0">firstName</Badge>
                                  <span className="text-gray-700">Nome del lead</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 shrink-0">lastName</Badge>
                                  <span className="text-gray-700">Cognome del lead</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 shrink-0">name</Badge>
                                  <span className="text-gray-700">Nome completo (diviso in nome/cognome)</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 shrink-0">dateOfBirth</Badge>
                                  <span className="text-gray-700">Data di nascita → leadInfo.dateOfBirth</span>
                                </div>
                              </div>
                            </div>

                            {/* Dati Contatto */}
                            <div>
                              <h4 className="text-xs font-semibold text-blue-700 uppercase mb-2">Dati Contatto</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div className="flex items-start gap-2 p-2 bg-white rounded border border-green-300">
                                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 shrink-0">phone *</Badge>
                                  <span className="text-gray-700">Telefono (obbligatorio) → phoneNumber</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 shrink-0">email</Badge>
                                  <span className="text-gray-700">Email → leadInfo.email</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 shrink-0">address1</Badge>
                                  <span className="text-gray-700">Indirizzo → leadInfo.address</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 shrink-0">city</Badge>
                                  <span className="text-gray-700">Città → leadInfo.city</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 shrink-0">state</Badge>
                                  <span className="text-gray-700">Provincia → leadInfo.state</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 shrink-0">postalCode</Badge>
                                  <span className="text-gray-700">CAP → leadInfo.postalCode</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 shrink-0">country</Badge>
                                  <span className="text-gray-700">Paese → leadInfo.country</span>
                                </div>
                              </div>
                            </div>

                            {/* Dati Aziendali */}
                            <div>
                              <h4 className="text-xs font-semibold text-blue-700 uppercase mb-2">Dati Aziendali (B2B)</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 shrink-0">companyName</Badge>
                                  <span className="text-gray-700">Nome azienda → leadInfo.companyName</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 shrink-0">website</Badge>
                                  <span className="text-gray-700">Sito web → leadInfo.website</span>
                                </div>
                              </div>
                            </div>

                            {/* Metadati CRM */}
                            <div>
                              <h4 className="text-xs font-semibold text-blue-700 uppercase mb-2">Metadati CRM</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 shrink-0">source</Badge>
                                  <span className="text-gray-700">Fonte → leadInfo.fonte (sovrascrivibile)</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 shrink-0">dateAdded</Badge>
                                  <span className="text-gray-700">Data aggiunta → leadInfo.dateAdded</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 shrink-0">customFields</Badge>
                                  <span className="text-gray-700">Campi personalizzati → leadInfo.customFields</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-dashed">
                                  <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-300 shrink-0">assignedTo</Badge>
                                  <span className="text-gray-500">ID utente assegnato - Non salvato</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-dashed">
                                  <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-300 shrink-0">tags</Badge>
                                  <span className="text-gray-500">Tag associati - Non salvato</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-dashed">
                                  <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-300 shrink-0">attachments</Badge>
                                  <span className="text-gray-500">Allegati - Non salvato</span>
                                </div>
                              </div>
                            </div>

                            {/* DND */}
                            <div>
                              <h4 className="text-xs font-semibold text-blue-700 uppercase mb-2">Privacy - DND (Do Not Disturb)</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-dashed">
                                  <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-300 shrink-0">dnd</Badge>
                                  <span className="text-gray-500">Flag DND globale - Non salvato</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-dashed">
                                  <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-300 shrink-0">dndSettings</Badge>
                                  <span className="text-gray-500">Impostazioni DND per canale - Non salvato</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-xs pt-2 border-t">
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-white border rounded"></div>
                                <span className="text-gray-600">Mappato</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-gray-50 border border-dashed rounded"></div>
                                <span className="text-gray-500">Non salvato</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-[10px] px-1">*</Badge>
                                <span className="text-gray-600">Obbligatorio</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Header with New Config Button */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Configurazioni Webhook</h3>
                      <Button
                        onClick={() => {
                          setIsCreatingNewConfig(true);
                          setSelectedWebhookConfigId(null);
                          setIsDuplicating(false);
                          setHubdigitalFormData({ configName: "", agentConfigId: "", targetCampaignId: "", defaultSource: "", isActive: true });
                        }}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Nuova Configurazione
                      </Button>
                    </div>

                    {/* Create/Edit Form Collapsible */}
                    {(isCreatingNewConfig || selectedWebhookConfigId) && (
                      <Card className="border-2 border-green-300 shadow-xl bg-gradient-to-br from-green-50 to-emerald-50 mb-6">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-3 bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl">
                                <Plug className="h-6 w-6 text-green-600" />
                              </div>
                              <div>
                                <CardTitle>
                                  {isDuplicating ? "Duplica Configurazione" : selectedWebhookConfigId ? "Modifica Configurazione" : "Nuova Configurazione"}
                                </CardTitle>
                                <CardDescription>
                                  {isDuplicating ? "Crea una copia con una nuova chiave segreta" : selectedWebhookConfigId ? "Modifica i dettagli del webhook" : "Crea un nuovo endpoint webhook per ricevere lead"}
                                </CardDescription>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setIsCreatingNewConfig(false);
                                setSelectedWebhookConfigId(null);
                                setIsDuplicating(false);
                                setHubdigitalFormData({ configName: "", agentConfigId: "", targetCampaignId: "", defaultSource: "", isActive: true });
                              }}
                            >
                              <XCircle className="h-5 w-5" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Validation Warning */}
                          {hubdigitalFormData.agentConfigId && hubdigitalFormData.targetCampaignId && (
                            (() => {
                              const duplicate = hubdigitalConfigs.find((c: any) => 
                                c.id !== selectedWebhookConfigId &&
                                c.agentConfigId === hubdigitalFormData.agentConfigId &&
                                c.targetCampaignId === hubdigitalFormData.targetCampaignId &&
                                c.isActive
                              );
                              if (duplicate) {
                                return (
                                  <Alert className="bg-yellow-50 border-yellow-300">
                                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                                    <AlertDescription className="text-sm text-yellow-800">
                                      <strong>Attenzione:</strong> Esiste già una configurazione ATTIVA con lo stesso agente e campagna. I lead potrebbero essere duplicati.
                                    </AlertDescription>
                                  </Alert>
                                );
                              }
                              return null;
                            })()
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="hubdigitalConfigName">Nome Configurazione *</Label>
                              <Input
                                id="hubdigitalConfigName"
                                value={hubdigitalFormData.configName}
                                onChange={(e) => setHubdigitalFormData({ ...hubdigitalFormData, configName: e.target.value })}
                                placeholder="es. Campagna Facebook Gennaio"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="hubdigitalAgent">Agente WhatsApp Proattivo *</Label>
                              <Select
                                value={hubdigitalFormData.agentConfigId}
                                onValueChange={(value) => setHubdigitalFormData({ ...hubdigitalFormData, agentConfigId: value })}
                              >
                                <SelectTrigger id="hubdigitalAgent">
                                  <SelectValue placeholder="Seleziona un agente proattivo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {!proactiveAgents || proactiveAgents.length === 0 ? (
                                    <div className="p-3 text-sm text-muted-foreground space-y-1">
                                      <p className="font-medium">Nessun agente proattivo configurato</p>
                                      <p className="text-xs">Per usare questa funzione, crea un agente WhatsApp e abilita la modalità proattiva nelle sue impostazioni.</p>
                                    </div>
                                  ) : (
                                    proactiveAgents.map((agent: any) => (
                                      <SelectItem key={agent.id} value={agent.id}>
                                        {agent.agentName || agent.whatsappNumber}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
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

                            <div className="space-y-2">
                              <Label htmlFor="hubdigitalSource">Fonte Lead (opzionale)</Label>
                              <Input
                                id="hubdigitalSource"
                                value={hubdigitalFormData.defaultSource}
                                onChange={(e) => setHubdigitalFormData({ ...hubdigitalFormData, defaultSource: e.target.value })}
                                placeholder="es. facebook-ads, google-ads, landing-page"
                              />
                              <p className="text-xs text-muted-foreground">
                                Se impostato, sovrascrive la fonte inviata da Hubdigital
                              </p>
                            </div>

                            <div className="flex items-center gap-3 pt-6">
                              <Switch
                                id="hubdigitalIsActive"
                                checked={hubdigitalFormData.isActive}
                                onCheckedChange={(checked) => setHubdigitalFormData({ ...hubdigitalFormData, isActive: checked })}
                              />
                              <Label htmlFor="hubdigitalIsActive">Webhook Attivo</Label>
                            </div>
                          </div>

                          <div className="flex gap-3 pt-4">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setIsCreatingNewConfig(false);
                                setSelectedWebhookConfigId(null);
                                setIsDuplicating(false);
                                setHubdigitalFormData({ configName: "", agentConfigId: "", targetCampaignId: "", defaultSource: "", isActive: true });
                              }}
                              className="flex-1"
                            >
                              Annulla
                            </Button>
                            <Button
                              onClick={() => {
                                if (selectedWebhookConfigId && !isDuplicating) {
                                  updateHubdigitalMutation.mutate({
                                    id: selectedWebhookConfigId,
                                    configName: hubdigitalFormData.configName,
                                    agentConfigId: hubdigitalFormData.agentConfigId,
                                    targetCampaignId: hubdigitalFormData.targetCampaignId,
                                    defaultSource: hubdigitalFormData.defaultSource || null,
                                    isActive: hubdigitalFormData.isActive,
                                  });
                                } else {
                                  createHubdigitalMutation.mutate({
                                    configName: hubdigitalFormData.configName || "Nuova Configurazione",
                                    agentConfigId: hubdigitalFormData.agentConfigId,
                                    targetCampaignId: hubdigitalFormData.targetCampaignId,
                                    defaultSource: hubdigitalFormData.defaultSource || null,
                                    isActive: hubdigitalFormData.isActive,
                                  });
                                }
                              }}
                              disabled={
                                !hubdigitalFormData.agentConfigId ||
                                !hubdigitalFormData.targetCampaignId ||
                                createHubdigitalMutation.isPending ||
                                updateHubdigitalMutation.isPending
                              }
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              {createHubdigitalMutation.isPending || updateHubdigitalMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Salvataggio...
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-2" />
                                  {selectedWebhookConfigId && !isDuplicating ? "Salva Modifiche" : "Crea Webhook"}
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Configs List */}
                    {hubdigitalConfigs.length === 0 && !isCreatingNewConfig ? (
                      <Card className="border-0 shadow-xl bg-gradient-to-br from-gray-50 to-slate-50 backdrop-blur-sm">
                        <CardContent className="py-12 text-center">
                          <Plug className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                          <p className="text-lg font-medium text-gray-600">Nessuna configurazione webhook</p>
                          <p className="text-sm text-gray-500 mt-1">Clicca "Nuova Configurazione" per iniziare a ricevere lead</p>
                        </CardContent>
                      </Card>
                    ) : hubdigitalConfigs.length > 0 && (
                      <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Plug className="h-5 w-5 text-green-600" />
                            Configurazioni Attive ({hubdigitalConfigs.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Nome</TableHead>
                                  <TableHead>Agente</TableHead>
                                  <TableHead>Campagna</TableHead>
                                  <TableHead>Filtro Fonte</TableHead>
                                  <TableHead>Stato</TableHead>
                                  <TableHead className="text-center">Importati</TableHead>
                                  <TableHead className="text-center">Scartati</TableHead>
                                  <TableHead>URL Webhook</TableHead>
                                  <TableHead className="text-right">Azioni</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {hubdigitalConfigs.map((config: any) => (
                                  <TableRow key={config.id}>
                                    <TableCell className="font-medium">
                                      {config.configName || config.displayName || "Hubdigital.io"}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                                        {getAgentName(config.agentConfigId)}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {campaigns.find((c: any) => c.id === config.targetCampaignId)?.campaignName || "-"}
                                    </TableCell>
                                    <TableCell>
                                      {config.defaultSource ? (
                                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 font-mono text-xs">
                                          {config.defaultSource}
                                        </Badge>
                                      ) : (
                                        <span className="text-gray-400 text-xs">Tutti</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={config.isActive ? "default" : "secondary"}
                                        className={config.isActive ? "bg-green-500" : "bg-gray-400"}
                                      >
                                        {config.isActive ? "Attivo" : "Inattivo"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-center font-bold text-green-700">
                                      {config.totalLeadsReceived || 0}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {(config.skippedLeadsCount || 0) > 0 ? (
                                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                                          {config.skippedLeadsCount}
                                        </Badge>
                                      ) : (
                                        <span className="text-gray-400">0</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <code className="text-xs bg-gray-100 px-2 py-1 rounded truncate max-w-[200px]">
                                          .../{config.secretKey?.substring(0, 8)}...
                                        </code>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            navigator.clipboard.writeText(
                                              `https://${window.location.host}/api/webhook/hubdigital/${config.secretKey}`
                                            );
                                            setHubdigitalCopied(config.id);
                                            setTimeout(() => setHubdigitalCopied(null), 2000);
                                            toast({
                                              title: "URL Copiato",
                                              description: "L'URL webhook è stato copiato negli appunti",
                                            });
                                          }}
                                        >
                                          {hubdigitalCopied === config.id ? (
                                            <Check className="h-4 w-4 text-green-600" />
                                          ) : (
                                            <Copy className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setSelectedWebhookConfigId(config.id);
                                            setIsCreatingNewConfig(false);
                                            setIsDuplicating(false);
                                            setHubdigitalFormData({
                                              configName: config.configName || config.displayName || "",
                                              agentConfigId: config.agentConfigId || "",
                                              targetCampaignId: config.targetCampaignId || "",
                                              defaultSource: config.defaultSource || "",
                                              isActive: config.isActive,
                                            });
                                          }}
                                          title="Modifica"
                                        >
                                          <Server className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setIsCreatingNewConfig(true);
                                            setSelectedWebhookConfigId(null);
                                            setIsDuplicating(true);
                                            setHubdigitalFormData({
                                              configName: (config.configName || config.displayName || "Config") + " (Copia)",
                                              agentConfigId: config.agentConfigId || "",
                                              targetCampaignId: config.targetCampaignId || "",
                                              defaultSource: config.defaultSource || "",
                                              isActive: true,
                                            });
                                          }}
                                          title="Duplica"
                                        >
                                          <Copy className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => updateHubdigitalMutation.mutate({
                                            id: config.id,
                                            isActive: !config.isActive,
                                          })}
                                          title={config.isActive ? "Disattiva" : "Attiva"}
                                        >
                                          {config.isActive ? (
                                            <XCircle className="h-4 w-4 text-yellow-600" />
                                          ) : (
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                          )}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            if (confirm("Sei sicuro di voler rigenerare la chiave? Dovrai aggiornare l'URL nel sistema esterno.")) {
                                              regenerateHubdigitalKeyMutation.mutate(config.id);
                                            }
                                          }}
                                          title="Rigenera Chiave"
                                        >
                                          <RefreshCw className="h-4 w-4 text-blue-600" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            if (confirm("Sei sicuro di voler eliminare questa configurazione? I lead non verranno più ricevuti.")) {
                                              deleteHubdigitalMutation.mutate(config.id);
                                            }
                                          }}
                                          title="Elimina"
                                        >
                                          <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Test Webhook Section - Only show if there are configs */}
                    {hubdigitalConfigs.length > 0 && (
                      <Card className="border-2 border-orange-200 shadow-2xl bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 mt-6 overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-500 text-white pb-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <Sparkles className="h-6 w-6 text-white" />
                              </div>
                              <div>
                                <CardTitle className="text-xl text-white">Test Webhook Completo</CardTitle>
                                <CardDescription className="text-orange-100">Simula l'invio di un lead con tutti i campi disponibili</CardDescription>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                              {hubdigitalConfigs.length} config
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                          {/* Config Selection */}
                          <div className="p-4 bg-white/60 rounded-xl border border-orange-200 shadow-sm">
                            <Label className="text-sm font-semibold text-orange-800 mb-2 block">Configurazione da Testare</Label>
                            <Select
                              value={selectedTestConfigId || hubdigitalConfigs[0]?.id || ""}
                              onValueChange={(configId) => {
                                setSelectedTestConfigId(configId);
                                const config = hubdigitalConfigs.find((c: any) => c.id === configId);
                                if (config) {
                                  setHubdigitalTestData(prev => ({
                                    ...prev,
                                    source: `hubdigital-test-${config.configName || config.displayName || "hubdigital"}`
                                  }));
                                }
                              }}
                            >
                              <SelectTrigger className="bg-white border-orange-200 focus:border-orange-400">
                                <SelectValue placeholder="Seleziona una configurazione" />
                              </SelectTrigger>
                              <SelectContent>
                                {hubdigitalConfigs.map((config: any) => (
                                  <SelectItem key={config.id} value={config.id}>
                                    <span className="flex items-center gap-2">
                                      {config.isActive ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-gray-400" />}
                                      {config.configName || config.displayName || "Hubdigital.io"}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Source Override Warning */}
                          {(() => {
                            const testConfig = selectedTestConfigId 
                              ? hubdigitalConfigs.find((c: any) => c.id === selectedTestConfigId)
                              : hubdigitalConfigs[0];
                            if (testConfig?.defaultSource) {
                              return (
                                <Alert className="bg-purple-50 border-purple-200 rounded-xl">
                                  <AlertCircle className="h-4 w-4 text-purple-600" />
                                  <AlertDescription className="text-sm text-purple-800">
                                    <strong>Nota:</strong> Fonte predefinita "<span className="font-mono bg-purple-100 px-1 rounded">{testConfig.defaultSource}</span>" sovrascriverà il campo Fonte.
                                  </AlertDescription>
                                </Alert>
                              );
                            }
                            return null;
                          })()}

                          {/* Basic Fields */}
                          <div className="space-y-4">
                            <h4 className="font-semibold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                              <User className="h-4 w-4 text-orange-600" />
                              Dati Contatto Base
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                <Label htmlFor="testFirstName" className="text-xs font-medium text-gray-600">Nome</Label>
                                <Input
                                  id="testFirstName"
                                  value={hubdigitalTestData.firstName}
                                  onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, firstName: e.target.value }))}
                                  placeholder="Mario"
                                  className="bg-white border-gray-200 focus:border-orange-400"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="testLastName" className="text-xs font-medium text-gray-600">Cognome</Label>
                                <Input
                                  id="testLastName"
                                  value={hubdigitalTestData.lastName}
                                  onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, lastName: e.target.value }))}
                                  placeholder="Rossi"
                                  className="bg-white border-gray-200 focus:border-orange-400"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="testPhone" className="text-xs font-medium text-orange-700 flex items-center gap-1">
                                  Telefono <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="testPhone"
                                  value={hubdigitalTestData.phone}
                                  onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, phone: e.target.value }))}
                                  placeholder="+39 333 1234567"
                                  className={`bg-white ${!hubdigitalTestData.phone.trim() ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-orange-400"}`}
                                />
                                {!hubdigitalTestData.phone.trim() && (
                                  <p className="text-xs text-red-500">Obbligatorio</p>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="testEmail" className="text-xs font-medium text-gray-600">Email</Label>
                                <Input
                                  id="testEmail"
                                  type="email"
                                  value={hubdigitalTestData.email}
                                  onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, email: e.target.value }))}
                                  placeholder="mario.rossi@test.com"
                                  className="bg-white border-gray-200 focus:border-orange-400"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="testCompany" className="text-xs font-medium text-gray-600">Azienda</Label>
                                <Input
                                  id="testCompany"
                                  value={hubdigitalTestData.companyName}
                                  onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, companyName: e.target.value }))}
                                  placeholder="Test SRL"
                                  className="bg-white border-gray-200 focus:border-orange-400"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="testSource" className="text-xs font-medium text-gray-600">Fonte</Label>
                                <Input
                                  id="testSource"
                                  value={hubdigitalTestData.source}
                                  onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, source: e.target.value }))}
                                  placeholder="hubdigital-test"
                                  className="bg-white border-gray-200 focus:border-orange-400"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Advanced Fields Toggle */}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowAdvancedTest(!showAdvancedTest)}
                            className="w-full border-dashed border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400"
                          >
                            {showAdvancedTest ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-2" />
                                Nascondi Campi Avanzati
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-2" />
                                Mostra Tutti i Campi (Indirizzo, Tags, DND...)
                              </>
                            )}
                          </Button>

                          {/* Advanced Fields */}
                          {showAdvancedTest && (
                            <div className="space-y-6 p-4 bg-gradient-to-br from-amber-50/50 to-orange-50/50 rounded-xl border border-orange-200/50">
                              {/* Address */}
                              <div className="space-y-4">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                                  <MapPin className="h-4 w-4 text-orange-600" />
                                  Indirizzo
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  <div className="sm:col-span-2 lg:col-span-3 space-y-1.5">
                                    <Label className="text-xs font-medium text-gray-600">Via/Indirizzo</Label>
                                    <Input
                                      value={hubdigitalTestData.address1}
                                      onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, address1: e.target.value }))}
                                      placeholder="Via Roma 123"
                                      className="bg-white border-gray-200"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-gray-600">Città</Label>
                                    <Input
                                      value={hubdigitalTestData.city}
                                      onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, city: e.target.value }))}
                                      placeholder="Milano"
                                      className="bg-white border-gray-200"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-gray-600">Provincia/Stato</Label>
                                    <Input
                                      value={hubdigitalTestData.state}
                                      onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, state: e.target.value }))}
                                      placeholder="MI"
                                      className="bg-white border-gray-200"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-gray-600">CAP</Label>
                                    <Input
                                      value={hubdigitalTestData.postalCode}
                                      onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, postalCode: e.target.value }))}
                                      placeholder="20100"
                                      className="bg-white border-gray-200"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-gray-600">Paese</Label>
                                    <Input
                                      value={hubdigitalTestData.country}
                                      onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, country: e.target.value }))}
                                      placeholder="Italia"
                                      className="bg-white border-gray-200"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Extra Fields */}
                              <div className="space-y-4">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                                  <FileText className="h-4 w-4 text-orange-600" />
                                  Dati Aggiuntivi
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-gray-600">Sito Web</Label>
                                    <Input
                                      value={hubdigitalTestData.website}
                                      onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, website: e.target.value }))}
                                      placeholder="https://example.com"
                                      className="bg-white border-gray-200"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-gray-600">Data di Nascita</Label>
                                    <Input
                                      type="date"
                                      value={hubdigitalTestData.dateOfBirth}
                                      onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                                      className="bg-white border-gray-200"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-gray-600">GHL Location ID</Label>
                                    <Input
                                      value={hubdigitalTestData.locationId}
                                      onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, locationId: e.target.value }))}
                                      placeholder="loc_xxx"
                                      className="bg-white border-gray-200 font-mono text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-gray-600">GHL Contact ID</Label>
                                    <Input
                                      value={hubdigitalTestData.contactId}
                                      onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, contactId: e.target.value }))}
                                      placeholder="contact_xxx"
                                      className="bg-white border-gray-200 font-mono text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-gray-600">Assegnato a (User ID)</Label>
                                    <Input
                                      value={hubdigitalTestData.assignedTo}
                                      onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, assignedTo: e.target.value }))}
                                      placeholder="user_xxx"
                                      className="bg-white border-gray-200 font-mono text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1.5 flex items-end">
                                    <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200 w-full">
                                      <Switch
                                        checked={hubdigitalTestData.dnd}
                                        onCheckedChange={(checked) => setHubdigitalTestData(prev => ({ ...prev, dnd: checked }))}
                                      />
                                      <Label className="text-xs font-medium text-gray-600">DND (Do Not Disturb)</Label>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Tags */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                                  <Tag className="h-4 w-4 text-orange-600" />
                                  Tags
                                </h4>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="Aggiungi un tag..."
                                    value={hubdigitalTestData.tagInput}
                                    onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, tagInput: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && hubdigitalTestData.tagInput.trim()) {
                                        e.preventDefault();
                                        setHubdigitalTestData(prev => ({
                                          ...prev,
                                          tags: [...prev.tags, prev.tagInput.trim()],
                                          tagInput: "",
                                        }));
                                      }
                                    }}
                                    className="flex-1 bg-white border-gray-200"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (hubdigitalTestData.tagInput.trim()) {
                                        setHubdigitalTestData(prev => ({
                                          ...prev,
                                          tags: [...prev.tags, prev.tagInput.trim()],
                                          tagInput: "",
                                        }));
                                      }
                                    }}
                                    disabled={!hubdigitalTestData.tagInput.trim()}
                                    className="border-orange-300 text-orange-700"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                                {hubdigitalTestData.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {hubdigitalTestData.tags.map((tag, idx) => (
                                      <Badge 
                                        key={idx} 
                                        className="bg-orange-100 text-orange-800 cursor-pointer hover:bg-red-100 hover:text-red-800 transition-colors"
                                        onClick={() => {
                                          setHubdigitalTestData(prev => ({
                                            ...prev,
                                            tags: prev.tags.filter((_, i) => i !== idx)
                                          }));
                                        }}
                                      >
                                        {tag} <span className="ml-1">×</span>
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Custom Fields */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                                  <Settings className="h-4 w-4 text-orange-600" />
                                  Custom Fields
                                </h4>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="ID Campo (es. campo_xyz123)"
                                    value={hubdigitalTestData.customFieldKey}
                                    onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, customFieldKey: e.target.value }))}
                                    className="flex-1 bg-white border-gray-200 font-mono text-xs"
                                  />
                                  <Input
                                    placeholder="Valore"
                                    value={hubdigitalTestData.customFieldValue}
                                    onChange={(e) => setHubdigitalTestData(prev => ({ ...prev, customFieldValue: e.target.value }))}
                                    className="flex-1 bg-white border-gray-200"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (hubdigitalTestData.customFieldKey.trim() && hubdigitalTestData.customFieldValue.trim()) {
                                        setHubdigitalTestData(prev => ({
                                          ...prev,
                                          customFields: [...prev.customFields, { id: prev.customFieldKey.trim(), value: prev.customFieldValue.trim() }],
                                          customFieldKey: "",
                                          customFieldValue: "",
                                        }));
                                      }
                                    }}
                                    disabled={!hubdigitalTestData.customFieldKey.trim() || !hubdigitalTestData.customFieldValue.trim()}
                                    className="border-orange-300 text-orange-700"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                                {hubdigitalTestData.customFields.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {hubdigitalTestData.customFields.map((cf, idx) => (
                                      <Badge 
                                        key={idx} 
                                        variant="secondary" 
                                        className="bg-purple-100 text-purple-800 cursor-pointer hover:bg-red-100 hover:text-red-800 transition-colors font-mono text-xs"
                                        onClick={() => {
                                          setHubdigitalTestData(prev => ({
                                            ...prev,
                                            customFields: prev.customFields.filter((_, i) => i !== idx)
                                          }));
                                        }}
                                      >
                                        {cf.id}: {cf.value} <span className="ml-1">×</span>
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Send Button */}
                          <Button
                            onClick={handleTestHubdigitalWebhook}
                            disabled={isTestingHubdigital || !hubdigitalTestData.phone.trim() || hubdigitalConfigs.length === 0}
                            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-200 h-12 text-base font-semibold"
                          >
                            {isTestingHubdigital ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Invio in corso...
                              </>
                            ) : (
                              <>
                                <Send className="h-5 w-5 mr-2" />
                                Invia Lead di Test
                              </>
                            )}
                          </Button>

                          {/* Result */}
                          {hubdigitalTestResult && (
                            <Alert className={`rounded-xl ${hubdigitalTestResult.success ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
                              {hubdigitalTestResult.success ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600" />
                              )}
                              <AlertDescription className="text-sm">
                                <strong className={hubdigitalTestResult.success ? "text-green-800" : "text-red-800"}>
                                  {hubdigitalTestResult.success ? "Successo!" : "Errore:"}
                                </strong>{" "}
                                <span className={hubdigitalTestResult.success ? "text-green-700" : "text-red-700"}>
                                  {hubdigitalTestResult.message}
                                </span>
                                {hubdigitalTestResult.details && (
                                  <pre className="mt-3 p-3 bg-white/70 rounded-lg text-xs overflow-auto max-h-40 border border-gray-200">
                                    {JSON.stringify(hubdigitalTestResult.details, null, 2)}
                                  </pre>
                                )}
                              </AlertDescription>
                            </Alert>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {/* ActiveCampaign Configuration */}
                {selectedIntegration === "activecampaign" && (
                  <>
                    <Alert className="mb-4 bg-purple-50 border-purple-200">
                      <Zap className="h-5 w-5 text-purple-600" />
                      <AlertDescription className="text-sm text-purple-800">
                        <strong>Webhook Push Istantaneo da ActiveCampaign</strong> - I lead vengono ricevuti in tempo reale quando un contatto viene aggiunto o si iscrive in ActiveCampaign. Configura il webhook in ActiveCampaign: Settings → Developer → Webhooks.
                      </AlertDescription>
                    </Alert>

                    {/* ActiveCampaign Field Mapping Legend */}
                    <Collapsible className="mb-6">
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-between bg-purple-50 border-purple-200 hover:bg-purple-100">
                          <span className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-purple-600" />
                            <span className="text-purple-800">Legenda Campi Mappati da ActiveCampaign</span>
                          </span>
                          <ChevronDown className="h-4 w-4 text-purple-600" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <Card className="border-purple-200 bg-purple-50/50">
                          <CardContent className="pt-4 space-y-4">
                            <p className="text-sm text-purple-800">
                              Campi che ActiveCampaign invia via webhook:
                            </p>
                            
                            <div>
                              <h4 className="text-xs font-semibold text-purple-700 uppercase mb-2">Dati Contatto</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div className="flex items-start gap-2 p-2 bg-white rounded border border-green-300">
                                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 shrink-0">phone *</Badge>
                                  <span className="text-gray-700">Telefono (obbligatorio) → phoneNumber</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 shrink-0">firstName</Badge>
                                  <span className="text-gray-700">Nome del contatto</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 shrink-0">lastName</Badge>
                                  <span className="text-gray-700">Cognome del contatto</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 shrink-0">email</Badge>
                                  <span className="text-gray-700">Email → leadInfo.email</span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="text-xs font-semibold text-purple-700 uppercase mb-2">Metadati</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 shrink-0">contact.id</Badge>
                                  <span className="text-gray-700">ID contatto AC → leadInfo.acContactId</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 shrink-0">contact.tags</Badge>
                                  <span className="text-gray-700">Tags → leadInfo.tags</span>
                                </div>
                                <div className="flex items-start gap-2 p-2 bg-white rounded border">
                                  <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 shrink-0">contact.fieldValues</Badge>
                                  <span className="text-gray-700">Campi custom → leadInfo.customFields</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-xs pt-2 border-t">
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-[10px] px-1">*</Badge>
                                <span className="text-gray-600">Obbligatorio</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Header with New Config Button */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Configurazioni Webhook ActiveCampaign</h3>
                      <Button
                        onClick={() => {
                          setIsCreatingNewACConfig(true);
                          setSelectedACWebhookConfigId(null);
                          setIsDuplicatingAC(false);
                          setActivecampaignFormData({ configName: "", agentConfigId: "", targetCampaignId: "", defaultSource: "", isActive: true });
                        }}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Nuova Configurazione
                      </Button>
                    </div>

                    {/* Create/Edit Form */}
                    {(isCreatingNewACConfig || selectedACWebhookConfigId) && (
                      <Card className="border-2 border-purple-300 shadow-xl bg-gradient-to-br from-purple-50 to-violet-50 mb-6">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-3 bg-gradient-to-br from-purple-100 to-violet-100 rounded-xl">
                                <Zap className="h-6 w-6 text-purple-600" />
                              </div>
                              <div>
                                <CardTitle>
                                  {isDuplicatingAC ? "Duplica Configurazione" : selectedACWebhookConfigId ? "Modifica Configurazione" : "Nuova Configurazione"}
                                </CardTitle>
                                <CardDescription>
                                  {isDuplicatingAC ? "Crea una copia con una nuova chiave segreta" : selectedACWebhookConfigId ? "Modifica i dettagli del webhook" : "Crea un nuovo endpoint webhook per ricevere lead da ActiveCampaign"}
                                </CardDescription>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setIsCreatingNewACConfig(false);
                                setSelectedACWebhookConfigId(null);
                                setIsDuplicatingAC(false);
                                setActivecampaignFormData({ configName: "", agentConfigId: "", targetCampaignId: "", defaultSource: "", isActive: true });
                              }}
                            >
                              <XCircle className="h-5 w-5" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Validation Warning */}
                          {activecampaignFormData.agentConfigId && activecampaignFormData.targetCampaignId && (
                            (() => {
                              const duplicate = activecampaignConfigs.find((c: any) => 
                                c.id !== selectedACWebhookConfigId &&
                                c.agentConfigId === activecampaignFormData.agentConfigId &&
                                c.targetCampaignId === activecampaignFormData.targetCampaignId &&
                                c.isActive
                              );
                              if (duplicate) {
                                return (
                                  <Alert className="bg-yellow-50 border-yellow-300">
                                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                                    <AlertDescription className="text-sm text-yellow-800">
                                      <strong>Attenzione:</strong> Esiste già una configurazione ATTIVA con lo stesso agente e campagna. I lead potrebbero essere duplicati.
                                    </AlertDescription>
                                  </Alert>
                                );
                              }
                              return null;
                            })()
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="activecampaignConfigName">Nome Configurazione *</Label>
                              <Input
                                id="activecampaignConfigName"
                                value={activecampaignFormData.configName}
                                onChange={(e) => setActivecampaignFormData({ ...activecampaignFormData, configName: e.target.value })}
                                placeholder="es. Campagna Newsletter Gennaio"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="activecampaignAgent">Agente WhatsApp Proattivo *</Label>
                              <Select
                                value={activecampaignFormData.agentConfigId}
                                onValueChange={(value) => setActivecampaignFormData({ ...activecampaignFormData, agentConfigId: value })}
                              >
                                <SelectTrigger id="activecampaignAgent">
                                  <SelectValue placeholder="Seleziona un agente proattivo" />
                                </SelectTrigger>
                                <SelectContent>
                                  {!proactiveAgents || proactiveAgents.length === 0 ? (
                                    <div className="p-3 text-sm text-muted-foreground space-y-1">
                                      <p className="font-medium">Nessun agente proattivo configurato</p>
                                      <p className="text-xs">Per usare questa funzione, crea un agente WhatsApp e abilita la modalità proattiva nelle sue impostazioni.</p>
                                    </div>
                                  ) : (
                                    proactiveAgents.map((agent: any) => (
                                      <SelectItem key={agent.id} value={agent.id}>
                                        {agent.agentName || agent.whatsappNumber}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="activecampaignCampaign">Campagna di destinazione *</Label>
                              <Select
                                value={activecampaignFormData.targetCampaignId}
                                onValueChange={(value) => setActivecampaignFormData({ ...activecampaignFormData, targetCampaignId: value })}
                              >
                                <SelectTrigger id="activecampaignCampaign">
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

                            <div className="space-y-2">
                              <Label htmlFor="activecampaignSource">Fonte Lead (opzionale)</Label>
                              <Input
                                id="activecampaignSource"
                                value={activecampaignFormData.defaultSource}
                                onChange={(e) => setActivecampaignFormData({ ...activecampaignFormData, defaultSource: e.target.value })}
                                placeholder="es. activecampaign, newsletter"
                              />
                              <p className="text-xs text-muted-foreground">
                                Se impostato, sovrascrive la fonte. Default: "activecampaign"
                              </p>
                            </div>

                            <div className="flex items-center gap-3 pt-6">
                              <Switch
                                id="activecampaignIsActive"
                                checked={activecampaignFormData.isActive}
                                onCheckedChange={(checked) => setActivecampaignFormData({ ...activecampaignFormData, isActive: checked })}
                              />
                              <Label htmlFor="activecampaignIsActive">Webhook Attivo</Label>
                            </div>
                          </div>

                          <div className="flex gap-3 pt-4">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setIsCreatingNewACConfig(false);
                                setSelectedACWebhookConfigId(null);
                                setIsDuplicatingAC(false);
                                setActivecampaignFormData({ configName: "", agentConfigId: "", targetCampaignId: "", defaultSource: "", isActive: true });
                              }}
                              className="flex-1"
                            >
                              Annulla
                            </Button>
                            <Button
                              onClick={() => {
                                if (selectedACWebhookConfigId && !isDuplicatingAC) {
                                  updateActivecampaignMutation.mutate({
                                    id: selectedACWebhookConfigId,
                                    configName: activecampaignFormData.configName,
                                    agentConfigId: activecampaignFormData.agentConfigId,
                                    targetCampaignId: activecampaignFormData.targetCampaignId,
                                    defaultSource: activecampaignFormData.defaultSource || null,
                                    isActive: activecampaignFormData.isActive,
                                  });
                                } else {
                                  createActivecampaignMutation.mutate({
                                    configName: activecampaignFormData.configName || "Nuova Configurazione AC",
                                    agentConfigId: activecampaignFormData.agentConfigId,
                                    targetCampaignId: activecampaignFormData.targetCampaignId,
                                    defaultSource: activecampaignFormData.defaultSource || null,
                                    isActive: activecampaignFormData.isActive,
                                  });
                                }
                              }}
                              disabled={
                                !activecampaignFormData.agentConfigId ||
                                !activecampaignFormData.targetCampaignId ||
                                createActivecampaignMutation.isPending ||
                                updateActivecampaignMutation.isPending
                              }
                              className="flex-1 bg-purple-600 hover:bg-purple-700"
                            >
                              {createActivecampaignMutation.isPending || updateActivecampaignMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Salvataggio...
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-2" />
                                  {selectedACWebhookConfigId && !isDuplicatingAC ? "Salva Modifiche" : "Crea Webhook"}
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Configs List */}
                    {activecampaignConfigs.length === 0 && !isCreatingNewACConfig ? (
                      <Card className="border-0 shadow-xl bg-gradient-to-br from-gray-50 to-slate-50 backdrop-blur-sm">
                        <CardContent className="py-12 text-center">
                          <Zap className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                          <p className="text-lg font-medium text-gray-600">Nessuna configurazione webhook ActiveCampaign</p>
                          <p className="text-sm text-gray-500 mt-1">Clicca "Nuova Configurazione" per iniziare a ricevere lead</p>
                        </CardContent>
                      </Card>
                    ) : activecampaignConfigs.length > 0 && (
                      <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Zap className="h-5 w-5 text-purple-600" />
                            Configurazioni Attive ({activecampaignConfigs.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Nome</TableHead>
                                  <TableHead>Agente</TableHead>
                                  <TableHead>Campagna</TableHead>
                                  <TableHead>Fonte</TableHead>
                                  <TableHead>Stato</TableHead>
                                  <TableHead className="text-center">Importati</TableHead>
                                  <TableHead>URL Webhook</TableHead>
                                  <TableHead className="text-right">Azioni</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {activecampaignConfigs.map((config: any) => (
                                  <TableRow key={config.id}>
                                    <TableCell className="font-medium">
                                      {config.configName || config.displayName || "ActiveCampaign"}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                                        {getAgentName(config.agentConfigId)}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {campaigns.find((c: any) => c.id === config.targetCampaignId)?.campaignName || "-"}
                                    </TableCell>
                                    <TableCell>
                                      {config.defaultSource ? (
                                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 font-mono text-xs">
                                          {config.defaultSource}
                                        </Badge>
                                      ) : (
                                        <span className="text-gray-400 text-xs">activecampaign</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={config.isActive ? "default" : "secondary"}
                                        className={config.isActive ? "bg-green-500" : "bg-gray-400"}
                                      >
                                        {config.isActive ? "Attivo" : "Inattivo"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-center font-bold text-green-700">
                                      {config.totalLeadsReceived || 0}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <code className="text-xs bg-gray-100 px-2 py-1 rounded truncate max-w-[200px]">
                                          .../{config.secretKey?.substring(0, 8)}...
                                        </code>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            navigator.clipboard.writeText(
                                              `https://${window.location.host}/api/webhook/activecampaign/${config.secretKey}`
                                            );
                                            setActivecampaignCopied(config.id);
                                            setTimeout(() => setActivecampaignCopied(null), 2000);
                                            toast({
                                              title: "URL Copiato",
                                              description: "L'URL webhook è stato copiato. Incollalo in ActiveCampaign: Settings → Developer → Webhooks",
                                            });
                                          }}
                                        >
                                          {activecampaignCopied === config.id ? (
                                            <Check className="h-4 w-4 text-green-600" />
                                          ) : (
                                            <Copy className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setSelectedACWebhookConfigId(config.id);
                                            setIsCreatingNewACConfig(false);
                                            setIsDuplicatingAC(false);
                                            setActivecampaignFormData({
                                              configName: config.configName || config.displayName || "",
                                              agentConfigId: config.agentConfigId || "",
                                              targetCampaignId: config.targetCampaignId || "",
                                              defaultSource: config.defaultSource || "",
                                              isActive: config.isActive,
                                            });
                                          }}
                                          title="Modifica"
                                        >
                                          <Server className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setIsCreatingNewACConfig(true);
                                            setSelectedACWebhookConfigId(null);
                                            setIsDuplicatingAC(true);
                                            setActivecampaignFormData({
                                              configName: (config.configName || config.displayName || "Config") + " (Copia)",
                                              agentConfigId: config.agentConfigId || "",
                                              targetCampaignId: config.targetCampaignId || "",
                                              defaultSource: config.defaultSource || "",
                                              isActive: true,
                                            });
                                          }}
                                          title="Duplica"
                                        >
                                          <Copy className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => updateActivecampaignMutation.mutate({
                                            id: config.id,
                                            isActive: !config.isActive,
                                          })}
                                          title={config.isActive ? "Disattiva" : "Attiva"}
                                        >
                                          {config.isActive ? (
                                            <XCircle className="h-4 w-4 text-yellow-600" />
                                          ) : (
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                          )}
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            if (confirm("Sei sicuro di voler rigenerare la chiave? Dovrai aggiornare l'URL in ActiveCampaign.")) {
                                              regenerateActivecampaignKeyMutation.mutate(config.id);
                                            }
                                          }}
                                          title="Rigenera Chiave"
                                        >
                                          <RefreshCw className="h-4 w-4 text-blue-600" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            if (confirm("Sei sicuro di voler eliminare questa configurazione? I lead non verranno più ricevuti.")) {
                                              deleteActivecampaignMutation.mutate(config.id);
                                            }
                                          }}
                                          title="Elimina"
                                        >
                                          <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Setup Instructions */}
                    {activecampaignConfigs.length > 0 && (
                      <Alert className="mt-4 bg-blue-50 border-blue-200">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-sm text-blue-800">
                          <strong>Come configurare in ActiveCampaign:</strong>
                          <ol className="list-decimal list-inside mt-2 space-y-1">
                            <li>Vai su Settings → Developer → Manage Webhooks</li>
                            <li>Clicca "Add" per aggiungere un nuovo webhook</li>
                            <li>Incolla l'URL copiato nel campo "URL"</li>
                            <li>Seleziona l'evento "Contact added" o "Subscribes"</li>
                            <li>Salva il webhook</li>
                          </ol>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Test Webhook Section - Only show if there are configs */}
                    {activecampaignConfigs.length > 0 && (
                      <Card className="border-2 border-purple-200 shadow-2xl bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50 mt-6 overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-purple-500 to-violet-500 text-white pb-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <Sparkles className="h-6 w-6 text-white" />
                              </div>
                              <div>
                                <CardTitle className="text-xl text-white">Test Webhook ActiveCampaign</CardTitle>
                                <CardDescription className="text-purple-100">Simula l'invio di un lead per verificare la configurazione</CardDescription>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                              {activecampaignConfigs.length} config
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                          {/* Config Selection */}
                          <div className="p-4 bg-white/60 rounded-xl border border-purple-200 shadow-sm">
                            <Label className="text-sm font-semibold text-purple-800 mb-2 block">Configurazione da Testare</Label>
                            <Select
                              value={selectedACTestConfigId || activecampaignConfigs[0]?.id || ""}
                              onValueChange={(configId) => {
                                setSelectedACTestConfigId(configId);
                              }}
                            >
                              <SelectTrigger className="bg-white border-purple-200 focus:border-purple-400">
                                <SelectValue placeholder="Seleziona una configurazione" />
                              </SelectTrigger>
                              <SelectContent>
                                {activecampaignConfigs.map((config: any) => (
                                  <SelectItem key={config.id} value={config.id}>
                                    <span className="flex items-center gap-2">
                                      {config.isActive ? <CheckCircle className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-gray-400" />}
                                      {config.configName || config.displayName || "ActiveCampaign"}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Source Override Warning */}
                          {(() => {
                            const testConfig = selectedACTestConfigId 
                              ? activecampaignConfigs.find((c: any) => c.id === selectedACTestConfigId)
                              : activecampaignConfigs[0];
                            if (testConfig?.defaultSource) {
                              return (
                                <Alert className="bg-violet-50 border-violet-200 rounded-xl">
                                  <AlertCircle className="h-4 w-4 text-violet-600" />
                                  <AlertDescription className="text-sm text-violet-800">
                                    <strong>Nota:</strong> Fonte predefinita "<span className="font-mono bg-violet-100 px-1 rounded">{testConfig.defaultSource}</span>" sovrascriverà il campo Fonte.
                                  </AlertDescription>
                                </Alert>
                              );
                            }
                            return null;
                          })()}

                          {/* Basic Fields */}
                          <div className="space-y-4">
                            <h4 className="font-semibold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                              <User className="h-4 w-4 text-purple-600" />
                              Dati Contatto Base
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              <div className="space-y-1.5">
                                <Label htmlFor="acTestFirstName" className="text-xs font-medium text-gray-600">Nome</Label>
                                <Input
                                  id="acTestFirstName"
                                  value={activecampaignTestData.firstName}
                                  onChange={(e) => setActivecampaignTestData(prev => ({ ...prev, firstName: e.target.value }))}
                                  placeholder="Mario"
                                  className="bg-white border-gray-200 focus:border-purple-400"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="acTestLastName" className="text-xs font-medium text-gray-600">Cognome</Label>
                                <Input
                                  id="acTestLastName"
                                  value={activecampaignTestData.lastName}
                                  onChange={(e) => setActivecampaignTestData(prev => ({ ...prev, lastName: e.target.value }))}
                                  placeholder="Rossi"
                                  className="bg-white border-gray-200 focus:border-purple-400"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="acTestPhone" className="text-xs font-medium text-purple-700 flex items-center gap-1">
                                  Telefono <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="acTestPhone"
                                  value={activecampaignTestData.phone}
                                  onChange={(e) => setActivecampaignTestData(prev => ({ ...prev, phone: e.target.value }))}
                                  placeholder="+39 333 1234567"
                                  className={`bg-white ${!activecampaignTestData.phone.trim() ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-purple-400"}`}
                                />
                                {!activecampaignTestData.phone.trim() && (
                                  <p className="text-xs text-red-500">Obbligatorio</p>
                                )}
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor="acTestEmail" className="text-xs font-medium text-gray-600">Email</Label>
                                <Input
                                  id="acTestEmail"
                                  type="email"
                                  value={activecampaignTestData.email}
                                  onChange={(e) => setActivecampaignTestData(prev => ({ ...prev, email: e.target.value }))}
                                  placeholder="mario.rossi@test.com"
                                  className="bg-white border-gray-200 focus:border-purple-400"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Advanced Fields Toggle */}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowAdvancedACTest(!showAdvancedACTest)}
                            className="w-full border-dashed border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400"
                          >
                            {showAdvancedACTest ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-2" />
                                Nascondi Campi Avanzati
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-2" />
                                Mostra Campi Avanzati (Tags, Custom Fields)
                              </>
                            )}
                          </Button>

                          {/* Advanced Fields */}
                          {showAdvancedACTest && (
                            <div className="space-y-6 p-4 bg-white/40 rounded-xl border border-purple-100">
                              {/* Tags */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                                  <Tag className="h-4 w-4 text-purple-600" />
                                  Tags
                                </h4>
                                <div className="flex gap-2">
                                  <Input
                                    value={activecampaignTestData.tagInput}
                                    onChange={(e) => setActivecampaignTestData(prev => ({ ...prev, tagInput: e.target.value }))}
                                    placeholder="Aggiungi tag..."
                                    className="bg-white border-gray-200 focus:border-purple-400"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && activecampaignTestData.tagInput.trim()) {
                                        e.preventDefault();
                                        setActivecampaignTestData(prev => ({
                                          ...prev,
                                          tags: [...prev.tags, prev.tagInput.trim()],
                                          tagInput: "",
                                        }));
                                      }
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                      if (activecampaignTestData.tagInput.trim()) {
                                        setActivecampaignTestData(prev => ({
                                          ...prev,
                                          tags: [...prev.tags, prev.tagInput.trim()],
                                          tagInput: "",
                                        }));
                                      }
                                    }}
                                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                                {activecampaignTestData.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {activecampaignTestData.tags.map((tag, index) => (
                                      <Badge key={index} variant="secondary" className="bg-purple-100 text-purple-800 flex items-center gap-1">
                                        {tag}
                                        <button
                                          type="button"
                                          onClick={() => setActivecampaignTestData(prev => ({
                                            ...prev,
                                            tags: prev.tags.filter((_, i) => i !== index),
                                          }))}
                                          className="ml-1 hover:text-red-600"
                                        >
                                          <XCircle className="h-3 w-3" />
                                        </button>
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Custom Fields */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                                  <Settings className="h-4 w-4 text-purple-600" />
                                  Campi Personalizzati
                                </h4>
                                <div className="flex gap-2">
                                  <Input
                                    value={activecampaignTestData.customFieldKey}
                                    onChange={(e) => setActivecampaignTestData(prev => ({ ...prev, customFieldKey: e.target.value }))}
                                    placeholder="Nome campo"
                                    className="bg-white border-gray-200 focus:border-purple-400 flex-1"
                                  />
                                  <Input
                                    value={activecampaignTestData.customFieldValue}
                                    onChange={(e) => setActivecampaignTestData(prev => ({ ...prev, customFieldValue: e.target.value }))}
                                    placeholder="Valore"
                                    className="bg-white border-gray-200 focus:border-purple-400 flex-1"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                      if (activecampaignTestData.customFieldKey.trim() && activecampaignTestData.customFieldValue.trim()) {
                                        setActivecampaignTestData(prev => ({
                                          ...prev,
                                          customFields: [...prev.customFields, {
                                            field: prev.customFieldKey.trim(),
                                            value: prev.customFieldValue.trim(),
                                          }],
                                          customFieldKey: "",
                                          customFieldValue: "",
                                        }));
                                      }
                                    }}
                                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                                {activecampaignTestData.customFields.length > 0 && (
                                  <div className="space-y-2">
                                    {activecampaignTestData.customFields.map((cf, index) => (
                                      <div key={index} className="flex items-center gap-2 p-2 bg-white rounded border border-purple-200">
                                        <Badge variant="outline" className="bg-purple-50 text-purple-700">{cf.field}</Badge>
                                        <span className="text-gray-600">=</span>
                                        <span className="text-gray-800">{cf.value}</span>
                                        <button
                                          type="button"
                                          onClick={() => setActivecampaignTestData(prev => ({
                                            ...prev,
                                            customFields: prev.customFields.filter((_, i) => i !== index),
                                          }))}
                                          className="ml-auto text-gray-400 hover:text-red-600"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Test Button */}
                          <div className="flex gap-3">
                            <Button
                              onClick={handleTestActivecampaignWebhook}
                              disabled={!activecampaignTestData.phone.trim() || isTestingActivecampaign}
                              className="flex-1 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white shadow-lg"
                            >
                              {isTestingActivecampaign ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Invio in corso...
                                </>
                              ) : (
                                <>
                                  <Send className="h-4 w-4 mr-2" />
                                  Invia Lead di Test
                                </>
                              )}
                            </Button>
                          </div>

                          {/* Result */}
                          {activecampaignTestResult && (
                            <Alert className={`rounded-xl ${activecampaignTestResult.success ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
                              {activecampaignTestResult.success ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600" />
                              )}
                              <AlertDescription className="text-sm">
                                <strong className={activecampaignTestResult.success ? "text-green-800" : "text-red-800"}>
                                  {activecampaignTestResult.success ? "Successo!" : "Errore:"}
                                </strong>{" "}
                                <span className={activecampaignTestResult.success ? "text-green-700" : "text-red-700"}>
                                  {activecampaignTestResult.message}
                                </span>
                                {activecampaignTestResult.details && (
                                  <pre className="mt-3 p-3 bg-white/70 rounded-lg text-xs overflow-auto max-h-40 border border-gray-200">
                                    {JSON.stringify(activecampaignTestResult.details, null, 2)}
                                  </pre>
                                )}
                              </AlertDescription>
                            </Alert>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}

                {/* Google Sheets Configuration */}
                {selectedIntegration === "googlesheets" && (
                  <>
                    <Alert className="mb-4 bg-blue-50 border-blue-200">
                      <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                      <AlertDescription className="text-sm text-blue-800">
                        <strong>Sync Automatico da Google Sheets</strong> - Importa lead automaticamente da un foglio Google Sheets pubblico o condiviso. Il sistema controlla periodicamente il foglio e importa i nuovi lead.
                      </AlertDescription>
                    </Alert>

                    <Card className="border border-gray-200 shadow-lg bg-white">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-blue-50 rounded-xl">
                            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <CardTitle>Configura Importazione da Google Sheets</CardTitle>
                            <CardDescription>
                              Connetti un foglio Google per sincronizzare automaticamente i lead
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Visual Stepper - Modern Glassmorphism Design */}
                        {(() => {
                          const hasUrl = googleSheetsFormData.sheetUrl.trim().length > 0;
                          const hasAgent = !!googleSheetsFormData.agentConfigId;
                          const hasPreview = !!googleSheetsPreview;
                          const hasPhoneMapping = !!(googleSheetsFormData.columnMappings.phoneNumber || googleSheetsPreview?.suggestedMappings?.phoneNumber);
                          
                          let currentStep = 1;
                          if (hasUrl && hasAgent) currentStep = 2;
                          if (hasPreview) currentStep = 3;
                          
                          const steps = [
                            { num: 1, label: "Inserisci URL", icon: FileSpreadsheet },
                            { num: 2, label: "Test Connessione", icon: RefreshCw },
                            { num: 3, label: "Mappa Colonne", icon: Settings },
                            { num: 4, label: "Importa", icon: Send },
                          ];
                          
                          return (
                            <div className="mb-8 bg-slate-900/90 backdrop-blur-xl rounded-2xl p-6 shadow-2xl">
                              <div className="flex items-center justify-between">
                                {steps.map((step, idx) => {
                                  const isCompleted = step.num < currentStep;
                                  const isCurrent = step.num === currentStep;
                                  const isFuture = step.num > currentStep;
                                  const StepIcon = step.icon;
                                  
                                  return (
                                    <div key={step.num} className="flex items-center flex-1">
                                      <div className="flex flex-col items-center">
                                        <div className={`
                                          w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 relative
                                          ${isCompleted ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30" : ""}
                                          ${isCurrent ? "bg-white text-blue-600 ring-4 ring-blue-400/30 shadow-lg shadow-blue-500/20 border-2 border-blue-500" : ""}
                                          ${isFuture ? "bg-slate-800/60 border border-slate-600/50 text-slate-500" : ""}
                                        `}>
                                          {isCompleted ? (
                                            <Check className="h-5 w-5" />
                                          ) : (
                                            <span className="font-bold text-sm">{step.num}</span>
                                          )}
                                        </div>
                                        <span className={`
                                          mt-3 text-xs font-medium text-center max-w-[80px] transition-all duration-300
                                          ${isCompleted ? "text-blue-400" : ""}
                                          ${isCurrent ? "text-white font-semibold" : ""}
                                          ${isFuture ? "text-slate-500" : ""}
                                        `}>
                                          {step.label}
                                        </span>
                                      </div>
                                      {idx < steps.length - 1 && (
                                        <div className="flex-1 mx-3 mt-[-24px]">
                                          <div className={`
                                            h-1 rounded-full transition-all duration-500
                                            ${step.num < currentStep 
                                              ? "bg-gradient-to-r from-blue-500 to-indigo-500" 
                                              : "bg-slate-700/60"}
                                          `} />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="googleSheetsUrl" className="text-sm font-semibold text-gray-700">URL Google Sheets *</Label>
                            <Input
                              id="googleSheetsUrl"
                              value={googleSheetsFormData.sheetUrl}
                              onChange={(e) => setGoogleSheetsFormData({ ...googleSheetsFormData, sheetUrl: e.target.value })}
                              placeholder="https://docs.google.com/spreadsheets/d/1ABC.../edit"
                              className="font-mono text-sm bg-white/80 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all"
                            />
                            <p className="text-xs text-slate-500">
                              Il foglio deve essere condiviso pubblicamente o con chiunque abbia il link
                            </p>
                            
                            {/* Call-to-action message - Modern glass card */}
                            {googleSheetsFormData.sheetUrl.trim() && googleSheetsFormData.agentConfigId && !googleSheetsPreview && (
                              <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 rounded-xl flex items-center gap-3 shadow-sm">
                                <div className="p-2 bg-emerald-100 rounded-lg">
                                  <Zap className="h-4 w-4 text-emerald-600" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-emerald-800 font-medium">
                                    Prossimo passo
                                  </p>
                                  <p className="text-xs text-emerald-700/80">
                                    Clicca <span className="font-semibold">Test Connessione</span> per vedere l'anteprima e mappare le colonne
                                  </p>
                                </div>
                                <ChevronDown className="h-5 w-5 text-emerald-500 animate-bounce" />
                              </div>
                            )}
                          </div>

                          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent md:col-span-2" />

                          <div className="space-y-2">
                            <Label htmlFor="googleSheetsConfigName" className="text-sm font-medium text-gray-600">Nome Configurazione</Label>
                            <Input
                              id="googleSheetsConfigName"
                              value={googleSheetsFormData.configName}
                              onChange={(e) => setGoogleSheetsFormData({ ...googleSheetsFormData, configName: e.target.value })}
                              placeholder="es. Lead da Landing Page"
                              className="bg-white/80 border-slate-200 focus:border-blue-500 transition-all"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="googleSheetsAgent" className="text-sm font-medium text-gray-600">Agente WhatsApp Proattivo *</Label>
                            <Select
                              value={googleSheetsFormData.agentConfigId}
                              onValueChange={(value) => setGoogleSheetsFormData({ ...googleSheetsFormData, agentConfigId: value })}
                            >
                              <SelectTrigger id="googleSheetsAgent" className="bg-white/80 border-slate-200 focus:border-blue-500">
                                <SelectValue placeholder="Seleziona un agente proattivo" />
                              </SelectTrigger>
                              <SelectContent>
                                {!proactiveAgents || proactiveAgents.length === 0 ? (
                                  <div className="p-3 text-sm text-muted-foreground space-y-1">
                                    <p className="font-medium">Nessun agente proattivo configurato</p>
                                    <p className="text-xs">Per usare questa funzione, crea un agente WhatsApp e abilita la modalità proattiva nelle sue impostazioni.</p>
                                  </div>
                                ) : (
                                  proactiveAgents.map((agent: any) => (
                                    <SelectItem key={agent.id} value={agent.id}>
                                      {agent.agentName || agent.whatsappNumber}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="googleSheetsCampaign" className="text-sm font-medium text-gray-600 flex items-center gap-2">
                              Campagna di destinazione *
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Obbligatorio</Badge>
                            </Label>
                            <Select
                              value={googleSheetsFormData.targetCampaignId}
                              onValueChange={(value) => setGoogleSheetsFormData({ ...googleSheetsFormData, targetCampaignId: value })}
                            >
                              <SelectTrigger id="googleSheetsCampaign" className={`bg-white/80 border-slate-200 focus:border-blue-500 ${!googleSheetsFormData.targetCampaignId ? 'border-red-300' : ''}`}>
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
                            <p className="text-xs text-amber-600">
                              La campagna definisce obiettivi e desideri che l'AI utilizzerà per personalizzare i messaggi
                            </p>
                            
                            {/* Campaign Details Preview */}
                            {googleSheetsFormData.targetCampaignId && (() => {
                              const selectedCampaign = campaigns.find((c: any) => c.id === googleSheetsFormData.targetCampaignId);
                              if (!selectedCampaign) return null;
                              return (
                                <div className="mt-3 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 space-y-3">
                                  <div className="flex items-center gap-2 text-indigo-700 font-medium text-sm">
                                    <Target className="h-4 w-4" />
                                    Dettagli Campagna: {selectedCampaign.campaignName}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    {selectedCampaign.defaultObiettivi && (
                                      <div className="bg-white/80 rounded-lg p-3 border border-indigo-100">
                                        <span className="text-indigo-600 font-medium text-xs uppercase tracking-wide block mb-1">Obiettivi</span>
                                        <p className="text-gray-800">{selectedCampaign.defaultObiettivi}</p>
                                      </div>
                                    )}
                                    {selectedCampaign.implicitDesires && (
                                      <div className="bg-white/80 rounded-lg p-3 border border-indigo-100">
                                        <span className="text-indigo-600 font-medium text-xs uppercase tracking-wide block mb-1">Desideri</span>
                                        <p className="text-gray-800">{selectedCampaign.implicitDesires}</p>
                                      </div>
                                    )}
                                    {selectedCampaign.hookText && (
                                      <div className="bg-white/80 rounded-lg p-3 border border-indigo-100">
                                        <span className="text-indigo-600 font-medium text-xs uppercase tracking-wide block mb-1">Uncino/Hook</span>
                                        <p className="text-gray-800">{selectedCampaign.hookText}</p>
                                      </div>
                                    )}
                                    {selectedCampaign.idealStateDescription && (
                                      <div className="bg-white/80 rounded-lg p-3 border border-indigo-100">
                                        <span className="text-indigo-600 font-medium text-xs uppercase tracking-wide block mb-1">Stato Ideale</span>
                                        <p className="text-gray-800">{selectedCampaign.idealStateDescription}</p>
                                      </div>
                                    )}
                                  </div>
                                  {!selectedCampaign.defaultObiettivi && !selectedCampaign.implicitDesires && !selectedCampaign.hookText && !selectedCampaign.idealStateDescription && (
                                    <div className="text-amber-600 text-sm flex items-center gap-2">
                                      <AlertCircle className="h-4 w-4" />
                                      Questa campagna non ha obiettivi/desideri configurati. L'AI potrebbe non personalizzare correttamente i messaggi.
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          <div className="space-y-3">
                            <Label className="text-sm font-medium text-gray-600 flex items-center gap-2">
                              Tempistica Contatto
                              <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0">Quando contattare i lead</Badge>
                            </Label>
                            <div className="grid grid-cols-1 gap-2">
                              <div 
                                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                  googleSheetsFormData.contactTiming === 'immediate' 
                                    ? 'border-blue-500 bg-blue-50' 
                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                                onClick={() => setGoogleSheetsFormData({ ...googleSheetsFormData, contactTiming: 'immediate' })}
                              >
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  googleSheetsFormData.contactTiming === 'immediate' ? 'border-blue-500' : 'border-gray-400'
                                }`}>
                                  {googleSheetsFormData.contactTiming === 'immediate' && (
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900">Contatta Subito</span>
                                    <Badge className="bg-green-100 text-green-700 text-[10px]">Consigliato</Badge>
                                  </div>
                                  <p className="text-xs text-gray-500">I lead vengono contattati immediatamente all'importazione</p>
                                </div>
                              </div>
                              
                              <div 
                                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                  googleSheetsFormData.contactTiming === 'tomorrow' 
                                    ? 'border-blue-500 bg-blue-50' 
                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                                onClick={() => setGoogleSheetsFormData({ ...googleSheetsFormData, contactTiming: 'tomorrow' })}
                              >
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  googleSheetsFormData.contactTiming === 'tomorrow' ? 'border-blue-500' : 'border-gray-400'
                                }`}>
                                  {googleSheetsFormData.contactTiming === 'tomorrow' && (
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <span className="font-medium text-gray-900">Programma per Domani</span>
                                  <p className="text-xs text-gray-500">I lead vengono contattati il giorno successivo alle 9:00</p>
                                </div>
                              </div>
                              
                              <div 
                                className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                  googleSheetsFormData.contactTiming === 'custom' 
                                    ? 'border-blue-500 bg-blue-50' 
                                    : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                                onClick={() => setGoogleSheetsFormData({ ...googleSheetsFormData, contactTiming: 'custom' })}
                              >
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  googleSheetsFormData.contactTiming === 'custom' ? 'border-blue-500' : 'border-gray-400'
                                }`}>
                                  {googleSheetsFormData.contactTiming === 'custom' && (
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <span className="font-medium text-gray-900">Intervallo Personalizzato</span>
                                  <p className="text-xs text-gray-500">Specifica dopo quanti minuti contattare i lead</p>
                                </div>
                              </div>
                            </div>
                            
                            {googleSheetsFormData.contactTiming === 'custom' && (
                              <div className="flex items-center gap-3 mt-2 pl-7">
                                <Label className="text-sm text-gray-600 whitespace-nowrap">Contatta dopo:</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  max="10080"
                                  value={googleSheetsFormData.customContactDelay}
                                  onChange={(e) => setGoogleSheetsFormData({ ...googleSheetsFormData, customContactDelay: parseInt(e.target.value) || 60 })}
                                  className="w-24 bg-white/80 border-slate-200 focus:border-blue-500"
                                />
                                <span className="text-sm text-gray-500">minuti</span>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="googleSheetsPollingInterval" className="text-sm font-medium text-gray-600">Intervallo Polling (minuti)</Label>
                            <Select
                              value={String(googleSheetsFormData.pollingIntervalMinutes)}
                              onValueChange={(value) => setGoogleSheetsFormData({ ...googleSheetsFormData, pollingIntervalMinutes: parseInt(value) })}
                            >
                              <SelectTrigger id="googleSheetsPollingInterval" className="bg-white/80 border-slate-200 focus:border-blue-500">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">Ogni minuto</SelectItem>
                                <SelectItem value="5">Ogni 5 minuti</SelectItem>
                                <SelectItem value="10">Ogni 10 minuti</SelectItem>
                                <SelectItem value="15">Ogni 15 minuti</SelectItem>
                                <SelectItem value="30">Ogni 30 minuti</SelectItem>
                                <SelectItem value="60">Ogni ora</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="googleSheetsStartDate" className="text-sm font-medium text-gray-600">Importa da Data (opzionale)</Label>
                            <Input
                              id="googleSheetsStartDate"
                              type="date"
                              value={googleSheetsFormData.startFromDate || ""}
                              onChange={(e) => setGoogleSheetsFormData({ ...googleSheetsFormData, startFromDate: e.target.value })}
                              className="bg-white/80 border-slate-200 focus:border-blue-500"
                            />
                            <p className="text-xs text-slate-500">
                              Se impostata, verranno importati solo i lead con data di inserimento successiva a questa data
                            </p>
                            {googleSheetsFormData.startFromDate && googleSheetsPreview && (
                              <div className={`mt-2 p-2 rounded-lg text-xs ${
                                googleSheetsFormData.columnMappings.dateCreated || googleSheetsPreview.suggestedMappings?.dateCreated
                                  ? 'bg-blue-50 border border-blue-200 text-blue-700'
                                  : 'bg-amber-50 border border-amber-200 text-amber-700'
                              }`}>
                                {googleSheetsFormData.columnMappings.dateCreated || googleSheetsPreview.suggestedMappings?.dateCreated ? (
                                  <>
                                    <span className="font-medium">Filtro attivo:</span> Importerà lead dal{' '}
                                    <span className="font-semibold">{new Date(googleSheetsFormData.startFromDate).toLocaleDateString('it-IT')}</span>
                                    {' '}usando la colonna{' '}
                                    <span className="font-mono bg-blue-100 px-1 rounded">
                                      {googleSheetsFormData.columnMappings.dateCreated || googleSheetsPreview.suggestedMappings?.dateCreated}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-medium">Attenzione:</span> Per usare il filtro data, mappa il campo "Data Inserimento" a una colonna del foglio
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="p-5 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-700/50 shadow-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Switch
                                id="googleSheetsPollingEnabled"
                                checked={googleSheetsFormData.pollingEnabled}
                                onCheckedChange={(checked) => setGoogleSheetsFormData({ ...googleSheetsFormData, pollingEnabled: checked })}
                                className="data-[state=checked]:bg-blue-600"
                              />
                              <Label htmlFor="googleSheetsPollingEnabled" className="cursor-pointer">
                                <span className="font-medium text-white">Polling Automatico</span>
                                <p className="text-xs text-slate-400">Controlla automaticamente nuovi lead ogni {googleSheetsFormData.pollingIntervalMinutes} minuti</p>
                              </Label>
                            </div>
                            <Badge 
                              variant={googleSheetsFormData.pollingEnabled ? "default" : "secondary"} 
                              className={googleSheetsFormData.pollingEnabled 
                                ? "bg-green-500 text-white border-0 shadow-lg shadow-green-500/20" 
                                : "bg-slate-700 text-slate-300 border-slate-600"}
                            >
                              {googleSheetsFormData.pollingEnabled ? "Attivo" : "Disattivo"}
                            </Badge>
                          </div>
                          
                          {googleSheetsFormData.pollingEnabled && (
                            <div className="flex items-center gap-2 pl-12 text-xs text-slate-400">
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                Quando importati: {
                                  googleSheetsFormData.contactTiming === 'immediate' ? 'Contatto immediato' :
                                  googleSheetsFormData.contactTiming === 'tomorrow' ? 'Contatto programmato per le 9:00 del giorno successivo' :
                                  `Contatto dopo ${googleSheetsFormData.customContactDelay || 30} minuti`
                                }
                              </span>
                            </div>
                          )}
                        </div>

                        {googleSheetsPreview && (
                          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                            {/* Gradient Header Bar */}
                            <div className="bg-white border-l-4 border-blue-600 p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-50 rounded-lg">
                                    <Settings className="h-5 w-5 text-blue-600" />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-gray-900">Step 3: Mappa le Colonne</h4>
                                    <p className="text-xs text-gray-500">Collega le colonne del foglio ai campi dei lead</p>
                                  </div>
                                </div>
                                <Badge className="bg-blue-100 text-blue-700 border-0">
                                  {googleSheetsPreview.columns.length} colonne rilevate
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="p-5 space-y-5">
                              {(() => {
                                const crmFields = [
                                  { key: 'firstName', label: 'Nome' },
                                  { key: 'lastName', label: 'Cognome' },
                                  { key: 'phoneNumber', label: 'Telefono *', required: true },
                                  { key: 'email', label: 'Email' },
                                  { key: 'company', label: 'Azienda' },
                                  { key: 'notes', label: 'Note' },
                                  { key: 'question1', label: 'Domanda 1' },
                                  { key: 'question2', label: 'Domanda 2' },
                                  { key: 'question3', label: 'Domanda 3' },
                                  { key: 'question4', label: 'Domanda 4' },
                                  { key: 'obiettivi', label: 'Obiettivi' },
                                  { key: 'desideri', label: 'Desideri' },
                                  { key: 'uncino', label: 'Uncino/Hook' },
                                  { key: 'fonte', label: 'Fonte' },
                                  { key: 'website', label: 'Sito Web' },
                                  { key: 'address', label: 'Indirizzo' },
                                  { key: 'city', label: 'Città' },
                                  { key: 'state', label: 'Provincia' },
                                  { key: 'postalCode', label: 'CAP' },
                                  { key: 'country', label: 'Paese' },
                                  { key: 'tags', label: 'Tags' },
                                  { key: 'dateOfBirth', label: 'Data Nascita' },
                                  { key: 'dateCreated', label: 'Data Inserimento' },
                                ];
                                
                                const sheetColumns = googleSheetsPreview.columns.filter(col => col && col.trim());
                                
                                const getReverseMappings = () => {
                                  const reverse: Record<string, string> = {};
                                  for (const field of crmFields) {
                                    const col = googleSheetsFormData.columnMappings[field.key] || googleSheetsPreview.suggestedMappings[field.key];
                                    if (col && col !== "__none__") {
                                      reverse[col] = field.key;
                                    }
                                  }
                                  return reverse;
                                };
                                
                                const reverseMappings = getReverseMappings();
                                const mappedCount = Object.keys(reverseMappings).length;
                                const hasPhoneMapping = reverseMappings[Object.keys(reverseMappings).find(col => reverseMappings[col] === 'phoneNumber') || ''] === 'phoneNumber';
                                
                                const getAiSuggestion = (colName: string) => {
                                  return aiMappingSuggestions.find(s => s.columnName === colName);
                                };
                                
                                const handleAiMap = async () => {
                                  if (!googleSheetsPreview) return;
                                  
                                  setIsLoadingAiMap(true);
                                  try {
                                    const columnsData = sheetColumns.map(col => ({
                                      name: col,
                                      sampleValues: googleSheetsPreview.previewRows
                                        .slice(0, 5)
                                        .map(row => String(row[col] || ''))
                                        .filter(v => v)
                                    }));
                                    
                                    const response = await fetch(`/api/consultant/agents/${googleSheetsFormData.agentConfigId}/leads/ai-map`, {
                                      method: "POST",
                                      headers: {
                                        ...getAuthHeaders(),
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({ columns: columnsData }),
                                    });
                                    
                                    const result = await response.json();
                                    if (result.success && result.data?.suggestions) {
                                      setAiMappingSuggestions(result.data.suggestions);
                                      toast({
                                        title: "Analisi AI completata!",
                                        description: `Suggerite ${result.data.suggestions.filter((s: any) => s.suggestedField).length} mappature`,
                                      });
                                    } else {
                                      throw new Error(result.error || "Errore AI");
                                    }
                                  } catch (error: any) {
                                    toast({
                                      title: "Errore AI",
                                      description: error.message || "Impossibile analizzare le colonne",
                                      variant: "destructive",
                                    });
                                  } finally {
                                    setIsLoadingAiMap(false);
                                  }
                                };
                                
                                const applyAllAiSuggestions = () => {
                                  const newMappings: Record<string, string> = {};
                                  for (const suggestion of aiMappingSuggestions) {
                                    if (suggestion.suggestedField && suggestion.confidence >= 60) {
                                      newMappings[suggestion.suggestedField] = suggestion.columnName;
                                    }
                                  }
                                  setGoogleSheetsFormData({
                                    ...googleSheetsFormData,
                                    columnMappings: newMappings
                                  });
                                  toast({
                                    title: "Mappature applicate!",
                                    description: `${Object.keys(newMappings).length} campi mappati automaticamente`,
                                  });
                                };
                                
                                return (
                                  <>
                                    {/* Multi-column Notes Section */}
                                    <div className="mb-5 p-4 bg-gradient-to-r from-indigo-50/80 to-blue-50/80 rounded-xl border border-indigo-200/60 shadow-sm">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                          <FileText className="h-5 w-5 text-indigo-600" />
                                          <span className="font-semibold text-indigo-800">Note Multi-Variabile</span>
                                          <Badge variant="outline" className="text-xs bg-white border-indigo-300 text-indigo-600">
                                            Opzionale
                                          </Badge>
                                        </div>
                                        {googleSheetsFormData.notesColumns.length > 0 && (
                                          <Badge className="bg-indigo-500 text-white">
                                            {googleSheetsFormData.notesColumns.length} colonne
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-indigo-600/80 mb-3">
                                        Seleziona più colonne da concatenare in un unico campo note. Verranno unite con " | ".
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {sheetColumns.map((col) => {
                                          const isSelected = googleSheetsFormData.notesColumns.includes(col);
                                          return (
                                            <button
                                              key={col}
                                              type="button"
                                              onClick={() => {
                                                const newNotesColumns = isSelected
                                                  ? googleSheetsFormData.notesColumns.filter(c => c !== col)
                                                  : [...googleSheetsFormData.notesColumns, col];
                                                setGoogleSheetsFormData({
                                                  ...googleSheetsFormData,
                                                  notesColumns: newNotesColumns,
                                                });
                                              }}
                                              className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                                                isSelected
                                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50'
                                              }`}
                                            >
                                              {isSelected && <CheckCircle className="h-3 w-3 inline mr-1" />}
                                              {col}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {googleSheetsFormData.notesColumns.length > 0 && (
                                        <div className="mt-3 p-2 bg-white rounded-lg border border-indigo-200 text-xs text-indigo-700">
                                          <span className="font-medium">Anteprima:</span>{' '}
                                          {googleSheetsFormData.notesColumns.map((col, i) => (
                                            <span key={col}>
                                              <code className="bg-indigo-100 px-1 rounded">{col}</code>
                                              {i < googleSheetsFormData.notesColumns.length - 1 && ' | '}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between mb-5">
                                      <div className="flex items-center gap-3">
                                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 px-3 py-1.5 text-sm">
                                          {mappedCount}/{sheetColumns.length} colonne mappate
                                        </Badge>
                                        {!hasPhoneMapping && (
                                          <Badge variant="destructive" className="animate-pulse px-3 py-1.5">
                                            Telefono obbligatorio
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={handleAiMap}
                                          disabled={isLoadingAiMap || !googleSheetsFormData.agentConfigId}
                                          className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-300 text-violet-700 hover:from-violet-100 hover:to-purple-100 hover:border-violet-400 shadow-sm"
                                        >
                                          {isLoadingAiMap ? (
                                            <>
                                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                              Analisi AI...
                                            </>
                                          ) : (
                                            <>
                                              <Sparkles className="h-4 w-4 mr-2" />
                                              Mappa con AI
                                            </>
                                          )}
                                        </Button>
                                        {aiMappingSuggestions.length > 0 && (
                                          <Button
                                            variant="default"
                                            size="sm"
                                            onClick={applyAllAiSuggestions}
                                            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md"
                                          >
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Applica Tutti
                                          </Button>
                                        )}
                                      </div>
                                    </div>

                                    <div className="border rounded-xl overflow-hidden bg-white shadow-lg border-slate-200">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100">
                                            <TableHead className="font-semibold text-slate-700 w-[200px]">
                                              <div className="flex items-center gap-2">
                                                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                                                Colonna Foglio
                                              </div>
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-700">
                                              <div className="flex items-center gap-2">
                                                <Eye className="h-4 w-4 text-blue-600" />
                                                Dati di Esempio
                                              </div>
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-700 w-[200px]">
                                              <div className="flex items-center gap-2">
                                                <ArrowRight className="h-4 w-4 text-blue-600" />
                                                Mappa a Campo CRM
                                              </div>
                                            </TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {sheetColumns.map((col, idx) => {
                                            const sampleValues = googleSheetsPreview.previewRows
                                              .slice(0, 3)
                                              .map(row => row[col])
                                              .filter(v => v);
                                            
                                            const mappedField = reverseMappings[col];
                                            const mappedCrmLabel = crmFields.find(f => f.key === mappedField)?.label || '';
                                            const isPhoneField = mappedField === 'phoneNumber';
                                            const aiSuggestion = getAiSuggestion(col);
                                            const hasAiSuggestion = aiSuggestion && aiSuggestion.suggestedField;
                                            
                                            return (
                                              <TableRow 
                                                key={col} 
                                                className={`hover:bg-slate-50/80 transition-all duration-200 ${
                                                  isPhoneField ? 'bg-blue-50 border-l-4 border-l-blue-500' : 
                                                  mappedField ? 'bg-gradient-to-r from-blue-50/50 to-indigo-50/30 border-l-4 border-l-blue-400' : 
                                                  hasAiSuggestion ? 'bg-gradient-to-r from-violet-50/50 to-purple-50/30 border-l-4 border-l-violet-400' : ''
                                                }`}
                                              >
                                                <TableCell className="font-medium py-3">
                                                  <div className="flex items-center gap-3">
                                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-xs text-slate-600 font-semibold">{idx + 1}</span>
                                                    <code className="px-3 py-1.5 bg-white rounded-lg text-sm font-mono text-slate-700 border border-slate-200 shadow-sm">
                                                      {col}
                                                    </code>
                                                  </div>
                                                </TableCell>
                                                <TableCell className="py-3">
                                                  <div className="flex flex-wrap gap-2">
                                                    {sampleValues.length > 0 ? sampleValues.map((val, i) => (
                                                      <span 
                                                        key={i}
                                                        className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs bg-white text-slate-600 border border-slate-200 shadow-sm max-w-[180px] truncate"
                                                        title={String(val)}
                                                      >
                                                        {String(val).length > 22 ? String(val).slice(0, 22) + '...' : val}
                                                      </span>
                                                    )) : (
                                                      <span className="text-xs text-slate-400 italic px-2">Nessun dato</span>
                                                    )}
                                                  </div>
                                                </TableCell>
                                                <TableCell className="py-3">
                                                  <div className="flex items-center gap-2">
                                                    <Select
                                                      value={mappedField || "__skip__"}
                                                      onValueChange={(value) => {
                                                        const newMappings = { ...googleSheetsFormData.columnMappings };
                                                        
                                                        if (mappedField) {
                                                          newMappings[mappedField] = "";
                                                        }
                                                        
                                                        if (value !== "__skip__") {
                                                          for (const key of Object.keys(newMappings)) {
                                                            if (newMappings[key] === col) {
                                                              newMappings[key] = "";
                                                            }
                                                          }
                                                          newMappings[value] = col;
                                                        }
                                                        
                                                        setGoogleSheetsFormData({
                                                          ...googleSheetsFormData,
                                                          columnMappings: newMappings
                                                        });
                                                      }}
                                                    >
                                                      <SelectTrigger className={`h-10 min-w-[160px] ${
                                                        isPhoneField 
                                                          ? 'border-blue-400 bg-blue-50 text-blue-700 font-semibold shadow-sm' 
                                                          : mappedField 
                                                            ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm' 
                                                            : 'border-slate-200 bg-white'
                                                      }`}>
                                                        <SelectValue>
                                                          {mappedField ? (
                                                            <span className="flex items-center gap-1.5">
                                                              <CheckCircle className="h-4 w-4" />
                                                              {mappedCrmLabel}
                                                            </span>
                                                          ) : (
                                                            <span className="text-slate-400">Non importare</span>
                                                          )}
                                                        </SelectValue>
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        <SelectItem value="__skip__">
                                                          <span className="flex items-center gap-2 text-slate-500">
                                                            <X className="h-3.5 w-3.5" />
                                                            Non importare
                                                          </span>
                                                        </SelectItem>
                                                        {crmFields.map((field) => {
                                                          const isAlreadyMapped = reverseMappings[Object.keys(reverseMappings).find(c => reverseMappings[c] === field.key) || ''] === field.key && reverseMappings[col] !== field.key;
                                                          const isAiSuggested = aiSuggestion?.suggestedField === field.key;
                                                          return (
                                                            <SelectItem 
                                                              key={field.key} 
                                                              value={field.key}
                                                              disabled={isAlreadyMapped}
                                                            >
                                                              <span className={`flex items-center gap-2 ${field.required ? 'font-medium text-blue-700' : ''}`}>
                                                                {field.label}
                                                                {isAiSuggested && <Sparkles className="h-3 w-3 text-violet-500" />}
                                                                {isAlreadyMapped && <span className="text-xs text-slate-400">(già usato)</span>}
                                                              </span>
                                                            </SelectItem>
                                                          );
                                                        })}
                                                      </SelectContent>
                                                    </Select>
                                                    {hasAiSuggestion && !mappedField && (
                                                      <div 
                                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-100 to-purple-100 border border-violet-200 cursor-pointer hover:from-violet-200 hover:to-purple-200 transition-colors"
                                                        onClick={() => {
                                                          if (aiSuggestion.suggestedField) {
                                                            const newMappings = { ...googleSheetsFormData.columnMappings };
                                                            for (const key of Object.keys(newMappings)) {
                                                              if (newMappings[key] === col) {
                                                                newMappings[key] = "";
                                                              }
                                                            }
                                                            newMappings[aiSuggestion.suggestedField] = col;
                                                            setGoogleSheetsFormData({
                                                              ...googleSheetsFormData,
                                                              columnMappings: newMappings
                                                            });
                                                          }
                                                        }}
                                                        title={aiSuggestion.rationale}
                                                      >
                                                        <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                                                        <span className="text-xs font-medium text-violet-700">
                                                          {crmFields.find(f => f.key === aiSuggestion.suggestedField)?.label}
                                                        </span>
                                                        <Badge className={`text-[10px] px-1.5 py-0 h-4 ${
                                                          aiSuggestion.confidence >= 90 ? 'bg-green-500' :
                                                          aiSuggestion.confidence >= 70 ? 'bg-blue-500' :
                                                          'bg-amber-500'
                                                        }`}>
                                                          {aiSuggestion.confidence}%
                                                        </Badge>
                                                      </div>
                                                    )}
                                                  </div>
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })}
                                        </TableBody>
                                      </Table>
                                    </div>

                                    {mappedCount > 0 && googleSheetsPreview.previewRows.length > 0 && (
                                      <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                                        <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                                          <User className="h-4 w-4" />
                                          Anteprima: come apparirà il primo lead importato
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                          {crmFields.filter(f => {
                                            const col = googleSheetsFormData.columnMappings[f.key] || googleSheetsPreview.suggestedMappings[f.key];
                                            return col && col !== "__none__" && col !== "__skip__" && googleSheetsPreview.previewRows[0]?.[col];
                                          }).map(f => {
                                            const col = googleSheetsFormData.columnMappings[f.key] || googleSheetsPreview.suggestedMappings[f.key];
                                            const value = googleSheetsPreview.previewRows[0]?.[col];
                                            return (
                                              <div key={f.key} className="bg-white rounded-lg p-3 shadow-sm border border-blue-100">
                                                <span className="text-blue-600 text-xs font-medium uppercase tracking-wide">{f.label}</span>
                                                <p className="font-semibold text-gray-900 mt-1 truncate" title={String(value)}>{value}</p>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-4 pt-2">
                          {/* Test Connessione button - More prominent when it's the next step */}
                          {(() => {
                            const isNextStep = googleSheetsFormData.sheetUrl.trim() && googleSheetsFormData.agentConfigId && !googleSheetsPreview;
                            
                            return (
                              <Button
                                type="button"
                                variant={isNextStep ? "default" : "outline"}
                                size={isNextStep ? "lg" : "default"}
                                onClick={async () => {
                                  if (!googleSheetsFormData.sheetUrl || !googleSheetsFormData.agentConfigId) {
                                    toast({
                                      title: "Errore",
                                      description: "Inserisci l'URL del foglio e seleziona un agente",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  if (!googleSheetsFormData.targetCampaignId) {
                                    toast({
                                      title: "Campagna Obbligatoria",
                                      description: "Seleziona una campagna prima di testare la connessione",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  setIsTestingGoogleSheets(true);
                                  try {
                                    const response = await fetch(`/api/consultant/agents/${googleSheetsFormData.agentConfigId}/leads/preview-sheet`, {
                                      method: "POST",
                                      headers: {
                                        ...getAuthHeaders(),
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({ sheetUrl: googleSheetsFormData.sheetUrl }),
                                    });
                                    const result = await response.json();
                                    if (result.success) {
                                      setGoogleSheetsPreview(result.data);
                                      setGoogleSheetsFormData(prev => ({
                                        ...prev,
                                        columnMappings: result.data.suggestedMappings,
                                      }));
                                      toast({
                                        title: "Connessione riuscita!",
                                        description: `Trovate ${result.data.totalRows} righe nel foglio`,
                                      });
                                    } else {
                                      toast({
                                        title: "Errore",
                                        description: result.error || "Impossibile accedere al foglio",
                                        variant: "destructive",
                                      });
                                    }
                                  } catch (error) {
                                    toast({
                                      title: "Errore",
                                      description: "Errore durante il test della connessione",
                                      variant: "destructive",
                                    });
                                  } finally {
                                    setIsTestingGoogleSheets(false);
                                  }
                                }}
                                disabled={isTestingGoogleSheets || !googleSheetsFormData.sheetUrl || !googleSheetsFormData.agentConfigId || !googleSheetsFormData.targetCampaignId}
                                className={isNextStep 
                                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all duration-200"
                                  : "border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-all"
                                }
                              >
                                {isTestingGoogleSheets ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Test in corso...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className={`mr-2 ${isNextStep ? "h-5 w-5" : "h-4 w-4"}`} />
                                    Test Connessione
                                  </>
                                )}
                              </Button>
                            );
                          })()}

                          <Button
                            onClick={async () => {
                              if (!googleSheetsFormData.sheetUrl || !googleSheetsFormData.agentConfigId) {
                                toast({
                                  title: "Errore",
                                  description: "Compila tutti i campi obbligatori",
                                  variant: "destructive",
                                });
                                return;
                              }
                              
                              if (!googleSheetsFormData.targetCampaignId) {
                                toast({
                                  title: "Campagna Obbligatoria",
                                  description: "Seleziona una campagna per definire obiettivi e desideri che l'AI utilizzerà per personalizzare i messaggi",
                                  variant: "destructive",
                                });
                                return;
                              }
                              
                              const mappings = googleSheetsFormData.columnMappings.phoneNumber || googleSheetsPreview?.suggestedMappings.phoneNumber;
                              if (!mappings) {
                                toast({
                                  title: "Errore",
                                  description: "La mappatura della colonna telefono è obbligatoria",
                                  variant: "destructive",
                                });
                                return;
                              }

                              setIsSavingGoogleSheets(true);
                              try {
                                const response = await fetch(`/api/consultant/agents/${googleSheetsFormData.agentConfigId}/leads/import`, {
                                  method: "POST",
                                  headers: {
                                    ...getAuthHeaders(),
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    jobName: googleSheetsFormData.configName || "Import Google Sheets",
                                    sourceType: "google_sheets",
                                    googleSheetUrl: googleSheetsFormData.sheetUrl,
                                    columnMappings: {
                                      ...googleSheetsPreview?.suggestedMappings,
                                      ...googleSheetsFormData.columnMappings,
                                    },
                                    settings: {
                                      skipDuplicates: true,
                                      campaignId: googleSheetsFormData.targetCampaignId || null,
                                      pollingEnabled: googleSheetsFormData.pollingEnabled,
                                      pollingIntervalMinutes: googleSheetsFormData.pollingIntervalMinutes,
                                      startFromDate: googleSheetsFormData.startFromDate || null,
                                      notesColumns: googleSheetsFormData.notesColumns.length > 0 ? googleSheetsFormData.notesColumns : undefined,
                                      contactTiming: googleSheetsFormData.contactTiming,
                                      customContactDelay: googleSheetsFormData.contactTiming === 'custom' ? googleSheetsFormData.customContactDelay : undefined,
                                    },
                                  }),
                                });
                                const result = await response.json();
                                if (result.success) {
                                  toast({
                                    title: "Importazione completata!",
                                    description: `${result.data.stats.imported} lead importati, ${result.data.stats.duplicates} duplicati ignorati`,
                                  });
                                  setGoogleSheetsFormData({
                                    configName: "",
                                    sheetUrl: "",
                                    agentConfigId: proactiveAgents[0]?.id || "",
                                    targetCampaignId: "",
                                    pollingIntervalMinutes: 15,
                                    pollingEnabled: false,
                                    startFromDate: "",
                                    columnMappings: {},
                                    notesColumns: [],
                                    contactTiming: "immediate",
                                    customContactDelay: 60,
                                  });
                                  setGoogleSheetsPreview(null);
                                  refetchGoogleSheetsJobs();
                                } else {
                                  toast({
                                    title: "Errore",
                                    description: result.error || "Errore durante l'importazione",
                                    variant: "destructive",
                                  });
                                }
                              } catch (error) {
                                toast({
                                  title: "Errore",
                                  description: "Errore durante l'importazione",
                                  variant: "destructive",
                                });
                              } finally {
                                setIsSavingGoogleSheets(false);
                              }
                            }}
                            disabled={isSavingGoogleSheets || !googleSheetsFormData.sheetUrl || !googleSheetsFormData.agentConfigId || !googleSheetsFormData.targetCampaignId}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                          >
                            {isSavingGoogleSheets ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Importazione...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                Importa Lead
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Alert className="mt-4 bg-blue-50 border-blue-200">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-sm text-blue-800">
                        <strong>Come preparare il foglio Google:</strong>
                        <ol className="list-decimal list-inside mt-2 space-y-1">
                          <li>Crea un foglio Google con le colonne: Nome, Cognome, Telefono, Email (opzionale)</li>
                          <li>Clicca su "Condividi" e seleziona "Chiunque abbia il link può visualizzare"</li>
                          <li>Copia l'URL del foglio e incollalo qui sopra</li>
                          <li>Il sistema rileverà automaticamente le colonne e mapperà i campi</li>
                        </ol>
                      </AlertDescription>
                    </Alert>

                    {googleSheetsConfigs.length > 0 && (
                      <Card className="mt-6 border border-gray-200 shadow-lg">
                        <CardHeader>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">Fogli Google Configurati</CardTitle>
                              <CardDescription>
                                {googleSheetsConfigs.length} {googleSheetsConfigs.length === 1 ? 'foglio collegato' : 'fogli collegati'}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {googleSheetsConfigs.map((config: any) => (
                              <div
                                key={config.id}
                                className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-gray-900">
                                      {config.jobName || "Foglio Google"}
                                    </h4>
                                    <Badge 
                                      variant={config.pollingEnabled ? "default" : "secondary"}
                                      className={config.pollingEnabled ? "bg-green-500" : ""}
                                    >
                                      {config.pollingEnabled ? "Sync Attivo" : "Sync Disattivo"}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-gray-500 mt-1 truncate max-w-md">
                                    {config.googleSheetUrl}
                                  </p>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      Ogni {config.pollingIntervalMinutes || 30} min
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {config.totalRowsImported || 0} lead importati
                                    </span>
                                    {config.lastImportAt && (
                                      <span>
                                        Ultimo sync: {new Date(config.lastImportAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      toast({ title: "Sync in corso...", description: "Controllo nuovi lead dal foglio" });
                                      try {
                                        const response = await fetch(`/api/consultant/lead-import/sheets/${config.id}/import-now`, {
                                          method: "POST",
                                          headers: getAuthHeaders(),
                                        });
                                        if (response.ok) {
                                          const result = await response.json();
                                          const stats = result.data || {};
                                          toast({
                                            title: "Sync completato",
                                            description: `${stats.imported || 0} importati, ${stats.skipped || 0} saltati, ${stats.duplicates || 0} duplicati`,
                                          });
                                          refetchGoogleSheetsJobs();
                                        } else {
                                          const err = await response.json();
                                          toast({ title: "Errore", description: err.error || "Errore durante il sync", variant: "destructive" });
                                        }
                                      } catch (error) {
                                        toast({ title: "Errore", description: "Impossibile eseguire il sync", variant: "destructive" });
                                      }
                                    }}
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                                  >
                                    <RefreshCw className="h-4 w-4 mr-1" />
                                    Esegui
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      setSelectedSheetConfig(config);
                                      setLoadingSheetLeads(true);
                                      setSheetLeadsDialogOpen(true);
                                      try {
                                        const response = await fetch(`/api/consultant/lead-import/sheets/${config.id}/leads`, {
                                          headers: getAuthHeaders(),
                                        });
                                        if (response.ok) {
                                          const data = await response.json();
                                          setSheetLeads(data.leads || []);
                                        }
                                      } catch (error) {
                                        toast({ title: "Errore", description: "Impossibile caricare i lead", variant: "destructive" });
                                      } finally {
                                        setLoadingSheetLeads(false);
                                      }
                                    }}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                                  >
                                    <Users className="h-4 w-4 mr-1" />
                                    Lead
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      setSelectedSheetConfig(config);
                                      setLoadingSheetHistory(true);
                                      setSheetHistoryDialogOpen(true);
                                      try {
                                        const response = await fetch(`/api/consultant/lead-import/sheets/${config.id}/history`, {
                                          headers: getAuthHeaders(),
                                        });
                                        if (response.ok) {
                                          const data = await response.json();
                                          setSheetHistory(data.runs || []);
                                        }
                                      } catch (error) {
                                        toast({ title: "Errore", description: "Impossibile caricare lo storico", variant: "destructive" });
                                      } finally {
                                        setLoadingSheetHistory(false);
                                      }
                                    }}
                                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 border-purple-200"
                                  >
                                    <History className="h-4 w-4 mr-1" />
                                    Storico
                                  </Button>
                                  <Switch
                                    checked={config.pollingEnabled}
                                    onCheckedChange={async (checked) => {
                                      try {
                                        const response = await fetch(`/api/consultant/lead-import/sheets/${config.id}/toggle-polling`, {
                                          method: "POST",
                                          headers: {
                                            ...getAuthHeaders(),
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({ pollingEnabled: checked }),
                                        });
                                        if (response.ok) {
                                          toast({
                                            title: checked ? "Sync attivato" : "Sync disattivato",
                                            description: checked 
                                              ? "Il foglio verrà controllato automaticamente" 
                                              : "Il sync automatico è stato fermato",
                                          });
                                          refetchGoogleSheetsJobs();
                                        } else {
                                          toast({
                                            title: "Errore",
                                            description: "Impossibile aggiornare lo stato",
                                            variant: "destructive",
                                          });
                                        }
                                      } catch (error) {
                                        toast({
                                          title: "Errore",
                                          description: "Errore di connessione",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        const response = await fetch(`/api/consultant/lead-import/sheets/${config.id}`, {
                                          method: "DELETE",
                                          headers: getAuthHeaders(),
                                        });
                                        if (response.ok) {
                                          toast({
                                            title: "Configurazione eliminata",
                                            description: "Il foglio è stato scollegato",
                                          });
                                          refetchGoogleSheetsJobs();
                                        }
                                      } catch (error) {
                                        toast({
                                          title: "Errore",
                                          description: "Impossibile eliminare la configurazione",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
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
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            7
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-orange-900">Configura il Webhook su Twilio</p>
                            <p className="text-sm text-gray-700 mt-1">
                              Vai su <a href="https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders" target="_blank" rel="noopener" className="text-green-600 hover:text-green-800 underline font-medium">WhatsApp Senders</a>, clicca sul tuo numero e nella sezione <strong>"Endpoint Configuration"</strong> inserisci:
                            </p>
                            <div className="bg-slate-100 p-3 rounded-lg font-mono text-xs space-y-2 mt-2">
                              <div>
                                <p className="text-gray-500 mb-1">Webhook URL per i messaggi in arrivo:</p>
                                <div className="flex items-center gap-2">
                                  <code className="bg-white px-2 py-1 rounded border text-green-700 flex-1 break-all">
                                    {window.location.origin}/api/whatsapp/webhook
                                  </code>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 flex-shrink-0"
                                    onClick={() => {
                                      navigator.clipboard.writeText(`${window.location.origin}/api/whatsapp/webhook`);
                                      toast({
                                        title: "URL copiato!",
                                        description: "Incollalo nella configurazione Twilio",
                                      });
                                    }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-gray-500 text-[10px]">Metodo HTTP: <strong>POST</strong></p>
                            </div>
                            <p className="text-xs text-orange-700 mt-2">
                              ⚠️ Questo passaggio è fondamentale per ricevere i messaggi WhatsApp nella piattaforma
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-green-700 text-white rounded-full flex items-center justify-center font-bold text-sm">
                            ✓
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-green-900">Fatto! Il sistema è pronto</p>
                            <p className="text-xs text-green-700 mt-1">Ora puoi creare agenti WhatsApp e iniziare a ricevere messaggi</p>
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

              {/* Instagram DM Tab Content */}
              <TabsContent value="instagram" className="space-y-6">
                <Card className="border-2 border-cyan-200 shadow-xl bg-gradient-to-br from-cyan-50 to-teal-50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl">
                          <Instagram className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-slate-700">Instagram DM</CardTitle>
                          <CardDescription className="text-slate-600">
                            Collega il tuo account Instagram Business per gestire i messaggi diretti
                          </CardDescription>
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={
                          instagramConnectionStatus === "connected" 
                            ? "bg-green-50 text-green-700 border-green-300" 
                            : instagramConnectionStatus === "error"
                            ? "bg-red-50 text-red-700 border-red-300"
                            : "bg-gray-50 text-gray-600 border-gray-300"
                        }
                      >
                        {instagramConnectionStatus === "connected" ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Connesso
                          </>
                        ) : instagramConnectionStatus === "error" ? (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Errore
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Non configurato
                          </>
                        )}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {isLoadingInstagramOAuth ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                      </div>
                    ) : instagramConnectionStatus === "connected" && instagramOAuthData ? (
                      <div className="space-y-6">
                        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-100 rounded-full">
                              <CheckCircle className="h-8 w-8 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-green-800">Account Connesso</h3>
                              <p className="text-green-700 text-lg font-medium">
                                @{instagramOAuthData.username || "instagram_user"}
                              </p>
                              {instagramOAuthData.connectedAt && (
                                <p className="text-sm text-green-600 mt-1">
                                  Connesso il {new Date(instagramOAuthData.connectedAt).toLocaleDateString("it-IT", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit"
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          onClick={async () => {
                            setIsDisconnectingInstagram(true);
                            try {
                              const response = await fetch("/api/instagram/oauth/disconnect", {
                                method: "POST",
                                headers: getAuthHeaders(),
                              });
                              const data = await response.json();
                              if (response.ok) {
                                setInstagramConnectionStatus("not_configured");
                                setInstagramOAuthData(null);
                                queryClient.invalidateQueries({ queryKey: ["/api/instagram/oauth/status"] });
                                toast({
                                  title: "Account scollegato",
                                  description: "Il tuo account Instagram è stato scollegato con successo.",
                                });
                              } else {
                                toast({
                                  title: "Errore",
                                  description: data.message || "Impossibile scollegare l'account",
                                  variant: "destructive",
                                });
                              }
                            } catch (error: any) {
                              toast({
                                title: "Errore",
                                description: error.message || "Errore durante la disconnessione",
                                variant: "destructive",
                              });
                            } finally {
                              setIsDisconnectingInstagram(false);
                            }
                          }}
                          disabled={isDisconnectingInstagram}
                          className="w-full border-red-300 text-red-700 hover:bg-red-50"
                        >
                          {isDisconnectingInstagram ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Scollegamento in corso...
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-2" />
                              Scollega Account
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center">
                          <div className="p-4 bg-cyan-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                            <Instagram className="h-8 w-8 text-cyan-600" />
                          </div>
                          <h3 className="text-lg font-semibold text-slate-700 mb-2">
                            Collega il tuo Account Instagram Business
                          </h3>
                          <p className="text-slate-600 mb-6 max-w-md mx-auto">
                            Connetti il tuo account Instagram Business per gestire automaticamente i messaggi diretti 
                            direttamente da questa piattaforma. La connessione avviene in modo sicuro tramite Meta.
                          </p>

                          <Button
                            size="lg"
                            onClick={async () => {
                              setIsConnectingInstagram(true);
                              try {
                                const response = await fetch("/api/instagram/oauth/start", {
                                  method: "GET",
                                  headers: getAuthHeaders(),
                                });
                                const data = await response.json();
                                if (response.ok && data.authUrl) {
                                  window.location.href = data.authUrl;
                                } else {
                                  toast({
                                    title: "Errore",
                                    description: data.message || "Impossibile avviare la connessione OAuth",
                                    variant: "destructive",
                                  });
                                  setIsConnectingInstagram(false);
                                }
                              } catch (error: any) {
                                toast({
                                  title: "Errore",
                                  description: error.message || "Errore durante l'avvio della connessione",
                                  variant: "destructive",
                                });
                                setIsConnectingInstagram(false);
                              }
                            }}
                            disabled={isConnectingInstagram}
                            className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white px-8 py-3 text-lg"
                          >
                            {isConnectingInstagram ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Connessione in corso...
                              </>
                            ) : (
                              <>
                                <Instagram className="h-5 w-5 mr-2" />
                                Connetti Instagram
                              </>
                            )}
                          </Button>
                        </div>

                        <Alert className="bg-cyan-50 border-cyan-200">
                          <Instagram className="h-4 w-4 text-cyan-600" />
                          <AlertDescription className="text-sm text-cyan-800">
                            <strong>Requisiti:</strong> È necessario un account Instagram Business collegato a una Pagina Facebook 
                            e configurato tramite Meta Business Suite.
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}

                    <div className="border-t border-cyan-200 pt-6 mt-6">
                      <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-cyan-600" />
                        Come Funziona
                      </h4>
                      
                      <div className="space-y-4 text-sm text-slate-600">
                        <div className="bg-white rounded-lg p-4 border border-slate-200">
                          <h5 className="font-medium text-slate-700 mb-2">Prerequisiti</h5>
                          <ul className="list-disc list-inside space-y-1 text-slate-600">
                            <li>Account Instagram Business (non personale)</li>
                            <li>Pagina Facebook collegata all'account Instagram</li>
                            <li>Accesso a Meta Business Suite</li>
                          </ul>
                        </div>

                        <div className="bg-white rounded-lg p-4 border border-slate-200">
                          <h5 className="font-medium text-slate-700 mb-2">Processo di Connessione</h5>
                          <ol className="list-decimal list-inside space-y-1 text-slate-600">
                            <li>Clicca su "Connetti Instagram"</li>
                            <li>Accedi al tuo account Meta/Facebook</li>
                            <li>Autorizza l'accesso ai messaggi Instagram</li>
                            <li>Verrai reindirizzato automaticamente qui</li>
                          </ol>
                        </div>

                        <Alert className="bg-amber-50 border-amber-200">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800">
                            <strong>Finestra 24 ore:</strong> Meta permette di rispondere ai messaggi solo entro 24 ore dall'ultimo messaggio del cliente.
                          </AlertDescription>
                        </Alert>
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

      {/* Sheet Leads Dialog */}
      <Dialog open={sheetLeadsDialogOpen} onOpenChange={setSheetLeadsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Lead Importati - {selectedSheetConfig?.jobName || "Foglio Google"}
            </DialogTitle>
            <DialogDescription>
              {sheetLeads.length} lead importati da questa configurazione
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh]">
            {loadingSheetLeads ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : sheetLeads.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Nessun lead importato</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefono</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Data Importazione</TableHead>
                    <TableHead>Contatto Programmato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheetLeads.map((lead: any) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        {lead.firstName} {lead.lastName}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {lead.phoneNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={lead.status === 'pending' ? 'secondary' : lead.status === 'contacted' ? 'default' : 'outline'}
                          className={lead.status === 'contacted' ? 'bg-green-500' : ''}
                        >
                          {lead.status === 'pending' ? 'In attesa' : lead.status === 'contacted' ? 'Contattato' : lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {lead.importedAt ? new Date(lead.importedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {lead.contactSchedule ? new Date(lead.contactSchedule).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sheet History Dialog */}
      <Dialog open={sheetHistoryDialogOpen} onOpenChange={setSheetHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-purple-600" />
              Storico Importazioni - {selectedSheetConfig?.jobName || "Foglio Google"}
            </DialogTitle>
            <DialogDescription>
              Storico di tutte le esecuzioni di importazione
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh]">
            {loadingSheetHistory ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : sheetHistory.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <History className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Nessuna importazione eseguita</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Esecuzione</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Righe Processate</TableHead>
                    <TableHead>Importati</TableHead>
                    <TableHead>Duplicati</TableHead>
                    <TableHead>Errori</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheetHistory.map((run: any) => (
                    <TableRow key={run.id}>
                      <TableCell className="text-sm">
                        {run.startedAt ? new Date(run.startedAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={run.runStatus === 'completed' ? 'default' : run.runStatus === 'running' ? 'secondary' : 'destructive'}
                          className={run.runStatus === 'completed' ? 'bg-green-500' : run.runStatus === 'running' ? 'bg-blue-500' : ''}
                        >
                          {run.runStatus === 'completed' ? 'Completato' : run.runStatus === 'running' ? 'In corso' : run.runStatus === 'failed' ? 'Fallito' : run.runStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{run.rowsProcessed || 0}</TableCell>
                      <TableCell className="text-center">
                        <span className="text-green-600 font-medium">{run.rowsImported || 0}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-amber-600">{run.rowsDuplicates || 0}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={run.rowsErrors > 0 ? "text-red-600 font-medium" : "text-gray-500"}>{run.rowsErrors || 0}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}