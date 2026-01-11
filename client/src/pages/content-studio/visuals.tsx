import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Image as ImageIcon,
  Sparkles,
  Download,
  Trash2,
  Square,
  RectangleVertical,
  RectangleHorizontal,
  Smartphone,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

interface GeneratedImage {
  id: string;
  prompt: string;
  style: string;
  aspectRatio: string;
  url: string;
  createdAt: string;
}

export default function ContentStudioVisuals() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");

  const demoImages: GeneratedImage[] = [
    {
      id: "1",
      prompt: "[DEMO] Persona che fa yoga al tramonto sulla spiaggia",
      style: "Fotorealistico",
      aspectRatio: "16:9",
      url: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400",
      createdAt: "2025-01-10",
    },
    {
      id: "2",
      prompt: "[DEMO] Cibo sano e colorato su sfondo bianco",
      style: "Minimal",
      aspectRatio: "1:1",
      url: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400",
      createdAt: "2025-01-09",
    },
    {
      id: "3",
      prompt: "[DEMO] Atleta che corre in città all'alba",
      style: "Fotorealistico",
      aspectRatio: "4:5",
      url: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=400",
      createdAt: "2025-01-08",
    },
    {
      id: "4",
      prompt: "[DEMO] Grafica motivazionale con citazione",
      style: "Illustrazione",
      aspectRatio: "9:16",
      url: "https://images.unsplash.com/photo-1494178270175-e96de2971df9?w=400",
      createdAt: "2025-01-07",
    },
    {
      id: "5",
      prompt: "[DEMO] Icone 3D di fitness e benessere",
      style: "3D",
      aspectRatio: "1:1",
      url: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400",
      createdAt: "2025-01-06",
    },
    {
      id: "6",
      prompt: "[DEMO] Workspace moderno per coaching online",
      style: "Minimal",
      aspectRatio: "16:9",
      url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=400",
      createdAt: "2025-01-05",
    },
  ];

  const aspectRatios = [
    { value: "1:1", label: "1:1", icon: Square, description: "Feed" },
    { value: "4:5", label: "4:5", icon: RectangleVertical, description: "Portrait" },
    { value: "9:16", label: "9:16", icon: Smartphone, description: "Stories" },
    { value: "16:9", label: "16:9", icon: RectangleHorizontal, description: "Video" },
  ];

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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                  <ImageIcon className="h-8 w-8 text-pink-500" />
                  Generatore Visual
                </h1>
                <p className="text-muted-foreground">
                  Crea immagini uniche con l'intelligenza artificiale
                </p>
              </div>
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                [DEMO] Dati di Esempio
              </Badge>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Genera Nuova Immagine
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prompt">Descrizione Immagine (Prompt)</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Descrivi l'immagine che vuoi generare... Es: Una persona che medita in un giardino zen al tramonto"
                    rows={3}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Stile</Label>
                    <Select value={style} onValueChange={setStyle}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona stile" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fotorealistico">Fotorealistico</SelectItem>
                        <SelectItem value="illustrazione">Illustrazione</SelectItem>
                        <SelectItem value="3d">3D</SelectItem>
                        <SelectItem value="minimal">Minimal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Formato</Label>
                    <div className="flex gap-2">
                      {aspectRatios.map((ratio) => (
                        <Button
                          key={ratio.value}
                          variant={aspectRatio === ratio.value ? "default" : "outline"}
                          size="sm"
                          className="flex-1 flex-col h-auto py-2"
                          onClick={() => setAspectRatio(ratio.value)}
                        >
                          <ratio.icon className="h-4 w-4 mb-1" />
                          <span className="text-xs">{ratio.label}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <Button disabled className="w-full sm:w-auto">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Genera Immagine
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Coming Soon
                  </Badge>
                </Button>
              </CardContent>
            </Card>

            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-pink-500" />
                Galleria Immagini
                <Badge variant="secondary">[DEMO]</Badge>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {demoImages.map((image) => (
                  <Card key={image.id} className="overflow-hidden group">
                    <div className="relative aspect-square">
                      <img
                        src={image.url}
                        alt={image.prompt}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button size="sm" variant="secondary">
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                        <Button size="sm" variant="destructive">
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
                          {image.style}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {image.createdAt}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
