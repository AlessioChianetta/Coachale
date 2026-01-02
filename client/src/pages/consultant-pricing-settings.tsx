import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Save,
  Loader2,
  CheckCircle,
  Info,
  Settings,
  Link,
  Palette,
  Image,
  Euro,
  XCircle,
  ExternalLink,
  Plus,
  Trash2,
  GripVertical,
  Star,
  MessageSquare,
  Award,
  Shield,
  FileText,
  HelpCircle,
  Users,
  Layout,
  CreditCard,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface FAQ {
  question: string;
  answer: string;
}

interface Testimonial {
  name: string;
  role?: string;
  company?: string;
  content: string;
  avatarUrl?: string;
  rating?: number;
}

interface TrustBadge {
  icon: string;
  text: string;
}

interface ComparisonFeature {
  name: string;
  bronze: boolean | string;
  silver: boolean | string;
  gold: boolean | string;
}

interface FormData {
  pricingPageSlug: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBadgeText: string;
  level1Name: string;
  level1Description: string;
  level1DailyMessageLimit: number;
  level1Features: string[];
  level2Name: string;
  level2Description: string;
  level2ShortDescription: string;
  level2MonthlyPriceEuros: string;
  level2YearlyPriceEuros: string;
  level2Features: string[];
  level2Badge: string;
  level2CtaText: string;
  level3Name: string;
  level3Description: string;
  level3ShortDescription: string;
  level3MonthlyPriceEuros: string;
  level3YearlyPriceEuros: string;
  level3Features: string[];
  level3Badge: string;
  level3CtaText: string;
  accentColor: string;
  logoUrl: string;
  backgroundStyle: "gradient" | "solid" | "pattern";
  faqs: FAQ[];
  testimonials: Testimonial[];
  trustBadges: TrustBadge[];
  guaranteeEnabled: boolean;
  guaranteeDays: number;
  guaranteeText: string;
  footerText: string;
  contactEmail: string;
  termsUrl: string;
  privacyUrl: string;
  showComparisonTable: boolean;
  comparisonFeatures: ComparisonFeature[];
  level1EnabledAgents: string[];
  level2EnabledAgents: string[];
}

const defaultFormData: FormData = {
  pricingPageSlug: "",
  heroTitle: "Scegli il piano perfetto per te",
  heroSubtitle: "Accedi al tuo assistente AI personale con il piano più adatto alle tue esigenze",
  heroBadgeText: "",
  level1Name: "Bronze",
  level1Description: "Per iniziare a scoprire il tuo assistente AI",
  level1DailyMessageLimit: 15,
  level1Features: [
    "Messaggi limitati al giorno",
    "Accesso senza registrazione",
    "Risposte AI immediate",
    "Disponibile 24/7"
  ],
  level2Name: "Argento",
  level2Description: "Per chi vuole il massimo dal proprio assistente",
  level2ShortDescription: "Accesso illimitato e personalizzato",
  level2MonthlyPriceEuros: "29.00",
  level2YearlyPriceEuros: "290.00",
  level2Features: [
    "Messaggi illimitati",
    "Tutto del piano Bronze",
    "Accesso alla Knowledge Base",
    "Risposte personalizzate avanzate",
    "Storico conversazioni salvato"
  ],
  level2Badge: "Più Popolare",
  level2CtaText: "Inizia Ora",
  level3Name: "Oro",
  level3Description: "Per professionisti che vogliono tutto",
  level3ShortDescription: "Piattaforma completa con dashboard",
  level3MonthlyPriceEuros: "58.00",
  level3YearlyPriceEuros: "580.00",
  level3Features: [
    "Accesso completo al software",
    "Tutto del piano Argento",
    "Dashboard personale",
    "AI Manager dedicato",
    "Percorsi formativi illimitati",
    "Supporto prioritario"
  ],
  level3Badge: "Premium",
  level3CtaText: "Inizia Ora",
  accentColor: "#6366f1",
  logoUrl: "",
  backgroundStyle: "gradient",
  faqs: [],
  testimonials: [],
  trustBadges: [],
  guaranteeEnabled: false,
  guaranteeDays: 30,
  guaranteeText: "Soddisfatti o rimborsati. Se non sei soddisfatto, ti rimborsiamo entro i primi giorni.",
  footerText: "",
  contactEmail: "",
  termsUrl: "",
  privacyUrl: "",
  showComparisonTable: false,
  comparisonFeatures: [],
  level1EnabledAgents: [],
  level2EnabledAgents: [],
};

export default function ConsultantPricingSettingsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("generale");

  const [formData, setFormData] = useState<FormData>(defaultFormData);

  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [originalSlug, setOriginalSlug] = useState("");
  const slugCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: pricingData, isLoading } = useQuery({
    queryKey: ["/api/consultant/pricing-page"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/pricing-page", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Errore nel caricamento delle impostazioni");
      }
      return response.json();
    },
  });

  const { data: agentsData } = useQuery({
    queryKey: ["/api/whatsapp/config"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/config", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Errore nel caricamento degli agenti");
      }
      const result = await response.json();
      return result.configs || [];
    },
  });

  const level1Agents = (agentsData || []).filter((agent: any) => agent.level === "1");
  const level2Agents = (agentsData || []).filter((agent: any) => agent.level === "2");

  const centsToEuros = (cents: number | undefined): string => {
    if (!cents && cents !== 0) return "";
    return (cents / 100).toFixed(2);
  };

  const eurosToCents = (euros: string): number => {
    const parsed = parseFloat(euros);
    if (isNaN(parsed)) return 0;
    return Math.round(parsed * 100);
  };

  useEffect(() => {
    if (pricingData) {
      const config = pricingData.pricingPageConfig || {};
      setFormData({
        pricingPageSlug: pricingData.pricingPageSlug || "",
        heroTitle: config.heroTitle || defaultFormData.heroTitle,
        heroSubtitle: config.heroSubtitle || defaultFormData.heroSubtitle,
        heroBadgeText: config.heroBadgeText || defaultFormData.heroBadgeText,
        level1Name: config.level1Name || defaultFormData.level1Name,
        level1Description: config.level1Description || defaultFormData.level1Description,
        level1DailyMessageLimit: config.level1DailyMessageLimit || defaultFormData.level1DailyMessageLimit,
        level1Features: config.level1Features?.length > 0 ? config.level1Features : defaultFormData.level1Features,
        level2Name: config.level2Name || defaultFormData.level2Name,
        level2Description: config.level2Description || defaultFormData.level2Description,
        level2ShortDescription: config.level2ShortDescription || defaultFormData.level2ShortDescription,
        level2MonthlyPriceEuros: centsToEuros(config.level2MonthlyPriceCents || config.level2PriceCents) || defaultFormData.level2MonthlyPriceEuros,
        level2YearlyPriceEuros: centsToEuros(config.level2YearlyPriceCents) || defaultFormData.level2YearlyPriceEuros,
        level2Features: config.level2Features?.length > 0 ? config.level2Features : defaultFormData.level2Features,
        level2Badge: config.level2Badge || defaultFormData.level2Badge,
        level2CtaText: config.level2CtaText || defaultFormData.level2CtaText,
        level3Name: config.level3Name || defaultFormData.level3Name,
        level3Description: config.level3Description || defaultFormData.level3Description,
        level3ShortDescription: config.level3ShortDescription || defaultFormData.level3ShortDescription,
        level3MonthlyPriceEuros: centsToEuros(config.level3MonthlyPriceCents || config.level3PriceCents) || defaultFormData.level3MonthlyPriceEuros,
        level3YearlyPriceEuros: centsToEuros(config.level3YearlyPriceCents) || defaultFormData.level3YearlyPriceEuros,
        level3Features: config.level3Features?.length > 0 ? config.level3Features : defaultFormData.level3Features,
        level3Badge: config.level3Badge || defaultFormData.level3Badge,
        level3CtaText: config.level3CtaText || defaultFormData.level3CtaText,
        accentColor: config.accentColor || defaultFormData.accentColor,
        logoUrl: config.logoUrl || defaultFormData.logoUrl,
        backgroundStyle: config.backgroundStyle || defaultFormData.backgroundStyle,
        faqs: config.faqs?.length > 0 ? config.faqs : defaultFormData.faqs,
        testimonials: config.testimonials?.length > 0 ? config.testimonials : defaultFormData.testimonials,
        trustBadges: config.trustBadges?.length > 0 ? config.trustBadges : defaultFormData.trustBadges,
        guaranteeEnabled: config.guaranteeEnabled ?? defaultFormData.guaranteeEnabled,
        guaranteeDays: config.guaranteeDays || defaultFormData.guaranteeDays,
        guaranteeText: config.guaranteeText || defaultFormData.guaranteeText,
        footerText: config.footerText || defaultFormData.footerText,
        contactEmail: config.contactEmail || defaultFormData.contactEmail,
        termsUrl: config.termsUrl || defaultFormData.termsUrl,
        privacyUrl: config.privacyUrl || defaultFormData.privacyUrl,
        showComparisonTable: config.showComparisonTable ?? defaultFormData.showComparisonTable,
        comparisonFeatures: config.comparisonFeatures?.length > 0 ? config.comparisonFeatures : defaultFormData.comparisonFeatures,
        level1EnabledAgents: config.level1EnabledAgents || defaultFormData.level1EnabledAgents,
        level2EnabledAgents: config.level2EnabledAgents || defaultFormData.level2EnabledAgents,
      });
      setOriginalSlug(pricingData.pricingPageSlug || "");
      setSlugAvailable(true);
    }
  }, [pricingData]);

  const checkSlugAvailability = useCallback(
    (slug: string) => {
      if (slugCheckTimeoutRef.current) {
        clearTimeout(slugCheckTimeoutRef.current);
      }

      if (!slug || slug === originalSlug) {
        setSlugAvailable(slug === originalSlug ? true : null);
        setCheckingSlug(false);
        return;
      }

      setCheckingSlug(true);
      slugCheckTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await fetch(`/api/consultant/pricing-page/check-slug/${encodeURIComponent(slug)}`, {
            headers: getAuthHeaders(),
          });
          const data = await response.json();
          setSlugAvailable(data.available);
        } catch (error) {
          setSlugAvailable(null);
        } finally {
          setCheckingSlug(false);
        }
      }, 500);
    },
    [originalSlug]
  );

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        pricingPageSlug: data.pricingPageSlug,
        pricingPageConfig: {
          heroTitle: data.heroTitle,
          heroSubtitle: data.heroSubtitle,
          heroBadgeText: data.heroBadgeText,
          level1Name: data.level1Name,
          level1Description: data.level1Description,
          level1DailyMessageLimit: data.level1DailyMessageLimit,
          level1Features: data.level1Features,
          level2Name: data.level2Name,
          level2Description: data.level2Description,
          level2ShortDescription: data.level2ShortDescription,
          level2MonthlyPriceCents: eurosToCents(data.level2MonthlyPriceEuros),
          level2YearlyPriceCents: eurosToCents(data.level2YearlyPriceEuros),
          level2Features: data.level2Features,
          level2Badge: data.level2Badge,
          level2CtaText: data.level2CtaText,
          level3Name: data.level3Name,
          level3Description: data.level3Description,
          level3ShortDescription: data.level3ShortDescription,
          level3MonthlyPriceCents: eurosToCents(data.level3MonthlyPriceEuros),
          level3YearlyPriceCents: eurosToCents(data.level3YearlyPriceEuros),
          level3Features: data.level3Features,
          level3Badge: data.level3Badge,
          level3CtaText: data.level3CtaText,
          accentColor: data.accentColor,
          logoUrl: data.logoUrl,
          backgroundStyle: data.backgroundStyle,
          faqs: data.faqs,
          testimonials: data.testimonials,
          trustBadges: data.trustBadges,
          guaranteeEnabled: data.guaranteeEnabled,
          guaranteeDays: data.guaranteeDays,
          guaranteeText: data.guaranteeText,
          footerText: data.footerText,
          contactEmail: data.contactEmail,
          termsUrl: data.termsUrl,
          privacyUrl: data.privacyUrl,
          showComparisonTable: data.showComparisonTable,
          comparisonFeatures: data.comparisonFeatures,
          level1EnabledAgents: data.level1EnabledAgents,
          level2EnabledAgents: data.level2EnabledAgents,
        },
      };

      const response = await fetch("/api/consultant/pricing-page", {
        method: "POST",
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
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/pricing-page"] });
      setOriginalSlug(formData.pricingPageSlug);
      toast({
        title: "Impostazioni salvate",
        description: "Le impostazioni della pagina prezzi sono state aggiornate",
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

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (field === "pricingPageSlug") {
      const sanitized = (value as string).toLowerCase().replace(/[^a-z0-9-]/g, "");
      setFormData((prev) => ({ ...prev, pricingPageSlug: sanitized }));
      checkSlugAvailability(sanitized);
    }
  };

  const addArrayItem = <K extends keyof FormData>(field: K, item: FormData[K] extends (infer U)[] ? U : never) => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...(prev[field] as any[]), item],
    }));
  };

  const removeArrayItem = <K extends keyof FormData>(field: K, index: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: (prev[field] as any[]).filter((_, i) => i !== index),
    }));
  };

  const updateArrayItem = <K extends keyof FormData>(
    field: K,
    index: number,
    item: FormData[K] extends (infer U)[] ? U : never
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: (prev[field] as any[]).map((existing, i) => (i === index ? item : existing)),
    }));
  };

  const moveArrayItem = <K extends keyof FormData>(field: K, fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    setFormData((prev) => {
      const arr = [...(prev[field] as any[])];
      if (toIndex < 0 || toIndex >= arr.length) return prev;
      [arr[fromIndex], arr[toIndex]] = [arr[toIndex], arr[fromIndex]];
      return { ...prev, [field]: arr };
    });
  };

  const handleSave = () => {
    if (formData.pricingPageSlug && slugAvailable === false) {
      toast({
        title: "Slug non disponibile",
        description: "Lo slug inserito è già in uso. Scegli un altro identificatore.",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate(formData);
  };

  const getPreviewUrl = () => {
    if (!formData.pricingPageSlug) return null;
    return `${window.location.origin}/c/${formData.pricingPageSlug}/pricing`;
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
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-2xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                    <Settings className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold">Configurazione Prezzi</h1>
                    <p className="text-blue-100 text-lg">
                      Personalizza la tua pagina prezzi pubblica
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending || (formData.pricingPageSlug && slugAvailable === false)}
                  className="bg-white text-indigo-600 hover:bg-blue-50"
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

          <div className="max-w-5xl mx-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 h-12">
                <TabsTrigger value="generale" className="flex items-center gap-2">
                  <Layout className="h-4 w-4" />
                  <span className="hidden sm:inline">Generale</span>
                </TabsTrigger>
                <TabsTrigger value="piani" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="hidden sm:inline">Piani</span>
                </TabsTrigger>
                <TabsTrigger value="contenuti" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Contenuti</span>
                </TabsTrigger>
                <TabsTrigger value="stile" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  <span className="hidden sm:inline">Stile</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="generale" className="space-y-6">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Link className="h-6 w-6" />
                      URL Pagina Prezzi
                    </CardTitle>
                    <CardDescription>
                      Scegli un identificatore unico per la tua pagina prezzi
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pricingPageSlug" className="text-sm font-semibold">
                        Slug URL *
                      </Label>
                      <div className="relative">
                        <Input
                          id="pricingPageSlug"
                          type="text"
                          placeholder="il-mio-studio"
                          value={formData.pricingPageSlug}
                          onChange={(e) => updateField("pricingPageSlug", e.target.value)}
                          className="h-11"
                        />
                        {checkingSlug && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-gray-400" />
                        )}
                        {!checkingSlug && slugAvailable === true && formData.pricingPageSlug && (
                          <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                        )}
                        {!checkingSlug && slugAvailable === false && (
                          <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-red-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Solo lettere minuscole, numeri e trattini. Esempio: studio-rossi
                      </p>
                      {slugAvailable === false && (
                        <p className="text-xs text-red-500">
                          Questo slug è già in uso. Scegli un altro identificatore.
                        </p>
                      )}
                    </div>

                    {getPreviewUrl() && (
                      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          Anteprima URL:
                        </p>
                        <a
                          href={getPreviewUrl()!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-600 hover:underline font-mono text-sm"
                        >
                          {getPreviewUrl()}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layout className="h-6 w-6" />
                      Sezione Hero
                    </CardTitle>
                    <CardDescription>
                      Configura il titolo e sottotitolo della pagina prezzi
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="heroTitle">Titolo Principale</Label>
                      <Input
                        id="heroTitle"
                        placeholder="Scegli il piano perfetto per te"
                        value={formData.heroTitle}
                        onChange={(e) => updateField("heroTitle", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="heroSubtitle">Sottotitolo</Label>
                      <Textarea
                        id="heroSubtitle"
                        placeholder="Descrivi brevemente i benefici dei tuoi piani..."
                        value={formData.heroSubtitle}
                        onChange={(e) => updateField("heroSubtitle", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="heroBadgeText">Badge (opzionale)</Label>
                      <Input
                        id="heroBadgeText"
                        placeholder="es. Offerta Limitata"
                        value={formData.heroBadgeText}
                        onChange={(e) => updateField("heroBadgeText", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-6 w-6" />
                      Garanzia
                    </CardTitle>
                    <CardDescription>
                      Configura una garanzia soddisfatti o rimborsati
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="guaranteeEnabled">Abilita Garanzia</Label>
                      <Switch
                        id="guaranteeEnabled"
                        checked={formData.guaranteeEnabled}
                        onCheckedChange={(checked) => updateField("guaranteeEnabled", checked)}
                      />
                    </div>
                    {formData.guaranteeEnabled && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="guaranteeDays">Giorni di Garanzia</Label>
                          <Input
                            id="guaranteeDays"
                            type="number"
                            min="1"
                            value={formData.guaranteeDays}
                            onChange={(e) => updateField("guaranteeDays", parseInt(e.target.value) || 30)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="guaranteeText">Testo Garanzia</Label>
                          <Textarea
                            id="guaranteeText"
                            placeholder="Garanzia soddisfatti o rimborsati..."
                            value={formData.guaranteeText}
                            onChange={(e) => updateField("guaranteeText", e.target.value)}
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-6 w-6" />
                      Footer
                    </CardTitle>
                    <CardDescription>
                      Informazioni di contatto e link legali
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="footerText">Testo Footer</Label>
                      <Textarea
                        id="footerText"
                        placeholder="© 2025 Il Tuo Studio. Tutti i diritti riservati."
                        value={formData.footerText}
                        onChange={(e) => updateField("footerText", e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="contactEmail">Email di Contatto</Label>
                        <Input
                          id="contactEmail"
                          type="email"
                          placeholder="info@tuostudio.it"
                          value={formData.contactEmail}
                          onChange={(e) => updateField("contactEmail", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="termsUrl">URL Termini e Condizioni</Label>
                        <Input
                          id="termsUrl"
                          type="url"
                          placeholder="https://tuostudio.it/termini"
                          value={formData.termsUrl}
                          onChange={(e) => updateField("termsUrl", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="privacyUrl">URL Privacy Policy</Label>
                      <Input
                        id="privacyUrl"
                        type="url"
                        placeholder="https://tuostudio.it/privacy"
                        value={formData.privacyUrl}
                        onChange={(e) => updateField("privacyUrl", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="piani" className="space-y-6">
                <Card className="border-0 shadow-lg border-l-4 border-l-amber-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-6 w-6 text-amber-600" />
                      Livello 1 - Bronze (Gratuito)
                    </CardTitle>
                    <CardDescription>
                      Piano gratuito con accesso limitato
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="level1Name">Nome Piano</Label>
                        <Input
                          id="level1Name"
                          placeholder="Bronze"
                          value={formData.level1Name}
                          onChange={(e) => updateField("level1Name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="level1DailyMessageLimit">Limite Messaggi Giornalieri</Label>
                        <Input
                          id="level1DailyMessageLimit"
                          type="number"
                          min="1"
                          value={formData.level1DailyMessageLimit}
                          onChange={(e) => updateField("level1DailyMessageLimit", parseInt(e.target.value) || 5)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="level1Description">Descrizione</Label>
                      <Textarea
                        id="level1Description"
                        placeholder="Ideale per chi vuole provare il servizio..."
                        value={formData.level1Description}
                        onChange={(e) => updateField("level1Description", e.target.value)}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Funzionalità Incluse</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addArrayItem("level1Features", "")}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Aggiungi
                        </Button>
                      </div>
                      {formData.level1Features.map((feature, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => moveArrayItem("level1Features", index, "up")}
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => moveArrayItem("level1Features", index, "down")}
                              disabled={index === formData.level1Features.length - 1}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <Input
                            value={feature}
                            onChange={(e) => updateArrayItem("level1Features", index, e.target.value)}
                            placeholder="Funzionalità..."
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeArrayItem("level1Features", index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                      <div>
                        <Label className="text-base font-semibold">Agenti abilitati per Bronze</Label>
                        <p className="text-sm text-gray-500 mt-1">
                          Seleziona quali agenti sono disponibili per gli utenti Bronze. Se non selezioni nessuno, tutti gli agenti di livello 1 saranno disponibili.
                        </p>
                      </div>
                      {level1Agents.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">
                          Nessun agente di livello 1 configurato.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {level1Agents.map((agent: any) => (
                            <div key={agent.id} className="flex items-center space-x-3">
                              <Checkbox
                                id={`level1-agent-${agent.id}`}
                                checked={formData.level1EnabledAgents.includes(agent.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    updateField("level1EnabledAgents", [...formData.level1EnabledAgents, agent.id]);
                                  } else {
                                    updateField("level1EnabledAgents", formData.level1EnabledAgents.filter((id) => id !== agent.id));
                                  }
                                }}
                              />
                              <Label htmlFor={`level1-agent-${agent.id}`} className="cursor-pointer">
                                {agent.agentName || agent.name || "Agente senza nome"}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg border-l-4 border-l-slate-400">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-6 w-6 text-slate-500" />
                      Livello 2 - Silver
                    </CardTitle>
                    <CardDescription>
                      Piano intermedio a pagamento
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="level2Name">Nome Piano</Label>
                        <Input
                          id="level2Name"
                          placeholder="Silver"
                          value={formData.level2Name}
                          onChange={(e) => updateField("level2Name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="level2Badge">Badge (opzionale)</Label>
                        <Input
                          id="level2Badge"
                          placeholder="es. Consigliato"
                          value={formData.level2Badge}
                          onChange={(e) => updateField("level2Badge", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="level2ShortDescription">Descrizione Breve</Label>
                      <Input
                        id="level2ShortDescription"
                        placeholder="Per professionisti in crescita"
                        value={formData.level2ShortDescription}
                        onChange={(e) => updateField("level2ShortDescription", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="level2Description">Descrizione Completa</Label>
                      <Textarea
                        id="level2Description"
                        placeholder="Descrivi in dettaglio cosa include questo piano..."
                        value={formData.level2Description}
                        onChange={(e) => updateField("level2Description", e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="level2MonthlyPriceEuros">Prezzo Mensile (€)</Label>
                        <div className="relative">
                          <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <Input
                            id="level2MonthlyPriceEuros"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="29.99"
                            value={formData.level2MonthlyPriceEuros}
                            onChange={(e) => updateField("level2MonthlyPriceEuros", e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="level2YearlyPriceEuros">Prezzo Annuale (€)</Label>
                        <div className="relative">
                          <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <Input
                            id="level2YearlyPriceEuros"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="299.99"
                            value={formData.level2YearlyPriceEuros}
                            onChange={(e) => updateField("level2YearlyPriceEuros", e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="level2CtaText">Testo Pulsante CTA</Label>
                      <Input
                        id="level2CtaText"
                        placeholder="Inizia Ora"
                        value={formData.level2CtaText}
                        onChange={(e) => updateField("level2CtaText", e.target.value)}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Funzionalità Incluse</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addArrayItem("level2Features", "")}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Aggiungi
                        </Button>
                      </div>
                      {formData.level2Features.map((feature, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => moveArrayItem("level2Features", index, "up")}
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => moveArrayItem("level2Features", index, "down")}
                              disabled={index === formData.level2Features.length - 1}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <Input
                            value={feature}
                            onChange={(e) => updateArrayItem("level2Features", index, e.target.value)}
                            placeholder="Funzionalità..."
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeArrayItem("level2Features", index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3 pt-4 border-t">
                      <div>
                        <Label className="text-base font-semibold">Agenti abilitati per Argento</Label>
                        <p className="text-sm text-gray-500 mt-1">
                          Seleziona quali agenti sono disponibili per gli utenti Argento. Se non selezioni nessuno, tutti gli agenti di livello 2 saranno disponibili.
                        </p>
                      </div>
                      {level2Agents.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">
                          Nessun agente di livello 2 configurato.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {level2Agents.map((agent: any) => (
                            <div key={agent.id} className="flex items-center space-x-3">
                              <Checkbox
                                id={`level2-agent-${agent.id}`}
                                checked={formData.level2EnabledAgents.includes(agent.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    updateField("level2EnabledAgents", [...formData.level2EnabledAgents, agent.id]);
                                  } else {
                                    updateField("level2EnabledAgents", formData.level2EnabledAgents.filter((id) => id !== agent.id));
                                  }
                                }}
                              />
                              <Label htmlFor={`level2-agent-${agent.id}`} className="cursor-pointer">
                                {agent.agentName || agent.name || "Agente senza nome"}
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg border-l-4 border-l-yellow-500">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-6 w-6 text-yellow-600" />
                      Livello 3 - Gold
                    </CardTitle>
                    <CardDescription>
                      Piano premium con tutte le funzionalità
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="level3Name">Nome Piano</Label>
                        <Input
                          id="level3Name"
                          placeholder="Gold"
                          value={formData.level3Name}
                          onChange={(e) => updateField("level3Name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="level3Badge">Badge</Label>
                        <Input
                          id="level3Badge"
                          placeholder="Più Popolare"
                          value={formData.level3Badge}
                          onChange={(e) => updateField("level3Badge", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="level3ShortDescription">Descrizione Breve</Label>
                      <Input
                        id="level3ShortDescription"
                        placeholder="Per chi vuole il massimo"
                        value={formData.level3ShortDescription}
                        onChange={(e) => updateField("level3ShortDescription", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="level3Description">Descrizione Completa</Label>
                      <Textarea
                        id="level3Description"
                        placeholder="Descrivi in dettaglio cosa include questo piano..."
                        value={formData.level3Description}
                        onChange={(e) => updateField("level3Description", e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="level3MonthlyPriceEuros">Prezzo Mensile (€)</Label>
                        <div className="relative">
                          <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <Input
                            id="level3MonthlyPriceEuros"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="99.99"
                            value={formData.level3MonthlyPriceEuros}
                            onChange={(e) => updateField("level3MonthlyPriceEuros", e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="level3YearlyPriceEuros">Prezzo Annuale (€)</Label>
                        <div className="relative">
                          <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <Input
                            id="level3YearlyPriceEuros"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="999.99"
                            value={formData.level3YearlyPriceEuros}
                            onChange={(e) => updateField("level3YearlyPriceEuros", e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="level3CtaText">Testo Pulsante CTA</Label>
                      <Input
                        id="level3CtaText"
                        placeholder="Inizia Ora"
                        value={formData.level3CtaText}
                        onChange={(e) => updateField("level3CtaText", e.target.value)}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Funzionalità Incluse</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addArrayItem("level3Features", "")}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Aggiungi
                        </Button>
                      </div>
                      {formData.level3Features.map((feature, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => moveArrayItem("level3Features", index, "up")}
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => moveArrayItem("level3Features", index, "down")}
                              disabled={index === formData.level3Features.length - 1}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <Input
                            value={feature}
                            onChange={(e) => updateArrayItem("level3Features", index, e.target.value)}
                            placeholder="Funzionalità..."
                            className="flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeArrayItem("level3Features", index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layout className="h-6 w-6" />
                      Tabella Comparativa
                    </CardTitle>
                    <CardDescription>
                      Mostra una tabella di confronto tra i piani
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="showComparisonTable">Mostra Tabella Comparativa</Label>
                      <Switch
                        id="showComparisonTable"
                        checked={formData.showComparisonTable}
                        onCheckedChange={(checked) => updateField("showComparisonTable", checked)}
                      />
                    </div>
                    {formData.showComparisonTable && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Funzionalità da Comparare</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addArrayItem("comparisonFeatures", { name: "", bronze: false, silver: false, gold: true })}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Aggiungi Riga
                          </Button>
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                          <div className="grid grid-cols-5 gap-2 p-3 bg-slate-100 font-semibold text-sm">
                            <div>Funzionalità</div>
                            <div className="text-center">Bronze</div>
                            <div className="text-center">Silver</div>
                            <div className="text-center">Gold</div>
                            <div></div>
                          </div>
                          {formData.comparisonFeatures.map((feature, index) => (
                            <div key={index} className="grid grid-cols-5 gap-2 p-3 border-t items-center">
                              <Input
                                value={feature.name}
                                onChange={(e) => updateArrayItem("comparisonFeatures", index, { ...feature, name: e.target.value })}
                                placeholder="Nome funzionalità"
                                className="h-9"
                              />
                              <div className="flex justify-center">
                                <Switch
                                  checked={feature.bronze === true || feature.bronze === "true"}
                                  onCheckedChange={(checked) => updateArrayItem("comparisonFeatures", index, { ...feature, bronze: checked })}
                                />
                              </div>
                              <div className="flex justify-center">
                                <Switch
                                  checked={feature.silver === true || feature.silver === "true"}
                                  onCheckedChange={(checked) => updateArrayItem("comparisonFeatures", index, { ...feature, silver: checked })}
                                />
                              </div>
                              <div className="flex justify-center">
                                <Switch
                                  checked={feature.gold === true || feature.gold === "true"}
                                  onCheckedChange={(checked) => updateArrayItem("comparisonFeatures", index, { ...feature, gold: checked })}
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeArrayItem("comparisonFeatures", index)}
                                className="text-red-500 hover:text-red-700 h-9 w-9"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contenuti" className="space-y-6">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-6 w-6" />
                      FAQ
                    </CardTitle>
                    <CardDescription>
                      Domande frequenti da mostrare nella pagina prezzi
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Domande e Risposte</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addArrayItem("faqs", { question: "", answer: "" })}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Aggiungi FAQ
                      </Button>
                    </div>
                    {formData.faqs.map((faq, index) => (
                      <Card key={index} className="bg-slate-50">
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex flex-col gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveArrayItem("faqs", index, "up")}
                                disabled={index === 0}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveArrayItem("faqs", index, "down")}
                                disabled={index === formData.faqs.length - 1}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex-1 space-y-3">
                              <Input
                                value={faq.question}
                                onChange={(e) => updateArrayItem("faqs", index, { ...faq, question: e.target.value })}
                                placeholder="Domanda..."
                              />
                              <Textarea
                                value={faq.answer}
                                onChange={(e) => updateArrayItem("faqs", index, { ...faq, answer: e.target.value })}
                                placeholder="Risposta..."
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeArrayItem("faqs", index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {formData.faqs.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Nessuna FAQ aggiunta. Clicca "Aggiungi FAQ" per iniziare.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-6 w-6" />
                      Testimonianze
                    </CardTitle>
                    <CardDescription>
                      Recensioni e testimonianze dei clienti
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Testimonianze</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addArrayItem("testimonials", { name: "", role: "", company: "", content: "", avatarUrl: "", rating: 5 })}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Aggiungi Testimonianza
                      </Button>
                    </div>
                    {formData.testimonials.map((testimonial, index) => (
                      <Card key={index} className="bg-slate-50">
                        <CardContent className="pt-4 space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex flex-col gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveArrayItem("testimonials", index, "up")}
                                disabled={index === 0}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveArrayItem("testimonials", index, "down")}
                                disabled={index === formData.testimonials.length - 1}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex-1 space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Input
                                  value={testimonial.name}
                                  onChange={(e) => updateArrayItem("testimonials", index, { ...testimonial, name: e.target.value })}
                                  placeholder="Nome"
                                />
                                <Input
                                  value={testimonial.role || ""}
                                  onChange={(e) => updateArrayItem("testimonials", index, { ...testimonial, role: e.target.value })}
                                  placeholder="Ruolo (opzionale)"
                                />
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <Input
                                  value={testimonial.company || ""}
                                  onChange={(e) => updateArrayItem("testimonials", index, { ...testimonial, company: e.target.value })}
                                  placeholder="Azienda (opzionale)"
                                />
                                <Input
                                  value={testimonial.avatarUrl || ""}
                                  onChange={(e) => updateArrayItem("testimonials", index, { ...testimonial, avatarUrl: e.target.value })}
                                  placeholder="URL Avatar (opzionale)"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Label className="text-sm">Valutazione:</Label>
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      type="button"
                                      onClick={() => updateArrayItem("testimonials", index, { ...testimonial, rating: star })}
                                      className="focus:outline-none"
                                    >
                                      <Star
                                        className={`h-5 w-5 ${(testimonial.rating || 5) >= star ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <Textarea
                                value={testimonial.content}
                                onChange={(e) => updateArrayItem("testimonials", index, { ...testimonial, content: e.target.value })}
                                placeholder="Contenuto della testimonianza..."
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeArrayItem("testimonials", index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {formData.testimonials.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Nessuna testimonianza aggiunta. Clicca "Aggiungi Testimonianza" per iniziare.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-6 w-6" />
                      Badge di Fiducia
                    </CardTitle>
                    <CardDescription>
                      Icone e testi che aumentano la fiducia dei visitatori
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Badge</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addArrayItem("trustBadges", { icon: "shield", text: "" })}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Aggiungi Badge
                      </Button>
                    </div>
                    {formData.trustBadges.map((badge, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveArrayItem("trustBadges", index, "up")}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveArrayItem("trustBadges", index, "down")}
                            disabled={index === formData.trustBadges.length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                        <Select
                          value={badge.icon}
                          onValueChange={(value) => updateArrayItem("trustBadges", index, { ...badge, icon: value })}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Icona" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="shield">Scudo</SelectItem>
                            <SelectItem value="lock">Lucchetto</SelectItem>
                            <SelectItem value="check">Spunta</SelectItem>
                            <SelectItem value="star">Stella</SelectItem>
                            <SelectItem value="award">Premio</SelectItem>
                            <SelectItem value="users">Utenti</SelectItem>
                            <SelectItem value="clock">Orologio</SelectItem>
                            <SelectItem value="heart">Cuore</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={badge.text}
                          onChange={(e) => updateArrayItem("trustBadges", index, { ...badge, text: e.target.value })}
                          placeholder="Testo del badge..."
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeArrayItem("trustBadges", index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {formData.trustBadges.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Nessun badge aggiunto. Clicca "Aggiungi Badge" per iniziare.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="stile" className="space-y-6">
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-6 w-6" />
                      Colori e Stile
                    </CardTitle>
                    <CardDescription>
                      Personalizza l'aspetto della tua pagina prezzi
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="accentColor">Colore Accento</Label>
                      <div className="flex gap-3 items-center">
                        <input
                          type="color"
                          id="accentColorPicker"
                          value={formData.accentColor}
                          onChange={(e) => updateField("accentColor", e.target.value)}
                          className="w-12 h-12 rounded-lg border cursor-pointer"
                        />
                        <Input
                          id="accentColor"
                          type="text"
                          placeholder="#6366f1"
                          value={formData.accentColor}
                          onChange={(e) => updateField("accentColor", e.target.value)}
                          className="font-mono flex-1"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        Colore principale per pulsanti e accenti (formato HEX)
                      </p>
                    </div>

                    {formData.accentColor && (
                      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                          Anteprima Colore:
                        </p>
                        <div className="flex items-center gap-4">
                          <div
                            className="w-16 h-16 rounded-lg shadow-md"
                            style={{ backgroundColor: formData.accentColor }}
                          />
                          <div className="space-y-2">
                            <Button
                              size="sm"
                              style={{ backgroundColor: formData.accentColor }}
                              className="text-white"
                            >
                              Pulsante Esempio
                            </Button>
                            <p className="text-sm font-mono">{formData.accentColor}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="backgroundStyle">Stile Sfondo</Label>
                      <Select
                        value={formData.backgroundStyle}
                        onValueChange={(value: "gradient" | "solid" | "pattern") => updateField("backgroundStyle", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona stile" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gradient">Gradiente</SelectItem>
                          <SelectItem value="solid">Colore Solido</SelectItem>
                          <SelectItem value="pattern">Pattern</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Image className="h-6 w-6" />
                      Logo
                    </CardTitle>
                    <CardDescription>
                      Aggiungi il logo del tuo brand
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="logoUrl">URL Logo</Label>
                      <div className="relative">
                        <Image className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          id="logoUrl"
                          type="url"
                          placeholder="https://esempio.com/logo.png"
                          value={formData.logoUrl}
                          onChange={(e) => updateField("logoUrl", e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <p className="text-xs text-gray-500">
                        URL dell'immagine del tuo logo (consigliato: formato PNG trasparente)
                      </p>
                    </div>

                    {formData.logoUrl && (
                      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                          Anteprima Logo:
                        </p>
                        <div className="flex items-center justify-center p-4 bg-white dark:bg-slate-900 rounded-lg">
                          <img
                            src={formData.logoUrl}
                            alt="Logo preview"
                            className="max-h-24 max-w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex gap-3 pt-6 pb-8">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending || (formData.pricingPageSlug && slugAvailable === false)}
                className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    Salva Tutte le Impostazioni
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ConsultantAIAssistant />
    </div>
  );
}
