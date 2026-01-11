import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Image as ImageIcon,
  Plus,
  Download,
  Trash2,
  Sparkles,
  Loader2,
  AlertCircle,
  Wand2,
  Copy,
  RefreshCw,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";

interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl?: string;
  imageData?: string;
  aspectRatio: string;
  style: string;
  status: string;
  createdAt: string;
}

export default function ContentStudioVisuals() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [formData, setFormData] = useState({
    prompt: "",
    aspectRatio: "1:1",
    style: "realistic",
    negativePrompt: "",
    platform: "instagram",
    contentDescription: "",
  });
  const [optimizedPrompt, setOptimizedPrompt] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: imagesResponse, isLoading } = useQuery({
    queryKey: ["/api/content/images"],
    queryFn: async () => {
      const response = await fetch("/api/content/images", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch images");
      return response.json();
    },
  });

  const images: GeneratedImage[] = imagesResponse?.data || [];

  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const response = await fetch(`/api/content/images/${imageId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete image");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Immagine eliminata",
        description: "L'immagine è stata eliminata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/images"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOptimizePrompt = async () => {
    if (!formData.contentDescription) {
      toast({
        title: "Campo obbligatorio",
        description: "Inserisci una descrizione del contenuto",
        variant: "destructive",
      });
      return;
    }

    setIsOptimizing(true);
    try {
      const response = await fetch("/api/content/ai/generate-image-prompt", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentDescription: formData.contentDescription,
          style: formData.style,
          platform: formData.platform,
          aspectRatio: formData.aspectRatio,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to optimize prompt");
      }

      const result = await response.json();
      const generatedPrompt = result.data.prompt;
      setOptimizedPrompt(generatedPrompt);
      setFormData((prev) => ({ ...prev, prompt: generatedPrompt }));

      toast({
        title: "Prompt ottimizzato!",
        description: "Il prompt è stato generato con AI",
      });
    } catch (error: any) {
      toast({
        title: "Errore nell'ottimizzazione",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!formData.prompt) {
      toast({
        title: "Campo obbligatorio",
        description: "Inserisci un prompt per l'immagine",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    toast({
      title: "Generazione in corso...",
      description: "L'immagine potrebbe richiedere 10-30 secondi",
    });

    try {
      const response = await fetch("/api/content/ai/generate-image", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: formData.prompt,
          aspectRatio: formData.aspectRatio,
          style: formData.style,
          negativePrompt: formData.negativePrompt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate image");
      }

      toast({
        title: "Immagine generata!",
        description: "L'immagine è stata creata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/images"] });
      setIsDialogOpen(false);
      setFormData({
        prompt: "",
        aspectRatio: "1:1",
        style: "realistic",
        negativePrompt: "",
        platform: "instagram",
        contentDescription: "",
      });
      setOptimizedPrompt("");
    } catch (error: any) {
      toast({
        title: "Errore nella generazione",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast({
      title: "Prompt copiato",
      description: "Il prompt è stato copiato negli appunti",
    });
  };

  const getStyleLabel = (style: string) => {
    const styles: Record<string, string> = {
      realistic: "Realistico",
      illustration: "Illustrazione",
      minimal: "Minimale",
      bold: "Bold",
      professional: "Professionale",
      playful: "Giocoso",
    };
    return styles[style] || style;
  };

  const getAspectRatioLabel = (ratio: string) => {
    const labels: Record<string, string> = {
      "1:1": "Quadrato",
      "3:4": "Verticale 3:4",
      "4:3": "Orizzontale 4:3",
      "9:16": "Story/Reel",
      "16:9": "Landscape",
    };
    return labels[ratio] || ratio;
  };

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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                  <ImageIcon className="h-8 w-8 text-pink-500" />
                  Generatore Visual
                </h1>
                <p className="text-muted-foreground">
                  Crea immagini uniche con Imagen 3
                </p>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Genera Immagine
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-500" />
                      Genera Nuova Immagine
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Ottimizza prompt con AI</Label>
                      <Textarea
                        placeholder="Descrivi cosa vuoi nell'immagine in modo naturale..."
                        rows={2}
                        value={formData.contentDescription}
                        onChange={(e) =>
                          setFormData({ ...formData, contentDescription: e.target.value })
                        }
                      />
                      <div className="flex gap-2">
                        <Select
                          value={formData.platform}
                          onValueChange={(value) =>
                            setFormData({ ...formData, platform: value })
                          }
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Piattaforma" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="twitter">Twitter</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          onClick={handleOptimizePrompt}
                          disabled={isOptimizing}
                        >
                          {isOptimizing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wand2 className="h-4 w-4" />
                          )}
                          <span className="ml-2">Ottimizza</span>
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="prompt">Prompt</Label>
                      <Textarea
                        id="prompt"
                        placeholder="Descrivi l'immagine che vuoi generare..."
                        rows={4}
                        value={formData.prompt}
                        onChange={(e) =>
                          setFormData({ ...formData, prompt: e.target.value })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Aspetto</Label>
                        <Select
                          value={formData.aspectRatio}
                          onValueChange={(value) =>
                            setFormData({ ...formData, aspectRatio: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1:1">1:1 (Quadrato)</SelectItem>
                            <SelectItem value="3:4">3:4 (Verticale)</SelectItem>
                            <SelectItem value="4:3">4:3 (Orizzontale)</SelectItem>
                            <SelectItem value="9:16">9:16 (Story)</SelectItem>
                            <SelectItem value="16:9">16:9 (Wide)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Stile</Label>
                        <Select
                          value={formData.style}
                          onValueChange={(value) =>
                            setFormData({ ...formData, style: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="realistic">Realistico</SelectItem>
                            <SelectItem value="illustration">Illustrazione</SelectItem>
                            <SelectItem value="minimal">Minimale</SelectItem>
                            <SelectItem value="bold">Bold</SelectItem>
                            <SelectItem value="professional">Professionale</SelectItem>
                            <SelectItem value="playful">Giocoso</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="negativePrompt">Prompt Negativo (opzionale)</Label>
                      <Input
                        id="negativePrompt"
                        placeholder="Cosa NON vuoi nell'immagine..."
                        value={formData.negativePrompt}
                        onChange={(e) =>
                          setFormData({ ...formData, negativePrompt: e.target.value })
                        }
                      />
                    </div>

                    <Button
                      onClick={handleGenerateImage}
                      disabled={isGenerating}
                      className="w-full"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generazione in corso... (10-30 sec)
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Genera Immagine
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-pink-500" />
                Galleria Immagini ({images.length})
              </h2>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <Skeleton className="h-48 w-full rounded-lg mb-4" />
                        <Skeleton className="h-4 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-1/2" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : images.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {images.map((image) => (
                    <Card key={image.id} className="overflow-hidden group">
                      <div className="relative aspect-square">
                        {image.imageUrl || image.imageData ? (
                          <img
                            src={image.imageUrl || `data:image/png;base64,${image.imageData}`}
                            alt={image.prompt}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <ImageIcon className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleCopyPrompt(image.prompt)}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Prompt
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, prompt: image.prompt }));
                              setIsDialogOpen(true);
                            }}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteImageMutation.mutate(image.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Badge className="absolute top-2 left-2 bg-black/50 text-white">
                          {image.aspectRatio}
                        </Badge>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {image.prompt}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="outline" className="text-xs">
                            {getStyleLabel(image.style)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(image.createdAt).toLocaleDateString("it-IT")}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">Nessuna immagine generata</h3>
                    <p className="text-muted-foreground mb-4">
                      Genera la tua prima immagine con AI cliccando "Genera Immagine"
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
