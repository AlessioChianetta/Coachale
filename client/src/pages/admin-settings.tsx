import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Settings,
  Key,
  CheckCircle,
  XCircle,
  History,
  Save,
  Eye,
  EyeOff,
  Shield,
  User,
  Calendar,
  Activity,
  BookOpen,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Video,
  Cloud,
  Loader2,
  Users,
  RefreshCw,
  Link,
  Plus,
  Trash2,
  AlertCircle,
  CreditCard,
  Sparkles,
  Plug,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import Navbar from "@/components/navbar";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface GoogleOAuthConfig {
  configured: boolean;
  clientId: string | null;
  hasSecret: boolean;
}

interface AuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: any;
  createdAt: string;
  adminName?: string;
}

interface VertexConfig {
  id?: string;
  projectId: string;
  location: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ConsultantVertexAccess {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  hasAccess: boolean;
  vertexAccessEnabled?: boolean; // Mapped from hasAccess for UI compatibility
}

interface TurnConfig {
  configured: boolean;
  config: {
    id: string;
    provider: string;
    username: string;
    password: string;
    apiKey?: string;
    turnUrls?: string[];
    enabled: boolean;
    createdAt?: string;
    updatedAt?: string;
  } | null;
}

interface GeminiConfig {
  id: string;
  apiKeys: string[];
  apiKeyCount: number;
  enabled: boolean;
}

interface InstagramConfig {
  configured: boolean;
  config: {
    id: string;
    metaAppId: string;
    verifyToken: string;
    webhookUrl: string;
    enabled: boolean;
    createdAt?: string;
    updatedAt?: string;
  } | null;
}

interface ConsultantLicenseData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  level2Total: number;
  level2Used: number;
  level3Total: number;
  level3Used: number;
  employeeTotal: number;
  employeeUsed: number;
  revenueSharePercentage: number;
}

interface StripeConfig {
  configured: boolean;
  config: {
    id: string;
    stripePublishableKey: string;
    hasSecretKey: boolean;
    hasWebhookSecret: boolean;
    stripeConnectEnabled: boolean;
    enabled: boolean;
    createdAt?: string;
    updatedAt?: string;
  } | null;
}

interface StripeStatsData {
  connectedConsultants: number;
  totalSubscriptions: number;
  platformRevenue: number;
  recentSubscriptions: Array<{
    id: string;
    clientEmail: string;
    clientName: string | null;
    level: "2" | "3";
    status: string;
    createdAt: string | null;
    consultantId: string;
  }>;
  consultantsWithStripe: Array<{
    id: string;
    name: string;
    email: string;
    stripeConnected: boolean;
    onboarded: boolean;
    revenueSharePercentage: number;
  }>;
}

export default function AdminSettings() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("integrazioni");
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [copiedUri, setCopiedUri] = useState<string | null>(null);
  const [videoMeetingClientId, setVideoMeetingClientId] = useState("");
  const [videoMeetingGuideOpen, setVideoMeetingGuideOpen] = useState(false);

  const [vertexFormData, setVertexFormData] = useState({
    projectId: "",
    location: "us-central1",
    serviceAccountJson: "",
    enabled: true,
  });
  const [isSavingVertex, setIsSavingVertex] = useState(false);
  const [isTestingVertex, setIsTestingVertex] = useState(false);

  const [turnFormData, setTurnFormData] = useState({
    provider: "metered" as "metered" | "twilio" | "custom",
    username: "",
    password: "",
    apiKey: "",
    turnUrls: "",
    enabled: true,
  });
  const [showTurnPassword, setShowTurnPassword] = useState(false);
  const [isSavingTurn, setIsSavingTurn] = useState(false);
  const [isTestingTurn, setIsTestingTurn] = useState(false);
  const [turnGuideOpen, setTurnGuideOpen] = useState(false);

  const [geminiFormData, setGeminiFormData] = useState({
    apiKeys: [''],
    enabled: true,
  });
  const [isSavingGemini, setIsSavingGemini] = useState(false);

  const [instagramFormData, setInstagramFormData] = useState({
    metaAppId: "",
    metaAppSecret: "",
    enabled: true,
  });
  const [showInstagramSecret, setShowInstagramSecret] = useState(false);
  const [isSavingInstagram, setIsSavingInstagram] = useState(false);
  const [isTestingInstagram, setIsTestingInstagram] = useState(false);

  const [editingLicense, setEditingLicense] = useState<ConsultantLicenseData | null>(null);
  const [licenseFormData, setLicenseFormData] = useState({
    level2Total: 20,
    level3Total: 10,
    employeeTotal: 0,
    revenueSharePercentage: 50,
  });

  const [stripeFormData, setStripeFormData] = useState({
    stripeSecretKey: "",
    stripePublishableKey: "",
    stripeWebhookSecret: "",
    stripeConnectEnabled: false,
    enabled: false,
  });
  const [showStripeSecretKey, setShowStripeSecretKey] = useState(false);
  const [showStripeWebhookSecret, setShowStripeWebhookSecret] = useState(false);
  const [isSavingStripe, setIsSavingStripe] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const baseUrl = window.location.origin;
  
  const allRedirectUris = {
    consultantDrive: `${baseUrl}/api/consultant/google-drive/callback`,
    clientDrive: `${baseUrl}/api/client/google-drive/callback`,
    consultantCalendar: `${baseUrl}/api/calendar-settings/oauth/callback`,
    agentCalendar: `${baseUrl}/api/whatsapp/agents/calendar/oauth/callback`,
  };

  const copyToClipboard = async (text: string, uriKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUri(uriKey);
      toast({
        title: "Copiato!",
        description: "URI copiato negli appunti.",
      });
      setTimeout(() => setCopiedUri(null), 2000);
    } catch (err) {
      toast({
        title: "Errore",
        description: "Impossibile copiare negli appunti.",
        variant: "destructive",
      });
    }
  };

  const copyAllUris = async () => {
    const allUris = Object.values(allRedirectUris).join('\n');
    try {
      await navigator.clipboard.writeText(allUris);
      setCopiedUri('all');
      toast({
        title: "Copiati tutti!",
        description: "Tutti gli URI sono stati copiati negli appunti.",
      });
      setTimeout(() => setCopiedUri(null), 2000);
    } catch (err) {
      toast({
        title: "Errore",
        description: "Impossibile copiare negli appunti.",
        variant: "destructive",
      });
    }
  };

  const { data: oauthData, isLoading: oauthLoading } = useQuery({
    queryKey: ["/api/admin/settings/google-oauth"],
    queryFn: async () => {
      const response = await fetch("/api/admin/settings/google-oauth", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch Google OAuth settings");
      return response.json();
    },
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["/api/admin/audit-log"],
    queryFn: async () => {
      const response = await fetch("/api/admin/audit-log?limit=20", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch audit log");
      return response.json();
    },
  });

  const { data: videoMeetingOAuthData, isLoading: videoMeetingOAuthLoading } = useQuery({
    queryKey: ["/api/admin/settings/video-meeting-oauth"],
    queryFn: async () => {
      const response = await fetch("/api/admin/settings/video-meeting-oauth", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch Video Meeting OAuth settings");
      return response.json();
    },
  });

  const { data: vertexConfigData, isLoading: isLoadingVertexConfig } = useQuery({
    queryKey: ["/api/admin/superadmin/vertex-config"],
    queryFn: async () => {
      const response = await fetch("/api/admin/superadmin/vertex-config", {
        headers: getAuthHeaders(),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("Errore nel caricamento configurazione Vertex");
      }
      if (response.status === 404) return null;
      return response.json();
    },
  });

  const { data: consultantAccessData, isLoading: isLoadingConsultantAccess } = useQuery({
    queryKey: ["/api/admin/superadmin/consultant-vertex-access"],
    queryFn: async () => {
      const response = await fetch("/api/admin/superadmin/consultant-vertex-access", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Errore nel caricamento accessi consulenti");
      }
      return response.json();
    },
  });

  const { data: turnConfigData, isLoading: isLoadingTurnConfig } = useQuery({
    queryKey: ["/api/admin/turn-config"],
    queryFn: async () => {
      const response = await fetch("/api/admin/turn-config", {
        headers: getAuthHeaders(),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("Errore nel caricamento configurazione TURN");
      }
      if (response.status === 404) return { configured: false, config: null };
      return response.json();
    },
  });

  const { data: geminiConfigData, isLoading: isLoadingGeminiConfig, refetch: refetchGeminiConfig } = useQuery({
    queryKey: ["/api/admin/superadmin/gemini-config"],
    queryFn: async () => {
      const response = await fetch("/api/admin/superadmin/gemini-config", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Errore nel caricamento configurazione Gemini");
      return response.json();
    },
  });

  const { data: instagramConfigData, isLoading: isLoadingInstagramConfig, refetch: refetchInstagramConfig } = useQuery({
    queryKey: ["/api/admin/superadmin/instagram-config"],
    queryFn: async () => {
      const response = await fetch("/api/admin/superadmin/instagram-config", {
        headers: getAuthHeaders(),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("Errore nel caricamento configurazione Instagram");
      }
      if (response.status === 404) return { configured: false, config: null };
      return response.json();
    },
  });

  const { data: consultantLicensesData, isLoading: isLoadingConsultantLicenses } = useQuery({
    queryKey: ["/api/admin/consultant-licenses"],
    queryFn: async () => {
      const response = await fetch("/api/admin/consultant-licenses", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Errore nel caricamento licenze consulenti");
      return response.json();
    },
  });

  const { data: stripeConfigData, isLoading: isLoadingStripeConfig, refetch: refetchStripeConfig } = useQuery<StripeConfig>({
    queryKey: ["/api/admin/stripe-config"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stripe-config", {
        headers: getAuthHeaders(),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("Errore nel caricamento configurazione Stripe");
      }
      if (response.status === 404) return { configured: false, config: null };
      return response.json();
    },
  });

  const { data: stripeStatsData, isLoading: isLoadingStripeStats } = useQuery<StripeStatsData>({
    queryKey: ["/api/admin/stripe-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stripe-stats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: activeTab === "pagamenti",
  });

  const updateLicenseMutation = useMutation({
    mutationFn: async (data: { consultantId: string; level2Total: number; level3Total: number; employeeTotal: number; revenueSharePercentage: number }) => {
      const response = await fetch(`/api/admin/consultant-licenses/${data.consultantId}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          level2Total: data.level2Total,
          level3Total: data.level3Total,
          employeeTotal: data.employeeTotal,
          revenueSharePercentage: data.revenueSharePercentage,
        }),
      });
      if (!response.ok) throw new Error("Errore durante l'aggiornamento");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/consultant-licenses"] });
      setEditingLicense(null);
      toast({
        title: "Licenze aggiornate",
        description: "Le licenze e la revenue share sono state aggiornate con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const consultantLicensesList: ConsultantLicenseData[] = consultantLicensesData?.consultants || [];

  const consultantList: ConsultantVertexAccess[] = (consultantAccessData?.consultants || []).map((c: any) => ({
    ...c,
    vertexAccessEnabled: c.hasAccess ?? true, // Map hasAccess to vertexAccessEnabled for UI
  }));

  useEffect(() => {
    if (videoMeetingOAuthData?.clientId) {
      setVideoMeetingClientId(videoMeetingOAuthData.clientId);
    }
  }, [videoMeetingOAuthData]);

  useEffect(() => {
    if (vertexConfigData?.config) {
      setVertexFormData({
        projectId: vertexConfigData.config.projectId || "",
        location: vertexConfigData.config.location || "us-central1",
        serviceAccountJson: "",
        enabled: vertexConfigData.config.enabled ?? true,
      });
    }
  }, [vertexConfigData]);

  useEffect(() => {
    if (turnConfigData?.config) {
      setTurnFormData({
        provider: turnConfigData.config.provider || "metered",
        username: turnConfigData.config.username || "",
        password: turnConfigData.config.password || "",
        apiKey: turnConfigData.config.apiKey || "",
        turnUrls: (turnConfigData.config.turnUrls || []).join("\n"),
        enabled: turnConfigData.config.enabled ?? true,
      });
    }
  }, [turnConfigData]);

  useEffect(() => {
    if (geminiConfigData?.config) {
      setGeminiFormData({
        apiKeys: geminiConfigData.config.apiKeys?.length > 0 
          ? geminiConfigData.config.apiKeys 
          : [''],
        enabled: geminiConfigData.config.enabled ?? true,
      });
    }
  }, [geminiConfigData]);

  useEffect(() => {
    if (instagramConfigData?.config) {
      setInstagramFormData({
        metaAppId: instagramConfigData.config.metaAppId || "",
        metaAppSecret: "",
        enabled: instagramConfigData.config.enabled ?? true,
      });
    }
  }, [instagramConfigData]);

  useEffect(() => {
    if (stripeConfigData?.config) {
      setStripeFormData({
        stripeSecretKey: "",
        stripePublishableKey: stripeConfigData.config.stripePublishableKey || "",
        stripeWebhookSecret: "",
        stripeConnectEnabled: stripeConfigData.config.stripeConnectEnabled ?? false,
        enabled: stripeConfigData.config.enabled ?? false,
      });
    }
  }, [stripeConfigData]);

  const oauthConfig: GoogleOAuthConfig = oauthData || {
    configured: false,
    clientId: null,
    hasSecret: false,
  };

  const auditLog: AuditLogEntry[] = auditData?.logs || [];

  const saveOAuthMutation = useMutation({
    mutationFn: async (data: { clientId: string; clientSecret: string }) => {
      const response = await fetch("/api/admin/settings/google-oauth", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/google-oauth"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });
      setClientSecret("");
      toast({
        title: "Configurazione salvata",
        description: "Le credenziali Google OAuth sono state aggiornate con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare la configurazione.",
        variant: "destructive",
      });
    },
  });

  const handleSaveOAuth = () => {
    if (!clientId || !clientSecret) {
      toast({
        title: "Campi obbligatori",
        description: "Inserisci sia il Client ID che il Client Secret.",
        variant: "destructive",
      });
      return;
    }
    saveOAuthMutation.mutate({ clientId, clientSecret });
  };

  const saveVideoMeetingOAuthMutation = useMutation({
    mutationFn: async (data: { clientId: string }) => {
      const response = await fetch("/api/admin/settings/video-meeting-oauth", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/video-meeting-oauth"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });
      toast({
        title: "Configurazione salvata",
        description: "Le credenziali Video Meeting OAuth sono state aggiornate.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare la configurazione.",
        variant: "destructive",
      });
    },
  });

  const handleSaveVideoMeetingOAuth = () => {
    if (!videoMeetingClientId) {
      toast({
        title: "Campo obbligatorio",
        description: "Inserisci il Google Client ID.",
        variant: "destructive",
      });
      return;
    }
    saveVideoMeetingOAuthMutation.mutate({ clientId: videoMeetingClientId });
  };

  const handleSaveVertexConfig = async () => {
    if (!vertexFormData.projectId || !vertexFormData.location) {
      toast({
        title: "Campi obbligatori",
        description: "Inserisci Project ID e Location.",
        variant: "destructive",
      });
      return;
    }

    if (!vertexConfigData?.config && !vertexFormData.serviceAccountJson) {
      toast({
        title: "Credenziali mancanti",
        description: "Inserisci il Service Account JSON per la prima configurazione.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingVertex(true);
    try {
      const response = await fetch("/api/admin/superadmin/vertex-config", {
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
        title: "Configurazione salvata",
        description: "Vertex AI configurato con successo per tutti i consulenti.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/superadmin/vertex-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });
      setVertexFormData(prev => ({ ...prev, serviceAccountJson: "" }));
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingVertex(false);
    }
  };

  const handleTestVertexConnection = async () => {
    setIsTestingVertex(true);
    try {
      const response = await fetch("/api/admin/superadmin/vertex-config/test", {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Test fallito");
      }

      const result = await response.json();
      toast({
        title: "Connessione riuscita",
        description: result.message || "Vertex AI è configurato correttamente.",
      });
    } catch (error: any) {
      toast({
        title: "Test fallito",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTestingVertex(false);
    }
  };

  const handleToggleConsultantAccess = async (consultantId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/superadmin/consultant-vertex-access/${consultantId}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hasAccess: enabled }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Errore durante l'aggiornamento");
      }

      toast({
        title: enabled ? "Accesso abilitato" : "Accesso disabilitato",
        description: `Accesso Vertex AI ${enabled ? "abilitato" : "disabilitato"} per il consulente.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/superadmin/consultant-vertex-access"] });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveGeminiConfig = async () => {
    setIsSavingGemini(true);
    try {
      const validKeys = geminiFormData.apiKeys.filter(k => k.trim().length > 0);
      if (validKeys.length === 0) {
        toast({ title: "Errore", description: "Inserisci almeno una API key", variant: "destructive" });
        setIsSavingGemini(false);
        return;
      }
      
      const response = await fetch("/api/admin/superadmin/gemini-config", {
        method: "POST",
        headers: { 
          ...getAuthHeaders(),
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ apiKeys: validKeys, enabled: geminiFormData.enabled }),
      });
      
      if (!response.ok) throw new Error("Errore nel salvataggio");
      
      toast({ title: "Successo", description: "Configurazione Gemini salvata con successo." });
      refetchGeminiConfig();
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingGemini(false);
    }
  };

  const handleAddGeminiKey = () => {
    if (geminiFormData.apiKeys.length < 10) {
      setGeminiFormData(prev => ({ ...prev, apiKeys: [...prev.apiKeys, ''] }));
    }
  };

  const handleRemoveGeminiKey = (index: number) => {
    setGeminiFormData(prev => ({
      ...prev,
      apiKeys: prev.apiKeys.filter((_, i) => i !== index)
    }));
  };

  const handleGeminiKeyChange = (index: number, value: string) => {
    setGeminiFormData(prev => ({
      ...prev,
      apiKeys: prev.apiKeys.map((k, i) => i === index ? value : k)
    }));
  };

  const handleSaveInstagramConfig = async () => {
    if (!instagramFormData.metaAppId) {
      toast({
        title: "Campo obbligatorio",
        description: "Inserisci il Meta App ID.",
        variant: "destructive",
      });
      return;
    }

    if (!instagramConfigData?.config && !instagramFormData.metaAppSecret) {
      toast({
        title: "Campo obbligatorio",
        description: "Inserisci l'App Secret per la prima configurazione.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingInstagram(true);
    try {
      const response = await fetch("/api/admin/superadmin/instagram-config", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metaAppId: instagramFormData.metaAppId,
          metaAppSecret: instagramFormData.metaAppSecret || undefined,
          enabled: instagramFormData.enabled,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || "Errore durante il salvataggio");
      }

      toast({
        title: "Configurazione salvata",
        description: "Instagram OAuth configurato con successo.",
      });

      refetchInstagramConfig();
      setInstagramFormData(prev => ({ ...prev, metaAppSecret: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingInstagram(false);
    }
  };

  const handleEditLicense = (consultant: ConsultantLicenseData) => {
    setEditingLicense(consultant);
    setLicenseFormData({
      level2Total: consultant.level2Total,
      level3Total: consultant.level3Total,
      employeeTotal: consultant.employeeTotal,
      revenueSharePercentage: consultant.revenueSharePercentage,
    });
  };

  const handleSaveLicense = () => {
    if (!editingLicense) return;
    updateLicenseMutation.mutate({
      consultantId: editingLicense.id,
      level2Total: licenseFormData.level2Total,
      level3Total: licenseFormData.level3Total,
      employeeTotal: licenseFormData.employeeTotal,
      revenueSharePercentage: licenseFormData.revenueSharePercentage,
    });
  };

  const handleTestInstagramConfig = async () => {
    setIsTestingInstagram(true);
    try {
      const response = await fetch("/api/admin/superadmin/instagram-config/test", {
        method: "POST",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Connessione riuscita!",
          description: `App verificata: ${data.app?.name || "OK"}`,
        });
      } else {
        toast({
          title: "Test fallito",
          description: data.error || "Credenziali non valide",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTestingInstagram(false);
    }
  };

  const handleSaveTurnConfig = async () => {
    if (!turnFormData.username || !turnFormData.password) {
      toast({
        title: "Campi obbligatori",
        description: "Inserisci username e password TURN.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingTurn(true);
    try {
      const turnUrls = turnFormData.turnUrls
        .split("\n")
        .map(url => url.trim())
        .filter(url => url.length > 0);

      const response = await fetch("/api/admin/turn-config", {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: turnFormData.provider,
          username: turnFormData.username,
          password: turnFormData.password,
          apiKey: turnFormData.apiKey || undefined,
          turnUrls: turnUrls.length > 0 ? turnUrls : undefined,
          enabled: turnFormData.enabled,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore durante il salvataggio");
      }

      toast({
        title: "Configurazione salvata",
        description: "TURN Server configurato con successo per tutti i consulenti.",
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/turn-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingTurn(false);
    }
  };

  const handleTestTurnConnection = async () => {
    setIsTestingTurn(true);
    try {
      if (!turnFormData.username || !turnFormData.password) {
        throw new Error("Inserisci username e password per testare");
      }
      
      if (turnConfigData?.configured) {
        toast({
          title: "Configurazione valida",
          description: "Le credenziali TURN sono configurate correttamente.",
        });
      } else {
        toast({
          title: "Non configurato",
          description: "Salva prima la configurazione TURN.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Test fallito",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTestingTurn(false);
    }
  };

  const handleSaveStripeConfig = async () => {
    if (!stripeConfigData?.config && (!stripeFormData.stripeSecretKey || !stripeFormData.stripePublishableKey)) {
      toast({
        title: "Campi obbligatori",
        description: "Inserisci Stripe Secret Key e Publishable Key.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingStripe(true);
    try {
      const response = await fetch("/api/admin/stripe-config", {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stripeSecretKey: stripeFormData.stripeSecretKey || undefined,
          stripePublishableKey: stripeFormData.stripePublishableKey,
          stripeWebhookSecret: stripeFormData.stripeWebhookSecret || undefined,
          stripeConnectEnabled: stripeFormData.stripeConnectEnabled,
          enabled: stripeFormData.enabled,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore durante il salvataggio");
      }

      toast({
        title: "Configurazione salvata",
        description: "Stripe configurato con successo.",
      });

      setStripeFormData(prev => ({ ...prev, stripeSecretKey: "", stripeWebhookSecret: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stripe-config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-log"] });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingStripe(false);
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      update_google_oauth: "Aggiornamento Google OAuth",
      update_video_meeting_oauth: "Aggiornamento Video Meeting OAuth",
      create_setting: "Nuova impostazione",
      update_setting: "Modifica impostazione",
      activate_user: "Attivazione utente",
      deactivate_user: "Disattivazione utente",
      create_user: "Creazione utente",
      update_superadmin_stripe_config: "Aggiornamento Stripe Config",
      create_superadmin_stripe_config: "Creazione Stripe Config",
    };
    return labels[action] || action;
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("create")) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (action.includes("update")) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    if (action.includes("deactivate")) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    if (action.includes("activate")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="mb-6 md:mb-8">
            <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 rounded-2xl md:rounded-3xl p-6 md:p-8 text-white shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 md:p-3 bg-white/20 backdrop-blur-sm rounded-xl md:rounded-2xl">
                  <Settings className="w-6 h-6 md:w-8 md:h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">Impostazioni Sistema</h1>
                  <p className="text-orange-100 text-sm md:text-base hidden sm:block">
                    Configura le impostazioni globali della piattaforma
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="integrazioni" className="flex items-center gap-2">
                <Plug className="w-4 h-4" />
                <span className="hidden sm:inline">Integrazioni</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">AI</span>
              </TabsTrigger>
              <TabsTrigger value="pagamenti" className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span className="hidden sm:inline">Pagamenti</span>
              </TabsTrigger>
              <TabsTrigger value="licenze" className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                <span className="hidden sm:inline">Licenze</span>
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex items-center gap-2">
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Audit</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="integrazioni">
              <div className="grid lg:grid-cols-2 gap-6">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-blue-500" />
                      Google OAuth Credentials
                    </CardTitle>
                    <CardDescription>
                      Configura le credenziali per l'integrazione con Google Drive e Calendar
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                      <div className={`p-2 rounded-lg ${oauthConfig.configured ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                        {oauthConfig.configured ? (
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {oauthConfig.configured ? "Configurazione Attiva" : "Non Configurato"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {oauthConfig.configured
                            ? `Client ID: ${oauthConfig.clientId?.substring(0, 30)}...`
                            : "Inserisci le credenziali per abilitare l'integrazione Google"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="clientId">Google OAuth Client ID</Label>
                        <Input
                          id="clientId"
                          placeholder="123456789-abcdef.apps.googleusercontent.com"
                          value={clientId}
                          onChange={(e) => setClientId(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="clientSecret">Google OAuth Client Secret</Label>
                        <div className="relative">
                          <Input
                            id="clientSecret"
                            type={showClientSecret ? "text" : "password"}
                            placeholder="GOCSPX-..."
                            value={clientSecret}
                            onChange={(e) => setClientSecret(e.target.value)}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full"
                            onClick={() => setShowClientSecret(!showClientSecret)}
                          >
                            {showClientSecret ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <Button
                        onClick={handleSaveOAuth}
                        disabled={saveOAuthMutation.isPending}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-500"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {saveOAuthMutation.isPending ? "Salvataggio..." : "Salva Credenziali"}
                      </Button>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 space-y-3">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>Importante:</strong> Aggiungi questi URI nella Google Cloud Console prima di salvare:
                      </p>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-700 dark:text-amber-300 font-medium min-w-[140px]">Drive Consulenti:</span>
                          <code className="flex-1 bg-white dark:bg-gray-900 px-2 py-1 rounded text-amber-900 dark:text-amber-100 break-all">{allRedirectUris.consultantDrive}</code>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyToClipboard(allRedirectUris.consultantDrive, 'consultantDrive2')}>
                            {copiedUri === 'consultantDrive2' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-amber-700 dark:text-amber-300 font-medium min-w-[140px]">Drive Clienti:</span>
                          <code className="flex-1 bg-white dark:bg-gray-900 px-2 py-1 rounded text-amber-900 dark:text-amber-100 break-all">{allRedirectUris.clientDrive}</code>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyToClipboard(allRedirectUris.clientDrive, 'clientDrive2')}>
                            {copiedUri === 'clientDrive2' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-amber-700 dark:text-amber-300 font-medium min-w-[140px]">Calendar Consulenti:</span>
                      <code className="flex-1 bg-white dark:bg-gray-900 px-2 py-1 rounded text-amber-900 dark:text-amber-100 break-all">{allRedirectUris.consultantCalendar}</code>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyToClipboard(allRedirectUris.consultantCalendar, 'consultantCalendar')}>
                        {copiedUri === 'consultantCalendar' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-700 dark:text-amber-300 font-medium min-w-[140px]">Calendar Agenti:</span>
                      <code className="flex-1 bg-white dark:bg-gray-900 px-2 py-1 rounded text-amber-900 dark:text-amber-100 break-all">{allRedirectUris.agentCalendar}</code>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyToClipboard(allRedirectUris.agentCalendar, 'agentCalendar')}>
                        {copiedUri === 'agentCalendar' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-700 dark:text-amber-300 font-medium min-w-[140px]">Origine JS:</span>
                      <code className="flex-1 bg-white dark:bg-gray-900 px-2 py-1 rounded text-amber-900 dark:text-amber-100 break-all">{baseUrl}</code>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copyToClipboard(baseUrl, 'origin2')}>
                        {copiedUri === 'origin2' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Guida: Come ottenere le credenziali OAuth
                      </span>
                      {guideOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4">
                    <div className="space-y-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                          1
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Accedi alla Google Cloud Console
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Vai su Google Cloud Console e accedi con il tuo account Google.
                          </p>
                          <a
                            href="https://console.cloud.google.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Apri Google Cloud Console
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                          2
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Crea o seleziona un progetto
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Clicca sul selettore progetti in alto a sinistra. Puoi creare un nuovo progetto 
                            (es. "Piattaforma Consulenti") oppure selezionarne uno esistente.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                          3
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Abilita le API necessarie
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Vai su <strong>"API e servizi" → "Libreria"</strong> e abilita:
                          </p>
                          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                            <li>Google Drive API</li>
                            <li>Google Calendar API</li>
                          </ul>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                          4
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Configura la schermata di consenso OAuth
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Vai su <strong>"API e servizi" → "Schermata di consenso OAuth"</strong>:
                          </p>
                          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                            <li>Scegli <strong>"Esterno"</strong> come tipo utente</li>
                            <li>Compila i campi obbligatori (nome app, email supporto, email sviluppatore)</li>
                            <li>Aggiungi gli scope: <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">.../auth/drive.file</code> e <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">.../auth/calendar</code></li>
                            <li>Nella sezione "Utenti test", aggiungi le email degli utenti che potranno usare l'app</li>
                          </ul>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                          5
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Crea le credenziali OAuth
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Vai su <strong>"API e servizi" → "Credenziali"</strong> e clicca <strong>"+ CREA CREDENZIALI" → "ID client OAuth"</strong>:
                          </p>
                          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-2">
                            <li>Tipo di applicazione: <strong>Applicazione web</strong></li>
                            <li>Nome: es. "Piattaforma Consulenti OAuth"</li>
                            <li>URI di reindirizzamento autorizzati: aggiungi l'URI seguente</li>
                          </ul>
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                            URI di reindirizzamento da aggiungere:
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={copyAllUris}
                            className="shrink-0"
                          >
                            {copiedUri === 'all' ? (
                              <><Check className="w-4 h-4 text-green-500 mr-1" /> Copiati!</>
                            ) : (
                              <><Copy className="w-4 h-4 mr-1" /> Copia tutti</>
                            )}
                          </Button>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                              Google Drive - Consulenti:
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs bg-white dark:bg-gray-900 px-3 py-2 rounded border border-blue-200 dark:border-blue-700 break-all">
                                {allRedirectUris.consultantDrive}
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(allRedirectUris.consultantDrive, 'consultantDrive')}
                                className="shrink-0 h-8 w-8 p-0"
                              >
                                {copiedUri === 'consultantDrive' ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                              Google Drive - Clienti:
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs bg-white dark:bg-gray-900 px-3 py-2 rounded border border-blue-200 dark:border-blue-700 break-all">
                                {allRedirectUris.clientDrive}
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(allRedirectUris.clientDrive, 'clientDrive')}
                                className="shrink-0 h-8 w-8 p-0"
                              >
                                {copiedUri === 'clientDrive' ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                              Google Calendar - Consulenti:
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs bg-white dark:bg-gray-900 px-3 py-2 rounded border border-blue-200 dark:border-blue-700 break-all">
                                {allRedirectUris.consultantCalendar}
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(allRedirectUris.consultantCalendar, 'consultantCalendar2')}
                                className="shrink-0 h-8 w-8 p-0"
                              >
                                {copiedUri === 'consultantCalendar2' ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                              Google Calendar - Agenti WhatsApp:
                            </p>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 text-xs bg-white dark:bg-gray-900 px-3 py-2 rounded border border-blue-200 dark:border-blue-700 break-all">
                                {allRedirectUris.agentCalendar}
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(allRedirectUris.agentCalendar, 'agentCalendar2')}
                                className="shrink-0 h-8 w-8 p-0"
                              >
                                {copiedUri === 'agentCalendar2' ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-blue-200 dark:border-blue-700">
                          <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
                            Origine JavaScript autorizzata:
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs bg-white dark:bg-gray-900 px-3 py-2 rounded border border-blue-200 dark:border-blue-700 break-all">
                              {baseUrl}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(baseUrl, 'origin')}
                              className="shrink-0 h-8 w-8 p-0"
                            >
                              {copiedUri === 'origin' ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">
                          6
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Copia le credenziali
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Dopo aver creato le credenziali, Google ti mostrerà il <strong>Client ID</strong> e il <strong>Client Secret</strong>. 
                            Copia questi valori e incollali nei campi qui sopra, poi clicca "Salva Credenziali".
                          </p>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                        <p className="text-sm text-green-800 dark:text-green-200">
                          <strong>Fatto!</strong> Una volta salvate le credenziali, tutti i consultant potranno 
                          collegare il proprio Google Drive e Calendar cliccando semplicemente "Connetti" 
                          nelle rispettive impostazioni.
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-teal-500" />
                  Video Meeting OAuth
                </CardTitle>
                <CardDescription>
                  Configura l'autenticazione Google Sign-In per i video meeting di tutti i consultant
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-xl bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
                  <p className="text-sm text-teal-800 dark:text-teal-200">
                    <strong>A cosa serve?</strong> Il Google Client ID permette ai partecipanti dei video meeting 
                    di autenticarsi con il loro account Google. Questo consente di identificare automaticamente 
                    chi è il proprietario/venditore durante la chiamata.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${videoMeetingOAuthData?.configured ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {videoMeetingOAuthData?.configured ? 'Configurato' : 'Non configurato'}
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="videoMeetingClientId">Google Client ID</Label>
                    <Input
                      id="videoMeetingClientId"
                      type="text"
                      placeholder="123456789-xxxxxxxx.apps.googleusercontent.com"
                      value={videoMeetingClientId}
                      onChange={(e) => setVideoMeetingClientId(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                      Il Client ID OAuth 2.0 per l'autenticazione Google nei video meeting
                    </p>
                  </div>

                  <Button
                    onClick={handleSaveVideoMeetingOAuth}
                    disabled={saveVideoMeetingOAuthMutation.isPending}
                    className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveVideoMeetingOAuthMutation.isPending ? "Salvataggio..." : "Salva Client ID"}
                  </Button>
                </div>

                <Collapsible open={videoMeetingGuideOpen} onOpenChange={setVideoMeetingGuideOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Guida: Come ottenere il Client ID per Video Meeting
                      </span>
                      {videoMeetingGuideOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4">
                    <div className="space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-sm">
                          1
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Vai alla Google Cloud Console
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Puoi usare lo stesso progetto Google Cloud creato per Drive/Calendar.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-sm">
                          2
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Crea credenziali OAuth 2.0
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Vai su "API e servizi" → "Credenziali" → "Crea credenziali" → "ID client OAuth". 
                            Seleziona "Applicazione web" e aggiungi le origini JavaScript autorizzate 
                            (es: il dominio della piattaforma).
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-sm">
                          3
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Configura la schermata di consenso OAuth
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Seleziona "Esterno" come tipo utente. Aggiungi gli scope: email, profile, openid. 
                            Per rimuovere il limite di 100 utenti test, pubblica l'app.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">
                          4
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            Copia il Client ID
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Copia il Client ID (termina con <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">.apps.googleusercontent.com</code>) 
                            e incollalo nel campo sopra.
                          </p>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                        <p className="text-sm text-green-800 dark:text-green-200">
                          <strong>Fatto!</strong> Tutti i consultant potranno usare l'autenticazione Google 
                          nei loro video meeting senza dover configurare nulla.
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
              </div>
            </TabsContent>

            <TabsContent value="ai">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Vertex AI SuperAdmin Configuration */}
                <Card className="border-0 shadow-lg lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-indigo-500" />
                  Configurazione Vertex AI (SuperAdmin)
                </CardTitle>
                <CardDescription>
                  Configura Vertex AI per tutti i consulenti della piattaforma
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className={`p-2 rounded-lg ${vertexConfigData?.config ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    {vertexConfigData?.config ? (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {vertexConfigData?.config ? "Configurato" : "Non Configurato"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {vertexConfigData?.config
                        ? `Project: ${vertexConfigData.config.projectId} - Location: ${vertexConfigData.config.location}`
                        : "Inserisci le credenziali per abilitare Vertex AI"}
                    </p>
                  </div>
                  {vertexConfigData?.config && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="vertex-enabled" className="text-sm">Abilitato</Label>
                      <Switch
                        id="vertex-enabled"
                        checked={vertexFormData.enabled}
                        onCheckedChange={(checked) => setVertexFormData(prev => ({ ...prev, enabled: checked }))}
                      />
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vertex-project-id">Project ID *</Label>
                    <Input
                      id="vertex-project-id"
                      placeholder="my-gcp-project-123"
                      value={vertexFormData.projectId}
                      onChange={(e) => setVertexFormData(prev => ({ ...prev, projectId: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vertex-location">Location *</Label>
                    <Select
                      value={vertexFormData.location}
                      onValueChange={(value) => setVertexFormData(prev => ({ ...prev, location: value }))}
                    >
                      <SelectTrigger id="vertex-location">
                        <SelectValue placeholder="Seleziona location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us-central1">US Central 1 (Iowa)</SelectItem>
                        <SelectItem value="us-east1">US East 1 (South Carolina)</SelectItem>
                        <SelectItem value="europe-west1">Europe West 1 (Belgio)</SelectItem>
                        <SelectItem value="europe-west4">Europe West 4 (Paesi Bassi)</SelectItem>
                        <SelectItem value="asia-southeast1">Asia Southeast 1 (Singapore)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vertex-service-account">Service Account JSON {!vertexConfigData?.config && "*"}</Label>
                  <Textarea
                    id="vertex-service-account"
                    placeholder='{"type": "service_account", "project_id": "...", "private_key": "...", ...}'
                    value={vertexFormData.serviceAccountJson}
                    onChange={(e) => setVertexFormData(prev => ({ ...prev, serviceAccountJson: e.target.value }))}
                    rows={5}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-gray-500">
                    {vertexConfigData?.config
                      ? "Lascia vuoto per mantenere le credenziali esistenti, oppure incolla un nuovo JSON per aggiornarle."
                      : "Incolla il JSON completo del Service Account Google Cloud."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleSaveVertexConfig}
                    disabled={isSavingVertex || !vertexFormData.projectId || !vertexFormData.location}
                    className="bg-gradient-to-r from-indigo-500 to-purple-500"
                  >
                    {isSavingVertex ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvataggio...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> Salva Configurazione</>
                    )}
                  </Button>

                  {vertexConfigData?.config && (
                    <Button
                      variant="outline"
                      onClick={handleTestVertexConnection}
                      disabled={isTestingVertex}
                    >
                      {isTestingVertex ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Test in corso...</>
                      ) : (
                        <><RefreshCw className="w-4 h-4 mr-2" /> Test Connessione</>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Google AI Studio SuperAdmin Configuration */}
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-600 rounded-xl">
                    <Key className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Configurazione Google AI Studio (SuperAdmin)
                    </CardTitle>
                    <CardDescription>
                      Configura le API keys Gemini per tutti i consulenti della piattaforma
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoadingGeminiConfig ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                      <div>
                        <Label className="text-base font-medium">Abilitato</Label>
                        <p className="text-sm text-gray-500">
                          {geminiFormData.enabled 
                            ? "I consulenti possono usare queste API keys" 
                            : "Configurazione disabilitata"}
                        </p>
                      </div>
                      <Switch
                        checked={geminiFormData.enabled}
                        onCheckedChange={(checked) => setGeminiFormData(prev => ({ ...prev, enabled: checked }))}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">API Keys ({geminiFormData.apiKeys.length}/10)</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddGeminiKey}
                          disabled={geminiFormData.apiKeys.length >= 10}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Aggiungi Key
                        </Button>
                      </div>

                      {geminiFormData.apiKeys.map((key, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500 w-6">#{index + 1}</span>
                          <Input
                            type="password"
                            value={key}
                            onChange={(e) => handleGeminiKeyChange(index, e.target.value)}
                            placeholder="AIzaSy..."
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveGeminiKey(index)}
                            disabled={geminiFormData.apiKeys.length <= 1}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-sm text-blue-800">
                        Le API keys vengono ruotate automaticamente per distribuire il carico.
                        I consulenti possono scegliere di usare queste keys o le proprie.
                      </AlertDescription>
                    </Alert>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <Button
                        onClick={handleSaveGeminiConfig}
                        disabled={isSavingGemini}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600"
                      >
                        {isSavingGemini ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Salva Configurazione
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Instagram OAuth Configuration */}
            <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/20 dark:to-fuchsia-950/20 lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-xl">
                    <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Configurazione Instagram OAuth (SuperAdmin)
                    </CardTitle>
                    <CardDescription>
                      Configura le credenziali Meta per l'integrazione Instagram DM
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoadingInstagramConfig ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-gray-800/50 border">
                      <div className={`p-2 rounded-lg ${instagramConfigData?.configured ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                        {instagramConfigData?.configured ? (
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {instagramConfigData?.configured ? "Configurato" : "Non Configurato"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {instagramConfigData?.configured
                            ? `App ID: ${instagramConfigData.config?.metaAppId?.substring(0, 15)}... - ${instagramFormData.enabled ? "Abilitato" : "Disabilitato"}`
                            : "Inserisci le credenziali Meta per abilitare Instagram DM"}
                        </p>
                      </div>
                      {instagramConfigData?.configured && (
                        <div className="flex items-center gap-2">
                          <Label htmlFor="instagram-enabled" className="text-sm">Abilitato</Label>
                          <Switch
                            id="instagram-enabled"
                            checked={instagramFormData.enabled}
                            onCheckedChange={(checked) => setInstagramFormData(prev => ({ ...prev, enabled: checked }))}
                          />
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                      <p className="text-sm text-purple-800 dark:text-purple-200">
                        <strong>A cosa serve?</strong> Questa configurazione imposta le credenziali della tua App Meta (condivise tra tutti i consulenti). 
                        Ogni consulente collegherà poi il proprio account Instagram tramite OAuth nella sezione "Chiavi API" e otterrà il proprio <strong>Page Access Token</strong> automaticamente.
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="instagram-app-id">Meta App ID *</Label>
                        <Input
                          id="instagram-app-id"
                          placeholder="123456789012345"
                          value={instagramFormData.metaAppId}
                          onChange={(e) => setInstagramFormData(prev => ({ ...prev, metaAppId: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="instagram-app-secret">
                          App Secret {!instagramConfigData?.configured && "*"}
                        </Label>
                        <div className="relative">
                          <Input
                            id="instagram-app-secret"
                            type={showInstagramSecret ? "text" : "password"}
                            placeholder={instagramConfigData?.configured ? "••••••••••••••••" : "Inserisci App Secret"}
                            value={instagramFormData.metaAppSecret}
                            onChange={(e) => setInstagramFormData(prev => ({ ...prev, metaAppSecret: e.target.value }))}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full"
                            onClick={() => setShowInstagramSecret(!showInstagramSecret)}
                          >
                            {showInstagramSecret ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                          {instagramConfigData?.configured
                            ? `Lascia vuoto per mantenere il secret esistente ${instagramConfigData.config?.metaAppSecretPreview ? `(salvato: ${instagramConfigData.config.metaAppSecretPreview})` : ''}`
                            : "Obbligatorio per la prima configurazione"}
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      {instagramConfigData?.configured && instagramConfigData.config?.verifyToken && (
                        <div className="space-y-2">
                          <Label>Verify Token (auto-generato)</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              value={instagramConfigData.config.verifyToken || ""}
                              readOnly
                              className="bg-gray-50 dark:bg-gray-800 font-mono text-xs"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => copyToClipboard(instagramConfigData.config?.verifyToken || "", 'instagramVerifyToken')}
                            >
                              {copiedUri === 'instagramVerifyToken' ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500">
                            Usa questo token nella configurazione Webhook di Meta
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Webhook URL (dinamico)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={`${window.location.origin}/api/instagram/webhook`}
                            readOnly
                            className="bg-gray-50 dark:bg-gray-800 font-mono text-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(`${window.location.origin}/api/instagram/webhook`, 'instagramWebhookUrl')}
                          >
                            {copiedUri === 'instagramWebhookUrl' ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                          Configura questo URL come Webhook Callback nella console Meta
                        </p>
                      </div>
                    </div>

                    <Alert className="bg-purple-50 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800">
                      <AlertCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <AlertDescription className="text-sm text-purple-800 dark:text-purple-200">
                        <strong>Passaggi per configurare:</strong>
                        <ol className="list-decimal list-inside mt-2 space-y-1">
                          <li>Crea un'app su <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="underline">Meta for Developers</a></li>
                          <li>Abilita i prodotti "Instagram Basic Display" e "Messenger"</li>
                          <li>Copia App ID e App Secret e inseriscili qui</li>
                          <li>Dopo aver salvato, usa Verify Token e Webhook URL nella sezione Webhooks</li>
                        </ol>
                      </AlertDescription>
                    </Alert>

                    <div className="flex flex-wrap justify-end gap-3 pt-4 border-t">
                      <Button
                        onClick={handleSaveInstagramConfig}
                        disabled={isSavingInstagram || !instagramFormData.metaAppId}
                        className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700"
                      >
                        {isSavingInstagram ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Salva Configurazione
                      </Button>

                      {instagramConfigData?.configured && (
                        <Button
                          variant="outline"
                          onClick={handleTestInstagramConfig}
                          disabled={isTestingInstagram}
                        >
                          {isTestingInstagram ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Test in corso...</>
                          ) : (
                            <><RefreshCw className="w-4 h-4 mr-2" /> Test Connessione</>
                          )}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* TURN Server Configuration */}
            <Card className="border-0 shadow-lg lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link className="w-5 h-5 text-cyan-500" />
                  TURN Server Configuration (SuperAdmin)
                </CardTitle>
                <CardDescription>
                  Configura il server TURN centralizzato per tutti i video meeting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className={`p-2 rounded-lg ${turnConfigData?.configured ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    {turnConfigData?.configured ? (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {turnConfigData?.configured ? "Configurato" : "Non Configurato"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {turnConfigData?.configured
                        ? `Provider: ${turnConfigData.config?.provider} - ${turnFormData.enabled ? "Abilitato" : "Disabilitato"}`
                        : "Inserisci le credenziali per abilitare TURN per tutti i meeting"}
                    </p>
                  </div>
                  {turnConfigData?.configured && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="turn-enabled" className="text-sm">Abilitato</Label>
                      <Switch
                        id="turn-enabled"
                        checked={turnFormData.enabled}
                        onCheckedChange={(checked) => setTurnFormData(prev => ({ ...prev, enabled: checked }))}
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                  <p className="text-sm text-cyan-800 dark:text-cyan-200">
                    <strong>Benefici del TURN Server:</strong> Il server TURN consente connessioni video affidabili anche 
                    quando i partecipanti sono dietro firewall restrittivi o NAT simmetrici. Con questa configurazione 
                    centralizzata, tutti i consulenti potranno usufruire del servizio senza dover configurare nulla.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="turn-provider">Provider *</Label>
                    <Select
                      value={turnFormData.provider}
                      onValueChange={(value: "metered" | "twilio" | "custom") => setTurnFormData(prev => ({ ...prev, provider: value }))}
                    >
                      <SelectTrigger id="turn-provider">
                        <SelectValue placeholder="Seleziona provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metered">Metered TURN</SelectItem>
                        <SelectItem value="twilio">Twilio</SelectItem>
                        <SelectItem value="custom">Custom Server</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="turn-username">Username *</Label>
                    <Input
                      id="turn-username"
                      placeholder="turn-username"
                      value={turnFormData.username}
                      onChange={(e) => setTurnFormData(prev => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="turn-password">Password *</Label>
                    <div className="relative">
                      <Input
                        id="turn-password"
                        type={showTurnPassword ? "text" : "password"}
                        placeholder="turn-password"
                        value={turnFormData.password}
                        onChange={(e) => setTurnFormData(prev => ({ ...prev, password: e.target.value }))}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowTurnPassword(!showTurnPassword)}
                      >
                        {showTurnPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="turn-apikey">API Key (opzionale)</Label>
                    <Input
                      id="turn-apikey"
                      placeholder="api-key (se richiesto dal provider)"
                      value={turnFormData.apiKey}
                      onChange={(e) => setTurnFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                    />
                  </div>
                </div>

                {turnFormData.provider === "custom" && (
                  <div className="space-y-2">
                    <Label htmlFor="turn-urls">Custom TURN URLs</Label>
                    <Textarea
                      id="turn-urls"
                      placeholder={"turn:turn.example.com:3478\nturns:turn.example.com:5349"}
                      value={turnFormData.turnUrls}
                      onChange={(e) => setTurnFormData(prev => ({ ...prev, turnUrls: e.target.value }))}
                      rows={3}
                      className="font-mono text-xs"
                    />
                    <p className="text-xs text-gray-500">
                      Inserisci un URL per riga. Formati supportati: turn:host:port, turns:host:port
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleSaveTurnConfig}
                    disabled={isSavingTurn || !turnFormData.username || !turnFormData.password}
                    className="bg-gradient-to-r from-cyan-500 to-teal-500"
                  >
                    {isSavingTurn ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvataggio...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> Salva Configurazione</>
                    )}
                  </Button>

                  {turnConfigData?.configured && (
                    <Button
                      variant="outline"
                      onClick={handleTestTurnConnection}
                      disabled={isTestingTurn}
                    >
                      {isTestingTurn ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Test in corso...</>
                      ) : (
                        <><RefreshCw className="w-4 h-4 mr-2" /> Test Connessione</>
                      )}
                    </Button>
                  )}
                </div>

                <Collapsible open={turnGuideOpen} onOpenChange={setTurnGuideOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-4 h-auto">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-cyan-500" />
                        <span>Guida alla configurazione TURN</span>
                      </div>
                      {turnGuideOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl mt-2">
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                        <h4 className="font-semibold text-cyan-600 dark:text-cyan-400 mb-2">1. Metered TURN (Consigliato)</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Servizio TURN gestito con prezzi basati sull'utilizzo.
                        </p>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                          <li>Registrati su <a href="https://www.metered.ca/stun-turn" target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline">metered.ca/stun-turn</a></li>
                          <li>Crea un progetto e ottieni le credenziali</li>
                          <li>Inserisci Username e Password qui</li>
                          <li>L'API Key è opzionale per statistiche avanzate</li>
                        </ul>
                      </div>

                      <div className="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                        <h4 className="font-semibold text-purple-600 dark:text-purple-400 mb-2">2. Twilio</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Servizio professionale con infrastruttura globale.
                        </p>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                          <li>Vai su <a href="https://www.twilio.com/console" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Twilio Console</a></li>
                          <li>Usa Account SID come Username</li>
                          <li>Usa Auth Token come Password</li>
                          <li>Il sistema genererà automaticamente i TURN server</li>
                        </ul>
                      </div>

                      <div className="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                        <h4 className="font-semibold text-orange-600 dark:text-orange-400 mb-2">3. Custom Server</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Configura il tuo server TURN self-hosted (es. coturn).
                        </p>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                          <li>Installa coturn sul tuo server</li>
                          <li>Configura username e password nel server</li>
                          <li>Inserisci gli URL TURN nella textarea dedicata</li>
                          <li>Formato: turn:hostname:port o turns:hostname:port</li>
                        </ul>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

                {/* Consultant Access List */}
                <Card className="border-0 shadow-lg lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-500" />
                      Accesso Consulenti a Vertex AI
                    </CardTitle>
                    <CardDescription>
                      Gestisci quali consulenti possono utilizzare Vertex AI del SuperAdmin
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                {isLoadingConsultantAccess ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-500">Caricamento consulenti...</p>
                  </div>
                ) : consultantList.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nessun consulente</h3>
                    <p className="text-gray-500">Non ci sono consulenti registrati nella piattaforma.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-center">Accesso Vertex</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {consultantList.map((consultant) => (
                          <TableRow key={consultant.id}>
                            <TableCell className="font-medium">
                              {consultant.firstName} {consultant.lastName}
                            </TableCell>
                            <TableCell className="text-gray-500">{consultant.email}</TableCell>
                            <TableCell className="text-center">
                              <Switch
                                checked={consultant.vertexAccessEnabled}
                                onCheckedChange={(checked) => handleToggleConsultantAccess(consultant.id, checked)}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
              </div>
            </TabsContent>

            <TabsContent value="pagamenti">
              <div className="space-y-6">
                {/* Stripe Connect Overview Card */}
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                          <CreditCard className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                          <CardTitle>Panoramica Stripe Connect</CardTitle>
                          <CardDescription>Revenue e transazioni della piattaforma</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoadingStripeStats ? (
                      <div className="p-8 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-violet-500 mx-auto mb-4" />
                        <p className="text-gray-500">Caricamento statistiche...</p>
                      </div>
                    ) : stripeStatsData ? (
                      <div className="space-y-6">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-blue-500/10">
                                <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Sottoscrizioni Attive</p>
                                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stripeStatsData.totalSubscriptions}</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-green-500/10">
                                <CreditCard className="w-5 h-5 text-green-600 dark:text-green-400" />
                              </div>
                              <div>
                                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Revenue Piattaforma</p>
                                <p className="text-2xl font-bold text-green-900 dark:text-green-100">€{stripeStatsData.platformRevenue.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                          <div className="p-4 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/20 dark:to-violet-800/20 border border-violet-200 dark:border-violet-800">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-violet-500/10">
                                <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                              </div>
                              <div>
                                <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">Consulenti Connessi</p>
                                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{stripeStatsData.connectedConsultants}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Recent Subscriptions Table */}
                        {stripeStatsData.recentSubscriptions.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Ultime Transazioni</h4>
                            <div className="overflow-x-auto rounded-lg border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Email Cliente</TableHead>
                                    <TableHead>Livello</TableHead>
                                    <TableHead>Stato</TableHead>
                                    <TableHead>Data</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {stripeStatsData.recentSubscriptions.map((sub) => (
                                    <TableRow key={sub.id}>
                                      <TableCell className="font-medium">{sub.clientEmail}</TableCell>
                                      <TableCell>
                                        <Badge variant={sub.level === "3" ? "default" : "secondary"}>
                                          L{sub.level}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <Badge 
                                          variant="outline" 
                                          className={
                                            sub.status === "active" 
                                              ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" 
                                              : sub.status === "pending"
                                              ? "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
                                              : "bg-gray-50 text-gray-700 border-gray-200"
                                          }
                                        >
                                          {sub.status}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-gray-500">
                                        {sub.createdAt ? format(new Date(sub.createdAt), "dd MMM yyyy", { locale: it }) : "N/A"}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}

                        {/* Consultants with Stripe Table */}
                        {stripeStatsData.consultantsWithStripe.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Consulenti con Stripe Connect</h4>
                            <div className="overflow-x-auto rounded-lg border">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="text-center">Revenue Share %</TableHead>
                                    <TableHead className="text-center">Stato</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {stripeStatsData.consultantsWithStripe.map((consultant) => (
                                    <TableRow key={consultant.id}>
                                      <TableCell className="font-medium">{consultant.name}</TableCell>
                                      <TableCell className="text-gray-500">{consultant.email}</TableCell>
                                      <TableCell className="text-center">
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                                          {consultant.revenueSharePercentage}%
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {consultant.onboarded ? (
                                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                            Attivo
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary">
                                            <AlertCircle className="w-3 h-3 mr-1" />
                                            In attesa
                                          </Badge>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        )}

                        {stripeStatsData.recentSubscriptions.length === 0 && stripeStatsData.consultantsWithStripe.length === 0 && (
                          <div className="p-8 text-center">
                            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nessuna transazione</h3>
                            <p className="text-gray-500">Non ci sono ancora transazioni o consulenti connessi a Stripe.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Dati non disponibili</h3>
                        <p className="text-gray-500">Impossibile caricare le statistiche Stripe.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Stripe Configuration Card */}
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-green-500" />
                      Stripe Connect Configuration
                    </CardTitle>
                    <CardDescription>
                      Configura Stripe per i pagamenti della piattaforma e Stripe Connect per i consulenti
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                      <div className={`p-2 rounded-lg ${stripeConfigData?.configured ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                        {stripeConfigData?.configured ? (
                          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {stripeConfigData?.configured ? "Configurato" : "Non Configurato"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {stripeConfigData?.configured
                            ? `Publishable Key: ${stripeConfigData.config?.stripePublishableKey?.substring(0, 20)}...`
                            : "Inserisci le credenziali Stripe per abilitare i pagamenti"}
                        </p>
                      </div>
                      {stripeConfigData?.configured && (
                        <Badge variant={stripeFormData.enabled ? "default" : "secondary"}>
                          {stripeFormData.enabled ? "Abilitato" : "Disabilitato"}
                        </Badge>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="stripe-secret-key">Stripe Secret Key *</Label>
                        <div className="relative">
                          <Input
                            id="stripe-secret-key"
                            type={showStripeSecretKey ? "text" : "password"}
                            placeholder="sk_live_..."
                            value={stripeFormData.stripeSecretKey}
                            onChange={(e) => setStripeFormData(prev => ({ ...prev, stripeSecretKey: e.target.value }))}
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full"
                            onClick={() => setShowStripeSecretKey(!showStripeSecretKey)}
                          >
                            {showStripeSecretKey ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        {stripeConfigData?.config?.hasSecretKey && (
                          <p className="text-xs text-green-600">Secret Key già configurata (lascia vuoto per mantenere)</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stripe-publishable-key">Stripe Publishable Key *</Label>
                        <Input
                          id="stripe-publishable-key"
                          placeholder="pk_live_..."
                          value={stripeFormData.stripePublishableKey}
                          onChange={(e) => setStripeFormData(prev => ({ ...prev, stripePublishableKey: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stripe-webhook-secret">Stripe Webhook Secret</Label>
                      <div className="relative">
                        <Input
                          id="stripe-webhook-secret"
                          type={showStripeWebhookSecret ? "text" : "password"}
                          placeholder="whsec_..."
                          value={stripeFormData.stripeWebhookSecret}
                          onChange={(e) => setStripeFormData(prev => ({ ...prev, stripeWebhookSecret: e.target.value }))}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setShowStripeWebhookSecret(!showStripeWebhookSecret)}
                        >
                          {showStripeWebhookSecret ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      {stripeConfigData?.config?.hasWebhookSecret && (
                        <p className="text-xs text-green-600">Webhook Secret già configurato (lascia vuoto per mantenere)</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                      <div>
                        <Label className="text-base font-medium">Abilita Stripe Connect</Label>
                        <p className="text-sm text-gray-500">
                          Permetti ai consulenti di ricevere pagamenti diretti tramite Stripe Connect
                        </p>
                      </div>
                      <Switch
                        checked={stripeFormData.stripeConnectEnabled}
                        onCheckedChange={(checked) => setStripeFormData(prev => ({ ...prev, stripeConnectEnabled: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border">
                      <div>
                        <Label className="text-base font-medium">Abilitato</Label>
                        <p className="text-sm text-gray-500">
                          Attiva/Disattiva la configurazione Stripe per la piattaforma
                        </p>
                      </div>
                      <Switch
                        checked={stripeFormData.enabled}
                        onCheckedChange={(checked) => setStripeFormData(prev => ({ ...prev, enabled: checked }))}
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                        <strong>Webhook URL:</strong> Configura questo URL nella dashboard Stripe per ricevere gli eventi webhook.
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-white dark:bg-gray-900 px-3 py-2 rounded border border-blue-200 dark:border-blue-700 text-sm break-all">
                          {baseUrl}/api/stripe/webhook
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(`${baseUrl}/api/stripe/webhook`, 'stripeWebhook')}
                          className="shrink-0"
                        >
                          {copiedUri === 'stripeWebhook' ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <Button
                      onClick={handleSaveStripeConfig}
                      disabled={isSavingStripe || (!stripeConfigData?.config && (!stripeFormData.stripeSecretKey || !stripeFormData.stripePublishableKey))}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-500"
                    >
                      {isSavingStripe ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvataggio...</>
                      ) : (
                        <><Save className="w-4 h-4 mr-2" /> Salva Configurazione</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="licenze">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Gestione Licenze Consulenti */}
                <Card className="border-0 shadow-lg lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-amber-500" />
                      Gestione Licenze Consulenti
                    </CardTitle>
                    <CardDescription>
                      Gestisci le licenze L2/L3 e la percentuale di revenue share per ogni consulente
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                {isLoadingConsultantLicenses ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-500">Caricamento licenze...</p>
                  </div>
                ) : consultantLicensesList.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nessun consulente</h3>
                    <p className="text-gray-500">Non ci sono consulenti registrati nella piattaforma.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-center">Licenze L2</TableHead>
                          <TableHead className="text-center">Licenze L3</TableHead>
                          <TableHead className="text-center">Licenze Dipendenti</TableHead>
                          <TableHead className="text-center">Revenue Share %</TableHead>
                          <TableHead className="text-center">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {consultantLicensesList.map((consultant) => (
                          <TableRow key={consultant.id}>
                            <TableCell className="font-medium">
                              {consultant.firstName} {consultant.lastName}
                            </TableCell>
                            <TableCell className="text-gray-500">{consultant.email}</TableCell>
                            <TableCell className="text-center">
                              <span className={consultant.level2Used >= consultant.level2Total ? "text-red-500 font-semibold" : ""}>
                                {consultant.level2Used}/{consultant.level2Total}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={consultant.level3Used >= consultant.level3Total ? "text-red-500 font-semibold" : ""}>
                                {consultant.level3Used}/{consultant.level3Total}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={consultant.employeeUsed >= consultant.employeeTotal ? "text-red-500 font-semibold" : ""}>
                                {consultant.employeeUsed}/{consultant.employeeTotal}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                {consultant.revenueSharePercentage}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditLicense(consultant)}
                              >
                                <Pencil className="w-4 h-4 mr-1" />
                                Modifica
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Edit License Dialog */}
            <Dialog open={!!editingLicense} onOpenChange={(open) => !open && setEditingLicense(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Modifica Licenze e Revenue Share</DialogTitle>
                  <DialogDescription>
                    {editingLicense && `${editingLicense.firstName} ${editingLicense.lastName} - ${editingLicense.email}`}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="level2Total">Licenze L2 Totali</Label>
                    <Input
                      id="level2Total"
                      type="number"
                      min={0}
                      value={licenseFormData.level2Total}
                      onChange={(e) => setLicenseFormData(prev => ({ ...prev, level2Total: parseInt(e.target.value) || 0 }))}
                    />
                    {editingLicense && (
                      <p className="text-xs text-gray-500">
                        Attualmente in uso: {editingLicense.level2Used}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="level3Total">Licenze L3 Totali</Label>
                    <Input
                      id="level3Total"
                      type="number"
                      min={0}
                      value={licenseFormData.level3Total}
                      onChange={(e) => setLicenseFormData(prev => ({ ...prev, level3Total: parseInt(e.target.value) || 0 }))}
                    />
                    {editingLicense && (
                      <p className="text-xs text-gray-500">
                        Attualmente in uso: {editingLicense.level3Used}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="employeeTotal">Licenze Dipendenti Totali</Label>
                    <Input
                      id="employeeTotal"
                      type="number"
                      min={0}
                      value={licenseFormData.employeeTotal}
                      onChange={(e) => setLicenseFormData(prev => ({ ...prev, employeeTotal: parseInt(e.target.value) || 0 }))}
                    />
                    {editingLicense && (
                      <p className="text-xs text-gray-500">
                        Attualmente in uso: {editingLicense.employeeUsed}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="revenueSharePercentage">Revenue Share (%)</Label>
                    <Input
                      id="revenueSharePercentage"
                      type="number"
                      min={0}
                      max={100}
                      value={licenseFormData.revenueSharePercentage}
                      onChange={(e) => setLicenseFormData(prev => ({ ...prev, revenueSharePercentage: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) }))}
                    />
                    <p className="text-xs text-gray-500">
                      Percentuale che va al consulente sui pagamenti dei clienti
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingLicense(null)}>
                    Annulla
                  </Button>
                  <Button
                    onClick={handleSaveLicense}
                    disabled={updateLicenseMutation.isPending}
                    className="bg-gradient-to-r from-amber-500 to-orange-500"
                  >
                    {updateLicenseMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvataggio...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> Salva</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
              </div>
            </TabsContent>

            <TabsContent value="audit">
              <div className="grid lg:grid-cols-2 gap-6">
                <Card className="border-0 shadow-lg lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="w-5 h-5 text-purple-500" />
                      Audit Log
                    </CardTitle>
                    <CardDescription>
                      Registro delle modifiche recenti al sistema
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                {auditLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-gray-500">Caricamento log...</p>
                  </div>
                ) : auditLog.length === 0 ? (
                  <div className="p-8 text-center">
                    <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Nessuna attività</h3>
                    <p className="text-gray-500">Il registro delle attività è vuoto.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {auditLog.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                      >
                        <div className="p-2 rounded-lg bg-white dark:bg-gray-700 shadow-sm shrink-0">
                          <Shield className="w-4 h-4 text-purple-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={getActionBadgeColor(entry.action)}>
                              {getActionLabel(entry.action)}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Target: {entry.targetType} ({entry.targetId?.substring(0, 8)}...)
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(entry.createdAt), "d MMM yyyy, HH:mm", { locale: it })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
