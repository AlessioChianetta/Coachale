import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Alert, AlertDescription } from "@/components/ui/alert";
import debounce from "lodash/debounce";

interface PricingPageData {
  pricingPageSlug: string;
  level2Name: string;
  level2Description: string;
  level2PriceCents: number;
  level3Name: string;
  level3Description: string;
  level3PriceCents: number;
  accentColor: string;
  logoUrl: string;
}

interface FormData {
  pricingPageSlug: string;
  level2Name: string;
  level2Description: string;
  level2PriceEuros: string;
  level3Name: string;
  level3Description: string;
  level3PriceEuros: string;
  accentColor: string;
  logoUrl: string;
}

export default function ConsultantPricingSettingsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<FormData>({
    pricingPageSlug: "",
    level2Name: "",
    level2Description: "",
    level2PriceEuros: "",
    level3Name: "",
    level3Description: "",
    level3PriceEuros: "",
    accentColor: "#6366f1",
    logoUrl: "",
  });

  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [originalSlug, setOriginalSlug] = useState("");

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

  const centsToEuros = (cents: number): string => {
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
      setFormData({
        pricingPageSlug: pricingData.pricingPageSlug || "",
        level2Name: pricingData.level2Name || "",
        level2Description: pricingData.level2Description || "",
        level2PriceEuros: centsToEuros(pricingData.level2PriceCents),
        level3Name: pricingData.level3Name || "",
        level3Description: pricingData.level3Description || "",
        level3PriceEuros: centsToEuros(pricingData.level3PriceCents),
        accentColor: pricingData.accentColor || "#6366f1",
        logoUrl: pricingData.logoUrl || "",
      });
      setOriginalSlug(pricingData.pricingPageSlug || "");
      setSlugAvailable(true);
    }
  }, [pricingData]);

  const checkSlugAvailability = useCallback(
    debounce(async (slug: string) => {
      if (!slug || slug === originalSlug) {
        setSlugAvailable(slug === originalSlug ? true : null);
        setCheckingSlug(false);
        return;
      }

      setCheckingSlug(true);
      try {
        const response = await fetch(`/api/consultant/pricing-page/check-slug?slug=${encodeURIComponent(slug)}`, {
          headers: getAuthHeaders(),
        });
        const data = await response.json();
        setSlugAvailable(data.available);
      } catch (error) {
        setSlugAvailable(null);
      } finally {
        setCheckingSlug(false);
      }
    }, 500),
    [originalSlug]
  );

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        pricingPageSlug: data.pricingPageSlug,
        level2Name: data.level2Name,
        level2Description: data.level2Description,
        level2PriceCents: eurosToCents(data.level2PriceEuros),
        level3Name: data.level3Name,
        level3Description: data.level3Description,
        level3PriceCents: eurosToCents(data.level3PriceEuros),
        accentColor: data.accentColor,
        logoUrl: data.logoUrl,
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
        title: "✅ Impostazioni salvate",
        description: "Le impostazioni della pagina prezzi sono state aggiornate",
      });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Errore",
        description: error.message || "Errore durante il salvataggio delle impostazioni",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (field === "pricingPageSlug") {
      const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
      setFormData((prev) => ({ ...prev, pricingPageSlug: sanitized }));
      checkSlugAvailability(sanitized);
    }
  };

  const handleSave = () => {
    if (formData.pricingPageSlug && slugAvailable === false) {
      toast({
        title: "❌ Slug non disponibile",
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
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                  <Settings className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold">Impostazioni Prezzi</h1>
                  <p className="text-blue-100 text-lg">
                    Configura la tua pagina prezzi pubblica
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
              <Info className="h-5 w-5 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                <strong>Pagina Prezzi Pubblica:</strong> Configura qui le informazioni che verranno
                mostrate nella tua pagina prezzi accessibile ai potenziali clienti.
              </AlertDescription>
            </Alert>

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
                      onChange={(e) => handleInputChange("pricingPageSlug", e.target.value)}
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
                  <Euro className="h-6 w-6" />
                  Livello 2 - Piano Base
                </CardTitle>
                <CardDescription>
                  Configura il piano di livello 2 per i tuoi clienti
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="level2Name" className="text-sm font-semibold">
                    Nome Piano
                  </Label>
                  <Input
                    id="level2Name"
                    type="text"
                    placeholder="Piano Base"
                    value={formData.level2Name}
                    onChange={(e) => handleInputChange("level2Name", e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level2Description" className="text-sm font-semibold">
                    Descrizione
                  </Label>
                  <Textarea
                    id="level2Description"
                    placeholder="Descrivi le caratteristiche del piano..."
                    value={formData.level2Description}
                    onChange={(e) => handleInputChange("level2Description", e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level2PriceEuros" className="text-sm font-semibold">
                    Prezzo (€)
                  </Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="level2PriceEuros"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="29.99"
                      value={formData.level2PriceEuros}
                      onChange={(e) => handleInputChange("level2PriceEuros", e.target.value)}
                      className="h-11 pl-10"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Inserisci il prezzo in euro (es. 29.99)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Euro className="h-6 w-6" />
                  Livello 3 - Piano Premium
                </CardTitle>
                <CardDescription>
                  Configura il piano di livello 3 per i tuoi clienti
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="level3Name" className="text-sm font-semibold">
                    Nome Piano
                  </Label>
                  <Input
                    id="level3Name"
                    type="text"
                    placeholder="Piano Premium"
                    value={formData.level3Name}
                    onChange={(e) => handleInputChange("level3Name", e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level3Description" className="text-sm font-semibold">
                    Descrizione
                  </Label>
                  <Textarea
                    id="level3Description"
                    placeholder="Descrivi le caratteristiche del piano..."
                    value={formData.level3Description}
                    onChange={(e) => handleInputChange("level3Description", e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level3PriceEuros" className="text-sm font-semibold">
                    Prezzo (€)
                  </Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="level3PriceEuros"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="99.99"
                      value={formData.level3PriceEuros}
                      onChange={(e) => handleInputChange("level3PriceEuros", e.target.value)}
                      className="h-11 pl-10"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Inserisci il prezzo in euro (es. 99.99)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-6 w-6" />
                  Personalizzazione
                </CardTitle>
                <CardDescription>
                  Personalizza l'aspetto della tua pagina prezzi
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="accentColor" className="text-sm font-semibold">
                    Colore Accento
                  </Label>
                  <div className="flex gap-3 items-center">
                    <input
                      type="color"
                      id="accentColorPicker"
                      value={formData.accentColor}
                      onChange={(e) => handleInputChange("accentColor", e.target.value)}
                      className="w-12 h-12 rounded-lg border cursor-pointer"
                    />
                    <Input
                      id="accentColor"
                      type="text"
                      placeholder="#6366f1"
                      value={formData.accentColor}
                      onChange={(e) => handleInputChange("accentColor", e.target.value)}
                      className="h-11 font-mono flex-1"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Colore principale per pulsanti e accenti (formato HEX)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logoUrl" className="text-sm font-semibold">
                    URL Logo
                  </Label>
                  <div className="relative">
                    <Image className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      id="logoUrl"
                      type="url"
                      placeholder="https://esempio.com/logo.png"
                      value={formData.logoUrl}
                      onChange={(e) => handleInputChange("logoUrl", e.target.value)}
                      className="h-11 pl-10"
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
              </CardContent>
            </Card>

            <div className="flex gap-3 pt-4 pb-8">
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
                    Salva Impostazioni
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
