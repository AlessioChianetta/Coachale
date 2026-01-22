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
  Bot,
  ClipboardList,
  Building2,
  Briefcase,
  GraduationCap,
  User,
  UserPlus,
  Copy,
  Check,
  CopyPlus,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";

interface QualificationFieldConfig {
  enabled: boolean;
  required: boolean;
}

interface QualificationFieldsConfig {
  role: QualificationFieldConfig;
  motivation: QualificationFieldConfig;
  biggestProblem: QualificationFieldConfig;
  goal12Months: QualificationFieldConfig;
  currentBlocker: QualificationFieldConfig;
  companyType: QualificationFieldConfig;
  sector: QualificationFieldConfig;
  employeeCount: QualificationFieldConfig;
  annualRevenue: QualificationFieldConfig;
  currentCompany: QualificationFieldConfig;
  currentPosition: QualificationFieldConfig;
  yearsExperience: QualificationFieldConfig;
  fieldOfStudy: QualificationFieldConfig;
  university: QualificationFieldConfig;
}

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
  aiAssistantIframeUrl: string | null;
  qualificationFieldsConfig: QualificationFieldsConfig;
}

const defaultQualificationFieldsConfig: QualificationFieldsConfig = {
  role: { enabled: false, required: false },
  motivation: { enabled: false, required: false },
  biggestProblem: { enabled: false, required: false },
  goal12Months: { enabled: false, required: false },
  currentBlocker: { enabled: false, required: false },
  companyType: { enabled: false, required: false },
  sector: { enabled: false, required: false },
  employeeCount: { enabled: false, required: false },
  annualRevenue: { enabled: false, required: false },
  currentCompany: { enabled: false, required: false },
  currentPosition: { enabled: false, required: false },
  yearsExperience: { enabled: false, required: false },
  fieldOfStudy: { enabled: false, required: false },
  university: { enabled: false, required: false },
};

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
  aiAssistantIframeUrl: null,
  qualificationFieldsConfig: defaultQualificationFieldsConfig,
};

const qualificationFieldLabels: Record<keyof QualificationFieldsConfig, { label: string; group: string }> = {
  role: { label: "Il tuo ruolo", group: "common" },
  motivation: { label: "Cosa ti ha spinto a contattarci?", group: "common" },
  biggestProblem: { label: "Il problema più grande da risolvere", group: "common" },
  goal12Months: { label: "Dove vuoi arrivare in 12 mesi?", group: "common" },
  currentBlocker: { label: "Cosa ti blocca adesso?", group: "common" },
  companyType: { label: "Tipo di azienda", group: "entrepreneur" },
  sector: { label: "Settore", group: "entrepreneur" },
  employeeCount: { label: "Numero dipendenti", group: "entrepreneur" },
  annualRevenue: { label: "Fatturato annuo", group: "entrepreneur" },
  currentCompany: { label: "Azienda dove lavori", group: "employee" },
  currentPosition: { label: "Mansione attuale", group: "employee" },
  yearsExperience: { label: "Anni di esperienza", group: "freelancer" },
  fieldOfStudy: { label: "Campo di studio", group: "student" },
  university: { label: "Università", group: "student" },
};

const groupLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  common: { label: "Campi Comuni", icon: <User className="h-4 w-4" /> },
  entrepreneur: { label: "Imprenditore", icon: <Building2 className="h-4 w-4" /> },
  employee: { label: "Dipendente", icon: <Briefcase className="h-4 w-4" /> },
  freelancer: { label: "Freelancer", icon: <Briefcase className="h-4 w-4" /> },
  student: { label: "Studente", icon: <GraduationCap className="h-4 w-4" /> },
};

type LandingMode = "referral" | "optin";

interface OptinLandingConfig {
  headline: string;
  description: string;
  ctaButtonText: string;
  primaryColor: string;
  showAiChat: boolean;
  isActive: boolean;
  welcomeMessage: string;
  preferredChannel: "email" | "whatsapp" | "call" | "all";
  agentConfigId: string | null;
  defaultCampaignId: string | null;
  aiAssistantIframeUrl: string | null;
  qualificationFieldsConfig: QualificationFieldsConfig;
}

const defaultOptinFormData: OptinLandingConfig = {
  headline: "Contattami per una consulenza",
  description: "Compila il form per richiedere informazioni o prenotare una consulenza.",
  ctaButtonText: "Contattami",
  primaryColor: "#6366f1",
  showAiChat: true,
  isActive: true,
  welcomeMessage: "Ciao! Come posso aiutarti oggi?",
  preferredChannel: "all",
  agentConfigId: null,
  defaultCampaignId: null,
  aiAssistantIframeUrl: null,
  qualificationFieldsConfig: defaultQualificationFieldsConfig,
};

export default function ConsultantReferralSettingsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("landing");
  const [mode, setMode] = useState<LandingMode>("referral");
  const [linkCopied, setLinkCopied] = useState(false);

  const [formData, setFormData] = useState<ReferralLandingConfig>(defaultFormData);
  const [optinFormData, setOptinFormData] = useState<OptinLandingConfig>(defaultOptinFormData);

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
    queryKey: ["/api/whatsapp/config/proactive"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/config/proactive", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { configs: [] };
      return response.json();
    },
  });

  const { data: campaignsData } = useQuery({
    queryKey: ["/api/campaigns"],
    queryFn: async () => {
      const response = await fetch("/api/campaigns", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { data: [] };
      return response.json();
    },
  });

  const { data: optinConfigData } = useQuery({
    queryKey: ["/api/consultant/optin-landing"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/optin-landing", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Errore nel caricamento della configurazione optin");
      }
      return response.json();
    },
  });

  const { data: userData } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    },
  });

  const agents = agentsData?.configs || [];
  const campaigns = campaignsData?.data || [];
  const consultantId = userData?.user?.id;

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
        aiAssistantIframeUrl: config.aiAssistantIframeUrl || null,
        qualificationFieldsConfig: config.qualificationFieldsConfig 
          ? { ...defaultQualificationFieldsConfig, ...config.qualificationFieldsConfig }
          : defaultQualificationFieldsConfig,
      });
    }
  }, [configData]);

  useEffect(() => {
    if (optinConfigData?.config) {
      const config = optinConfigData.config;
      setOptinFormData({
        headline: config.headline || defaultOptinFormData.headline,
        description: config.description || defaultOptinFormData.description,
        ctaButtonText: config.ctaButtonText || defaultOptinFormData.ctaButtonText,
        primaryColor: config.accentColor || defaultOptinFormData.primaryColor,
        showAiChat: config.showAiChat ?? defaultOptinFormData.showAiChat,
        isActive: config.isActive ?? defaultOptinFormData.isActive,
        welcomeMessage: config.welcomeMessage || defaultOptinFormData.welcomeMessage,
        preferredChannel: config.preferredChannel || defaultOptinFormData.preferredChannel,
        agentConfigId: config.agentConfigId || null,
        defaultCampaignId: config.defaultCampaignId || null,
        aiAssistantIframeUrl: config.aiAssistantIframeUrl || null,
        qualificationFieldsConfig: config.qualificationFieldsConfig 
          ? { ...defaultQualificationFieldsConfig, ...config.qualificationFieldsConfig }
          : defaultQualificationFieldsConfig,
      });
    }
  }, [optinConfigData]);

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
        aiAssistantIframeUrl: data.aiAssistantIframeUrl,
        qualificationFieldsConfig: data.qualificationFieldsConfig,
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

  const saveOptinMutation = useMutation({
    mutationFn: async (data: OptinLandingConfig) => {
      const payload = {
        headline: data.headline,
        description: data.description,
        ctaButtonText: data.ctaButtonText,
        accentColor: data.primaryColor,
        showAiChat: data.showAiChat,
        isActive: data.isActive,
        welcomeMessage: data.welcomeMessage,
        preferredChannel: data.preferredChannel,
        agentConfigId: data.agentConfigId,
        defaultCampaignId: data.defaultCampaignId,
        aiAssistantIframeUrl: data.aiAssistantIframeUrl,
        qualificationFieldsConfig: data.qualificationFieldsConfig,
      };

      const response = await fetch("/api/consultant/optin-landing", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/optin-landing"] });
      toast({
        title: "Impostazioni salvate",
        description: "La configurazione optin è stata aggiornata con successo",
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

  const updateOptinField = <K extends keyof OptinLandingConfig>(field: K, value: OptinLandingConfig[K]) => {
    setOptinFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateQualificationField = (
    fieldKey: keyof QualificationFieldsConfig,
    property: "enabled" | "required",
    value: boolean
  ) => {
    if (mode === "referral") {
      setFormData((prev) => ({
        ...prev,
        qualificationFieldsConfig: {
          ...prev.qualificationFieldsConfig,
          [fieldKey]: {
            ...prev.qualificationFieldsConfig[fieldKey],
            [property]: value,
            ...(property === "enabled" && !value ? { required: false } : {}),
          },
        },
      }));
    } else {
      setOptinFormData((prev) => ({
        ...prev,
        qualificationFieldsConfig: {
          ...prev.qualificationFieldsConfig,
          [fieldKey]: {
            ...prev.qualificationFieldsConfig[fieldKey],
            [property]: value,
            ...(property === "enabled" && !value ? { required: false } : {}),
          },
        },
      }));
    }
  };

  const handleSave = () => {
    if (mode === "referral") {
      saveMutation.mutate(formData);
    } else {
      saveOptinMutation.mutate(optinFormData);
    }
  };

  const getOptinLink = () => {
    if (!consultantId) return "";
    return `${window.location.origin}/optin/${consultantId}`;
  };

  const copyOptinLink = () => {
    const link = getOptinLink();
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    toast({ title: "Link copiato", description: "Il link è stato copiato negli appunti" });
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const duplicateFromOtherMode = () => {
    if (mode === "optin") {
      // Copia da Referral a Optin
      setOptinFormData({
        headline: formData.headline,
        description: formData.description,
        ctaButtonText: formData.ctaButtonText,
        primaryColor: formData.primaryColor,
        showAiChat: formData.showAiChat,
        isActive: formData.isActive,
        welcomeMessage: formData.welcomeMessage,
        preferredChannel: formData.preferredChannel,
        agentConfigId: formData.agentConfigId,
        defaultCampaignId: formData.defaultCampaignId,
        aiAssistantIframeUrl: formData.aiAssistantIframeUrl,
        qualificationFieldsConfig: { ...formData.qualificationFieldsConfig },
      });
      toast({ title: "Impostazioni copiate", description: "Le impostazioni Referral sono state copiate in Optin" });
    } else {
      // Copia da Optin a Referral (mantieni i campi bonus)
      setFormData(prev => ({
        ...prev,
        headline: optinFormData.headline,
        description: optinFormData.description,
        ctaButtonText: optinFormData.ctaButtonText,
        primaryColor: optinFormData.primaryColor,
        showAiChat: optinFormData.showAiChat,
        isActive: optinFormData.isActive,
        welcomeMessage: optinFormData.welcomeMessage,
        preferredChannel: optinFormData.preferredChannel,
        agentConfigId: optinFormData.agentConfigId,
        defaultCampaignId: optinFormData.defaultCampaignId,
        aiAssistantIframeUrl: optinFormData.aiAssistantIframeUrl,
        qualificationFieldsConfig: { ...optinFormData.qualificationFieldsConfig },
      }));
      toast({ title: "Impostazioni copiate", description: "Le impostazioni Optin sono state copiate in Referral" });
    }
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

  const renderQualificationFieldsGroup = (group: string, fields: Array<keyof QualificationFieldsConfig>) => {
    const currentConfig = mode === "referral" ? formData.qualificationFieldsConfig : optinFormData.qualificationFieldsConfig;
    return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700 border-b pb-2">
        {groupLabels[group].icon}
        <span>{groupLabels[group].label}</span>
      </div>
      {fields.map((fieldKey) => {
        const fieldConfig = currentConfig[fieldKey];
        const fieldLabel = qualificationFieldLabels[fieldKey];
        return (
          <div 
            key={fieldKey}
            className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <span className="text-sm text-slate-700">{fieldLabel.label}</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor={`${fieldKey}-enabled`} className="text-xs text-slate-500">
                  Abilitato
                </Label>
                <Switch
                  id={`${fieldKey}-enabled`}
                  checked={fieldConfig.enabled}
                  onCheckedChange={(checked) => updateQualificationField(fieldKey, "enabled", checked)}
                />
              </div>
              {fieldConfig.enabled && (
                <div className="flex items-center gap-2">
                  <Label htmlFor={`${fieldKey}-required`} className="text-xs text-slate-500">
                    Obbligatorio
                  </Label>
                  <Switch
                    id={`${fieldKey}-required`}
                    checked={fieldConfig.required}
                    onCheckedChange={(checked) => updateQualificationField(fieldKey, "required", checked)}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
  };

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
            <div className={`rounded-3xl p-8 text-white shadow-2xl ${mode === "referral" ? "bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600" : "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600"}`}>
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
                    {mode === "referral" ? <Gift className="w-8 h-8 text-white" /> : <UserPlus className="w-8 h-8 text-white" />}
                  </div>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold">
                      {mode === "referral" ? "Impostazioni Referral" : "Impostazioni Optin"}
                    </h1>
                    <p className={`text-lg ${mode === "referral" ? "text-purple-100" : "text-emerald-100"}`}>
                      {mode === "referral" 
                        ? "Configura la landing page e il sistema di bonus" 
                        : "Configura la landing page per contatto diretto"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-xl p-2">
                    <Button
                      variant={mode === "referral" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => { setMode("referral"); setActiveTab("landing"); }}
                      className={mode === "referral" ? "bg-white text-purple-600" : "text-white hover:bg-white/20"}
                    >
                      <Gift className="h-4 w-4 mr-1" />
                      Referral
                    </Button>
                    <Button
                      variant={mode === "optin" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => { setMode("optin"); setActiveTab("landing"); }}
                      className={mode === "optin" ? "bg-white text-teal-600" : "text-white hover:bg-white/20"}
                    >
                      <UserPlus className="h-4 w-4 mr-1" />
                      Optin
                    </Button>
                  </div>
                  <Button
                    onClick={handleSave}
                    disabled={saveMutation.isPending || saveOptinMutation.isPending}
                    className={mode === "referral" ? "bg-white text-purple-600 hover:bg-purple-50" : "bg-white text-teal-600 hover:bg-teal-50"}
                  >
                    {(saveMutation.isPending || saveOptinMutation.isPending) ? (
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
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={duplicateFromOtherMode}
                  className="text-white hover:bg-white/20 border border-white/30"
                >
                  <CopyPlus className="h-4 w-4 mr-2" />
                  Duplica da {mode === "optin" ? "Referral" : "Optin"}
                </Button>
                {mode === "optin" && consultantId && (
                  <div className="flex-1 p-2 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-white/80">Link:</span>
                      <code className="bg-white/20 px-2 py-1 rounded text-xs">{getOptinLink()}</code>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={copyOptinLink}
                      className="text-white hover:bg-white/20"
                    >
                      {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className={`grid w-full h-12 ${mode === "referral" ? "grid-cols-5" : "grid-cols-4"}`}>
                <TabsTrigger value="landing" className="flex items-center gap-2">
                  <Layout className="h-4 w-4" />
                  <span className="hidden sm:inline">Landing</span>
                </TabsTrigger>
                {mode === "referral" && (
                  <TabsTrigger value="bonus" className="flex items-center gap-2">
                    <Gift className="h-4 w-4" />
                    <span className="hidden sm:inline">Bonus</span>
                  </TabsTrigger>
                )}
                <TabsTrigger value="ai-assistant" className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  <span className="hidden sm:inline">AI Assistant</span>
                </TabsTrigger>
                <TabsTrigger value="qualification" className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  <span className="hidden sm:inline">Qualificazione</span>
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Generali</span>
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
                        {mode === "referral" 
                          ? "Personalizza il contenuto della tua landing page referral"
                          : "Personalizza il contenuto della tua landing page contatto"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="headline">
                          Titolo <span className="text-xs text-slate-500">(max 100 caratteri)</span>
                        </Label>
                        <Input
                          id="headline"
                          placeholder={mode === "referral" ? "Inizia il tuo percorso con me" : "Contattami per una consulenza"}
                          value={mode === "referral" ? formData.headline : optinFormData.headline}
                          onChange={(e) => mode === "referral" 
                            ? updateField("headline", e.target.value.slice(0, 100))
                            : updateOptinField("headline", e.target.value.slice(0, 100))
                          }
                          maxLength={100}
                        />
                        <p className="text-xs text-slate-500 text-right">
                          {(mode === "referral" ? formData.headline : optinFormData.headline).length}/100
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">
                          Descrizione <span className="text-xs text-slate-500">(max 500 caratteri)</span>
                        </Label>
                        <Textarea
                          id="description"
                          placeholder="Sono qui per aiutarti a raggiungere i tuoi obiettivi..."
                          value={mode === "referral" ? formData.description : optinFormData.description}
                          onChange={(e) => mode === "referral"
                            ? updateField("description", e.target.value.slice(0, 500))
                            : updateOptinField("description", e.target.value.slice(0, 500))
                          }
                          rows={4}
                          maxLength={500}
                        />
                        <p className="text-xs text-slate-500 text-right">
                          {(mode === "referral" ? formData.description : optinFormData.description).length}/500
                        </p>
                      </div>

                      {mode === "referral" && (
                        <div className="space-y-2">
                          <Label htmlFor="bonusText">Testo Bonus</Label>
                          <Input
                            id="bonusText"
                            placeholder="Una consulenza gratuita"
                            value={formData.bonusText}
                            onChange={(e) => updateField("bonusText", e.target.value)}
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="ctaButtonText">Testo Pulsante CTA</Label>
                        <Input
                          id="ctaButtonText"
                          placeholder={mode === "referral" ? "Richiedi il tuo bonus" : "Contattami"}
                          value={mode === "referral" ? formData.ctaButtonText : optinFormData.ctaButtonText}
                          onChange={(e) => mode === "referral"
                            ? updateField("ctaButtonText", e.target.value)
                            : updateOptinField("ctaButtonText", e.target.value)
                          }
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
                            value={mode === "referral" ? formData.primaryColor : optinFormData.primaryColor}
                            onChange={(e) => mode === "referral"
                              ? updateField("primaryColor", e.target.value)
                              : updateOptinField("primaryColor", e.target.value)
                            }
                            className="w-12 h-10 rounded border cursor-pointer"
                          />
                          <Input
                            value={mode === "referral" ? formData.primaryColor : optinFormData.primaryColor}
                            onChange={(e) => mode === "referral"
                              ? updateField("primaryColor", e.target.value)
                              : updateOptinField("primaryColor", e.target.value)
                            }
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
                          checked={mode === "referral" ? formData.showAiChat : optinFormData.showAiChat}
                          onCheckedChange={(checked) => mode === "referral"
                            ? updateField("showAiChat", checked as boolean)
                            : updateOptinField("showAiChat", checked as boolean)
                          }
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
                      {mode === "referral" ? (
                        <LandingPreview />
                      ) : (
                        <div 
                          className="rounded-2xl border bg-white shadow-lg overflow-hidden"
                          style={{ minHeight: "400px" }}
                        >
                          <div 
                            className="p-6 text-white"
                            style={{ backgroundColor: optinFormData.primaryColor }}
                          >
                            <div className="flex items-center gap-4 mb-4">
                              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                                <UserPlus className="h-8 w-8 text-white" />
                              </div>
                              <div>
                                <h2 className="text-2xl font-bold">{optinFormData.headline || "Il tuo titolo"}</h2>
                              </div>
                            </div>
                          </div>
                          <div className="p-6 space-y-4">
                            <p className="text-slate-600">
                              {optinFormData.description || "La tua descrizione apparirà qui..."}
                            </p>
                            <Button 
                              className="w-full text-white"
                              style={{ backgroundColor: optinFormData.primaryColor }}
                            >
                              {optinFormData.ctaButtonText || "Contattami"}
                            </Button>
                            {optinFormData.showAiChat && (
                              <div className="mt-4 p-4 bg-slate-50 rounded-xl border">
                                <div className="flex items-center gap-2 text-slate-600">
                                  <MessageSquare className="h-5 w-5" />
                                  <span className="text-sm">Chat AI attiva</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
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

              <TabsContent value="ai-assistant" className="space-y-6">
                <Card className="border-0 shadow-lg max-w-2xl mx-auto">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-6 w-6" />
                      AI Assistant
                    </CardTitle>
                    <CardDescription>
                      Configura l'assistente AI per la landing page {mode === "referral" ? "referral" : "optin"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                      <div className="space-y-0.5">
                        <Label htmlFor="showAiChatAssistant" className="font-semibold">Abilita AI Assistant</Label>
                        <p className="text-sm text-muted-foreground">
                          Mostra il pulsante chat flottante sulla landing page
                        </p>
                      </div>
                      <Switch
                        id="showAiChatAssistant"
                        checked={mode === "referral" ? formData.showAiChat : optinFormData.showAiChat}
                        onCheckedChange={(checked) => mode === "referral" 
                          ? updateField("showAiChat", checked)
                          : updateOptinField("showAiChat", checked)
                        }
                      />
                    </div>

                    {(mode === "referral" ? formData.showAiChat : optinFormData.showAiChat) && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="aiAssistantIframeUrl">URL iframe AI Assistant</Label>
                          <Input
                            id="aiAssistantIframeUrl"
                            placeholder="https://esempio.com/chat-widget"
                            value={(mode === "referral" ? formData.aiAssistantIframeUrl : optinFormData.aiAssistantIframeUrl) || ""}
                            onChange={(e) => mode === "referral"
                              ? updateField("aiAssistantIframeUrl", e.target.value || null)
                              : updateOptinField("aiAssistantIframeUrl", e.target.value || null)
                            }
                          />
                          <p className="text-xs text-slate-500">
                            Inserisci l'URL dell'iframe che verrà mostrato quando gli utenti cliccano sul pulsante chat flottante.
                            Lascia vuoto per usare la chat AI integrata.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="welcomeMessageAi" className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Messaggio di Benvenuto AI
                          </Label>
                          <Textarea
                            id="welcomeMessageAi"
                            placeholder="Ciao! Come posso aiutarti oggi?"
                            value={mode === "referral" ? formData.welcomeMessage : optinFormData.welcomeMessage}
                            onChange={(e) => mode === "referral"
                              ? updateField("welcomeMessage", e.target.value)
                              : updateOptinField("welcomeMessage", e.target.value)
                            }
                            rows={4}
                          />
                          <p className="text-xs text-slate-500">
                            Questo messaggio verrà mostrato quando un utente apre la chat AI
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="qualification" className="space-y-6">
                <Card className="border-0 shadow-lg max-w-3xl mx-auto">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-6 w-6" />
                      Campi di Qualificazione
                    </CardTitle>
                    <CardDescription>
                      Configura quali campi mostrare nel form di qualificazione e quali sono obbligatori
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {renderQualificationFieldsGroup("common", ["role", "motivation", "biggestProblem", "goal12Months", "currentBlocker"])}
                    {renderQualificationFieldsGroup("entrepreneur", ["companyType", "sector", "employeeCount", "annualRevenue"])}
                    {renderQualificationFieldsGroup("employee", ["currentCompany", "currentPosition"])}
                    {renderQualificationFieldsGroup("freelancer", ["yearsExperience"])}
                    {renderQualificationFieldsGroup("student", ["fieldOfStudy", "university"])}
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
                      Configura le impostazioni generali del sistema {mode === "referral" ? "referral" : "optin"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
                      <div className="space-y-0.5">
                        <Label htmlFor="isActive" className="font-semibold">
                          {mode === "referral" ? "Sistema Referral Attivo" : "Sistema Optin Attivo"}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Abilita o disabilita il sistema di {mode === "referral" ? "referral" : "contatto diretto"}
                        </p>
                      </div>
                      <Switch
                        id="isActive"
                        checked={mode === "referral" ? formData.isActive : optinFormData.isActive}
                        onCheckedChange={(checked) => mode === "referral"
                          ? updateField("isActive", checked)
                          : updateOptinField("isActive", checked)
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="preferredChannel">Canale Preferito</Label>
                      <Select
                        value={mode === "referral" ? formData.preferredChannel : optinFormData.preferredChannel}
                        onValueChange={(value: any) => mode === "referral"
                          ? updateField("preferredChannel", value)
                          : updateOptinField("preferredChannel", value)
                        }
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
                        value={(mode === "referral" ? formData.agentConfigId : optinFormData.agentConfigId) || "none"}
                        onValueChange={(value) => mode === "referral"
                          ? updateField("agentConfigId", value === "none" ? null : value)
                          : updateOptinField("agentConfigId", value === "none" ? null : value)
                        }
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
                        L'agente WhatsApp che contatterà i lead generati
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="defaultCampaignId">Campagna di Default</Label>
                      <Select
                        value={(mode === "referral" ? formData.defaultCampaignId : optinFormData.defaultCampaignId) || "none"}
                        onValueChange={(value) => mode === "referral"
                          ? updateField("defaultCampaignId", value === "none" ? null : value)
                          : updateOptinField("defaultCampaignId", value === "none" ? null : value)
                        }
                      >
                        <SelectTrigger className="text-slate-900">
                          <SelectValue placeholder="Seleziona la campagna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nessuna campagna</SelectItem>
                          {campaigns.map((campaign: any) => (
                            <SelectItem key={campaign.id} value={campaign.id} className="text-slate-900">
                              {campaign.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">
                        La campagna associata ai lead {mode === "referral" ? "referral" : "optin"} (include obiettivi e desideri)
                      </p>
                    </div>
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
