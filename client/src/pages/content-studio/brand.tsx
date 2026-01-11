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
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";

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
              <Button onClick={handleSave} disabled={saveBrandMutation.isPending}>
                {saveBrandMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salva
              </Button>
            </div>

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
    </div>
  );
}
