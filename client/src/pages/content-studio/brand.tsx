import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Palette,
  Upload,
  X,
  Plus,
  Save,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Youtube,
  Loader2,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  Eye,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";

interface BrandVoiceWizardAnswers {
  chiSei: string;
  cosaFai: string;
  perChi: string;
  comeTiDifferenzi: string;
  tono: string;
  valori: string;
}

interface GeneratedBrandVoice {
  chiSono: string;
  brandVoice: string;
  noteForAi: string;
  keywords: string[];
}

interface BrandAssets {
  id?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  brandVoice?: string;
  keywords?: string[];
  avoidWords?: string[];
  instagramHandle?: string;
  facebookHandle?: string;
  linkedinHandle?: string;
  twitterHandle?: string;
  youtubeHandle?: string;
  logoUrl?: string;
  chiSono?: string;
  noteForAi?: string;
}

export default function ContentStudioBrand() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [brandColors, setBrandColors] = useState({
    primary: "#6366f1",
    secondary: "#ec4899",
    accent: "#f59e0b",
  });

  const [brandVoice, setBrandVoice] = useState("");
  const [chiSono, setChiSono] = useState("");
  const [noteForAi, setNoteForAi] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [avoidWords, setAvoidWords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newAvoidWord, setNewAvoidWord] = useState("");
  const [socialHandles, setSocialHandles] = useState({
    instagram: "",
    facebook: "",
    linkedin: "",
    twitter: "",
    youtube: "",
  });

  // Brand Voice Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardAnswers, setWizardAnswers] = useState<BrandVoiceWizardAnswers>({
    chiSei: "",
    cosaFai: "",
    perChi: "",
    comeTiDifferenzi: "",
    tono: "",
    valori: "",
  });
  const [generatedVoice, setGeneratedVoice] = useState<GeneratedBrandVoice | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const generateBrandVoiceMutation = useMutation({
    mutationFn: async (answers: BrandVoiceWizardAnswers) => {
      const response = await fetch("/api/content/generate-brand-voice", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answers }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate brand voice");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.data) {
        setGeneratedVoice(data.data);
        setShowPreview(true);
        toast({
          title: "Brand Voice generata!",
          description: "Verifica l'anteprima e clicca 'Applica' per usarla",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const wizardQuestions = [
    {
      key: "chiSei" as const,
      title: "Chi sei?",
      description: "Raccontaci chi sei, il tuo ruolo e la tua esperienza",
      placeholder: "Es: Sono Marco Rossi, consulente finanziario con 15 anni di esperienza nel settore bancario. Ho aiutato oltre 500 clienti...",
    },
    {
      key: "cosaFai" as const,
      title: "Cosa fai?",
      description: "Descrivi i tuoi servizi o prodotti principali",
      placeholder: "Es: Offro consulenza personalizzata per la gestione del patrimonio, pianificazione pensionistica e investimenti...",
    },
    {
      key: "perChi" as const,
      title: "Per chi lo fai?",
      description: "Chi è il tuo cliente ideale? Qual è il tuo target audience?",
      placeholder: "Es: Professionisti e imprenditori tra i 35-55 anni che vogliono proteggere e far crescere il loro patrimonio...",
    },
    {
      key: "comeTiDifferenzi" as const,
      title: "Come ti differenzi?",
      description: "Qual è la tua USP? Hai un metodo o approccio unico?",
      placeholder: "Es: Il mio metodo '3 Step Finanza' permette di avere una visione chiara in sole 3 settimane...",
    },
    {
      key: "tono" as const,
      title: "Che tono vuoi usare?",
      description: "Descrivi lo stile comunicativo che preferisci",
      placeholder: "Es: Professionale ma accessibile, autorevole senza essere formale, amichevole ma competente...",
    },
    {
      key: "valori" as const,
      title: "Valori del brand",
      description: "Cosa ti sta a cuore? Quali sono i tuoi valori fondamentali?",
      placeholder: "Es: Trasparenza, fiducia, risultati misurabili, educazione finanziaria, rapporto personale con ogni cliente...",
    },
  ];

  const handleNextStep = () => {
    if (wizardStep < wizardQuestions.length - 1) {
      setWizardStep(wizardStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (wizardStep > 0) {
      setWizardStep(wizardStep - 1);
    }
  };

  const handleGenerateBrandVoice = () => {
    generateBrandVoiceMutation.mutate(wizardAnswers);
  };

  const handleApplyGeneratedVoice = () => {
    if (generatedVoice) {
      setChiSono(generatedVoice.chiSono);
      setBrandVoice(generatedVoice.brandVoice);
      setNoteForAi(generatedVoice.noteForAi);
      setKeywords(generatedVoice.keywords);
      setWizardOpen(false);
      setShowPreview(false);
      setWizardStep(0);
      setWizardAnswers({
        chiSei: "",
        cosaFai: "",
        perChi: "",
        comeTiDifferenzi: "",
        tono: "",
        valori: "",
      });
      setGeneratedVoice(null);
      toast({
        title: "Brand Voice applicata!",
        description: "I campi sono stati compilati. Ricorda di salvare le modifiche.",
      });
    }
  };

  const resetWizard = () => {
    setWizardOpen(false);
    setShowPreview(false);
    setWizardStep(0);
    setWizardAnswers({
      chiSei: "",
      cosaFai: "",
      perChi: "",
      comeTiDifferenzi: "",
      tono: "",
      valori: "",
    });
    setGeneratedVoice(null);
  };

  const { data: brandResponse, isLoading } = useQuery({
    queryKey: ["/api/content/brand-assets"],
    queryFn: async () => {
      const response = await fetch("/api/content/brand-assets", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) {
          return { data: null };
        }
        throw new Error("Failed to fetch brand assets");
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (brandResponse?.data) {
      const data = brandResponse.data;
      setBrandColors({
        primary: data.primaryColor || "#6366f1",
        secondary: data.secondaryColor || "#ec4899",
        accent: data.accentColor || "#f59e0b",
      });
      setBrandVoice(data.brandVoice || "");
      setChiSono(data.chiSono || "");
      setNoteForAi(data.noteForAi || "");
      setKeywords(data.keywords || []);
      setAvoidWords(data.avoidWords || []);
      setSocialHandles({
        instagram: data.instagramHandle || "",
        facebook: data.facebookHandle || "",
        linkedin: data.linkedinHandle || "",
        twitter: data.twitterHandle || "",
        youtube: data.youtubeHandle || "",
      });
    }
  }, [brandResponse]);

  const saveBrandMutation = useMutation({
    mutationFn: async (brandData: BrandAssets) => {
      const response = await fetch("/api/content/brand-assets", {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(brandData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save brand assets");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Brand salvato",
        description: "Le impostazioni del brand sono state salvate con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/brand-assets"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addKeyword = () => {
    if (newKeyword.trim()) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const addAvoidWord = () => {
    if (newAvoidWord.trim()) {
      setAvoidWords([...avoidWords, newAvoidWord.trim()]);
      setNewAvoidWord("");
    }
  };

  const removeAvoidWord = (index: number) => {
    setAvoidWords(avoidWords.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    saveBrandMutation.mutate({
      primaryColor: brandColors.primary,
      secondaryColor: brandColors.secondary,
      accentColor: brandColors.accent,
      brandVoice,
      chiSono,
      noteForAi,
      keywords,
      avoidWords,
      instagramHandle: socialHandles.instagram,
      facebookHandle: socialHandles.facebook,
      linkedinHandle: socialHandles.linkedin,
      twitterHandle: socialHandles.twitter,
      youtubeHandle: socialHandles.youtube,
    });
  };

  if (isLoading) {
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
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
              <Skeleton className="h-12 w-64" />
              <Card>
                <CardContent className="p-6 space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                  <Palette className="h-8 w-8 text-indigo-500" />
                  Brand Identity
                </h1>
                <p className="text-muted-foreground">
                  Configura l'identità visiva e verbale del tuo brand
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setWizardOpen(true)}
                  className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-300 dark:border-violet-700 hover:from-violet-500/20 hover:to-purple-500/20"
                >
                  <Sparkles className="h-4 w-4 mr-2 text-violet-500" />
                  Genera con AI
                </Button>
                <Button onClick={handleSave} disabled={saveBrandMutation.isPending}>
                  {saveBrandMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salva
                </Button>
              </div>
            </div>

            <Card className="border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600 dark:text-indigo-400"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  Chi Sono
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Descrivi chi sei, cosa fai e per chi lo fai. L'AI userà queste informazioni per creare contenuti più personalizzati.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="chiSono">La tua storia professionale</Label>
                  <Textarea
                    id="chiSono"
                    rows={5}
                    value={chiSono}
                    onChange={(e) => setChiSono(e.target.value)}
                    placeholder="Es: Sono Marco Rossi, consulente finanziario con 15 anni di esperienza. Aiuto imprenditori e liberi professionisti a gestire le proprie finanze personali e aziendali. Il mio approccio si basa su strategie pratiche e risultati misurabili..."
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  </div>
                  Note per l'AI
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Istruzioni personalizzate per l'intelligenza artificiale. Scrivi qui qualsiasi indicazione specifica su come vuoi che vengano creati i tuoi contenuti.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="noteForAi">Istruzioni libere</Label>
                  <Textarea
                    id="noteForAi"
                    rows={5}
                    value={noteForAi}
                    onChange={(e) => setNoteForAi(e.target.value)}
                    placeholder="Es:
- Non usare mai emoji nei post
- Tono professionale ma accessibile
- Evita termini troppo tecnici
- Usa sempre esempi pratici italiani
- Menziona sempre il mio metodo '3 Step Finanza'
- Includi sempre una domanda nel hook"
                    className="resize-none font-mono text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Colori del Brand</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primary">Colore Primario</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primary"
                        type="color"
                        value={brandColors.primary}
                        onChange={(e) =>
                          setBrandColors({ ...brandColors, primary: e.target.value })
                        }
                        className="w-16 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={brandColors.primary}
                        onChange={(e) =>
                          setBrandColors({ ...brandColors, primary: e.target.value })
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondary">Colore Secondario</Label>
                    <div className="flex gap-2">
                      <Input
                        id="secondary"
                        type="color"
                        value={brandColors.secondary}
                        onChange={(e) =>
                          setBrandColors({ ...brandColors, secondary: e.target.value })
                        }
                        className="w-16 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={brandColors.secondary}
                        onChange={(e) =>
                          setBrandColors({ ...brandColors, secondary: e.target.value })
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accent">Colore Accento</Label>
                    <div className="flex gap-2">
                      <Input
                        id="accent"
                        type="color"
                        value={brandColors.accent}
                        onChange={(e) =>
                          setBrandColors({ ...brandColors, accent: e.target.value })
                        }
                        className="w-16 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={brandColors.accent}
                        onChange={(e) =>
                          setBrandColors({ ...brandColors, accent: e.target.value })
                        }
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <div
                    className="w-24 h-24 rounded-lg shadow-md"
                    style={{ backgroundColor: brandColors.primary }}
                  />
                  <div
                    className="w-24 h-24 rounded-lg shadow-md"
                    style={{ backgroundColor: brandColors.secondary }}
                  />
                  <div
                    className="w-24 h-24 rounded-lg shadow-md"
                    style={{ backgroundColor: brandColors.accent }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Logo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    Clicca per caricare il tuo logo
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, SVG o JPG (consigliato: 500x500px)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Voce del Brand</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="brandVoice">Descrizione del Tono di Voce</Label>
                  <Textarea
                    id="brandVoice"
                    rows={4}
                    value={brandVoice}
                    onChange={(e) => setBrandVoice(e.target.value)}
                    placeholder="Descrivi il tono di voce del tuo brand... Es: Professionale ma accessibile. Usiamo un tono amichevole che ispira fiducia."
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Parole Chiave da Usare</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {keywords.map((keyword, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="flex items-center gap-1 px-3 py-1"
                    >
                      {keyword}
                      <button
                        onClick={() => removeKeyword(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {keywords.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nessuna parola chiave aggiunta
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nuova parola chiave..."
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addKeyword()}
                  />
                  <Button variant="outline" onClick={addKeyword}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Parole da Evitare</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {avoidWords.map((word, index) => (
                    <Badge
                      key={index}
                      variant="destructive"
                      className="flex items-center gap-1 px-3 py-1"
                    >
                      {word}
                      <button
                        onClick={() => removeAvoidWord(index)}
                        className="ml-1 hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {avoidWords.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nessuna parola da evitare aggiunta
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Parola da evitare..."
                    value={newAvoidWord}
                    onChange={(e) => setNewAvoidWord(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addAvoidWord()}
                  />
                  <Button variant="outline" onClick={addAvoidWord}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Handle Social</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Instagram className="h-4 w-4 text-pink-500" />
                      Instagram
                    </Label>
                    <Input
                      value={socialHandles.instagram}
                      onChange={(e) =>
                        setSocialHandles({ ...socialHandles, instagram: e.target.value })
                      }
                      placeholder="@tuohandle"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Facebook className="h-4 w-4 text-blue-600" />
                      Facebook
                    </Label>
                    <Input
                      value={socialHandles.facebook}
                      onChange={(e) =>
                        setSocialHandles({ ...socialHandles, facebook: e.target.value })
                      }
                      placeholder="tuapagina"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4 text-blue-700" />
                      LinkedIn
                    </Label>
                    <Input
                      value={socialHandles.linkedin}
                      onChange={(e) =>
                        setSocialHandles({ ...socialHandles, linkedin: e.target.value })
                      }
                      placeholder="tuoprofilo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Twitter className="h-4 w-4 text-sky-500" />
                      Twitter/X
                    </Label>
                    <Input
                      value={socialHandles.twitter}
                      onChange={(e) =>
                        setSocialHandles({ ...socialHandles, twitter: e.target.value })
                      }
                      placeholder="@tuohandle"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="flex items-center gap-2">
                      <Youtube className="h-4 w-4 text-red-600" />
                      YouTube
                    </Label>
                    <Input
                      value={socialHandles.youtube}
                      onChange={(e) =>
                        setSocialHandles({ ...socialHandles, youtube: e.target.value })
                      }
                      placeholder="TuoCanale"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pb-6">
              <Button
                onClick={handleSave}
                size="lg"
                disabled={saveBrandMutation.isPending}
              >
                {saveBrandMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salva Tutte le Impostazioni
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Voice Generator Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={(open) => !open && resetWizard()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-500" />
              {showPreview ? "Anteprima Brand Voice Generata" : "Genera Brand Voice con AI"}
            </DialogTitle>
            <DialogDescription>
              {showPreview 
                ? "Verifica i contenuti generati e clicca 'Applica' per usarli"
                : `Rispondi a ${wizardQuestions.length} semplici domande per generare la tua Brand Voice`
              }
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            {!showPreview ? (
              <div className="space-y-4 py-4">
                {/* Progress indicator */}
                <div className="flex items-center justify-between mb-6">
                  {wizardQuestions.map((_, idx) => (
                    <div key={idx} className="flex items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                          idx < wizardStep
                            ? "bg-violet-500 text-white"
                            : idx === wizardStep
                            ? "bg-violet-500 text-white ring-4 ring-violet-200 dark:ring-violet-800"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {idx < wizardStep ? <Check className="h-4 w-4" /> : idx + 1}
                      </div>
                      {idx < wizardQuestions.length - 1 && (
                        <div
                          className={`h-1 w-8 sm:w-12 mx-1 ${
                            idx < wizardStep ? "bg-violet-500" : "bg-muted"
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Current question */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">
                    {wizardQuestions[wizardStep].title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {wizardQuestions[wizardStep].description}
                  </p>
                  <Textarea
                    rows={5}
                    value={wizardAnswers[wizardQuestions[wizardStep].key]}
                    onChange={(e) =>
                      setWizardAnswers({
                        ...wizardAnswers,
                        [wizardQuestions[wizardStep].key]: e.target.value,
                      })
                    }
                    placeholder={wizardQuestions[wizardStep].placeholder}
                    className="resize-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6 py-4">
                {/* Preview section */}
                {generatedVoice && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-base font-semibold flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Chi Sono
                      </Label>
                      <div className="p-4 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap">
                        {generatedVoice.chiSono}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-base font-semibold flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Tono di Voce
                      </Label>
                      <div className="p-4 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap">
                        {generatedVoice.brandVoice}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-base font-semibold flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Note per l'AI
                      </Label>
                      <div className="p-4 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap font-mono">
                        {generatedVoice.noteForAi}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-base font-semibold flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Parole Chiave Suggerite
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {generatedVoice.keywords.map((kw, idx) => (
                          <Badge key={idx} variant="secondary">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {!showPreview ? (
              <>
                <Button
                  variant="outline"
                  onClick={handlePrevStep}
                  disabled={wizardStep === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Indietro
                </Button>
                
                {wizardStep < wizardQuestions.length - 1 ? (
                  <Button onClick={handleNextStep}>
                    Avanti
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleGenerateBrandVoice}
                    disabled={generateBrandVoiceMutation.isPending}
                    className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
                  >
                    {generateBrandVoiceMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generazione in corso...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Genera Brand Voice
                      </>
                    )}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Modifica Risposte
                </Button>
                <Button
                  onClick={handleApplyGeneratedVoice}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Applica Brand Voice
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
