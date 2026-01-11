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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText,
  Plus,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Calendar,
  ImagePlus,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

interface Post {
  id: string;
  title: string;
  hook: string;
  platform: "instagram" | "facebook" | "linkedin" | "twitter";
  status: "bozza" | "programmato" | "pubblicato";
  scheduledDate?: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
}

export default function ContentStudioPosts() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    hook: "",
    body: "",
    cta: "",
    platform: "",
  });

  const demoPosts: Post[] = [
    {
      id: "1",
      title: "[DEMO] 5 Errori Fitness da Evitare",
      hook: "Stai sabotando i tuoi risultati?",
      platform: "instagram",
      status: "pubblicato",
      engagement: { likes: 342, comments: 28, shares: 15, views: 4520 },
    },
    {
      id: "2",
      title: "[DEMO] Routine Mattutina Produttiva",
      hook: "Come inizio ogni giorno con energia",
      platform: "linkedin",
      status: "programmato",
      scheduledDate: "2025-01-15 09:00",
      engagement: { likes: 0, comments: 0, shares: 0, views: 0 },
    },
    {
      id: "3",
      title: "[DEMO] Nutrizione Post-Workout",
      hook: "Il 90% sbaglia questo passaggio",
      platform: "facebook",
      status: "bozza",
      engagement: { likes: 0, comments: 0, shares: 0, views: 0 },
    },
    {
      id: "4",
      title: "[DEMO] Trasformazione Cliente Marco",
      hook: "Da 0 a maratoneta in 12 mesi",
      platform: "instagram",
      status: "pubblicato",
      engagement: { likes: 891, comments: 67, shares: 42, views: 12300 },
    },
    {
      id: "5",
      title: "[DEMO] Esercizi Schiena Ufficio",
      hook: "Mal di schiena? Ecco la soluzione",
      platform: "twitter",
      status: "programmato",
      scheduledDate: "2025-01-16 12:30",
      engagement: { likes: 0, comments: 0, shares: 0, views: 0 },
    },
  ];

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "instagram":
        return <Instagram className="h-4 w-4 text-pink-500" />;
      case "facebook":
        return <Facebook className="h-4 w-4 text-blue-600" />;
      case "linkedin":
        return <Linkedin className="h-4 w-4 text-blue-700" />;
      case "twitter":
        return <Twitter className="h-4 w-4 text-sky-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "bozza":
        return (
          <Badge variant="secondary" className="bg-gray-500/10 text-gray-600">
            Bozza
          </Badge>
        );
      case "programmato":
        return (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
            Programmato
          </Badge>
        );
      case "pubblicato":
        return (
          <Badge variant="secondary" className="bg-green-500/10 text-green-600">
            Pubblicato
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
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
                  <FileText className="h-8 w-8 text-blue-500" />
                  Gestione Post
                </h1>
                <p className="text-muted-foreground">
                  Crea e gestisci i tuoi contenuti social
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  [DEMO] Dati di Esempio
                </Badge>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Nuovo Post
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Crea Nuovo Post</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="hook">Hook</Label>
                        <Input
                          id="hook"
                          placeholder="La prima frase che cattura l'attenzione..."
                          value={formData.hook}
                          onChange={(e) =>
                            setFormData({ ...formData, hook: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="body">Corpo del Post</Label>
                        <Textarea
                          id="body"
                          placeholder="Il contenuto principale del tuo post..."
                          rows={4}
                          value={formData.body}
                          onChange={(e) =>
                            setFormData({ ...formData, body: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="cta">Call to Action</Label>
                        <Input
                          id="cta"
                          placeholder="Es: Clicca il link in bio!"
                          value={formData.cta}
                          onChange={(e) =>
                            setFormData({ ...formData, cta: e.target.value })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Piattaforma</Label>
                        <Select
                          value={formData.platform}
                          onValueChange={(value) =>
                            setFormData({ ...formData, platform: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona piattaforma" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="instagram">Instagram</SelectItem>
                            <SelectItem value="facebook">Facebook</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="twitter">Twitter/X</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Immagine</Label>
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer">
                          <ImagePlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Clicca per caricare un'immagine
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            PNG, JPG fino a 10MB
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4">
                        <Button variant="outline" className="flex-1">
                          Salva Bozza
                        </Button>
                        <Button className="flex-1">Programma</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {demoPosts.map((post) => (
                <Card key={post.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getPlatformIcon(post.platform)}
                        <span className="text-sm font-medium capitalize">
                          {post.platform}
                        </span>
                      </div>
                      {getStatusBadge(post.status)}
                    </div>

                    <div>
                      <h3 className="font-semibold">{post.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 italic">
                        "{post.hook}"
                      </p>
                    </div>

                    {post.scheduledDate && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{post.scheduledDate}</span>
                      </div>
                    )}

                    {post.status === "pubblicato" && (
                      <div className="grid grid-cols-4 gap-2 pt-2 border-t">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-pink-500">
                            <Heart className="h-3 w-3" />
                            <span className="text-xs font-semibold">
                              {post.engagement.likes}
                            </span>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-blue-500">
                            <MessageCircle className="h-3 w-3" />
                            <span className="text-xs font-semibold">
                              {post.engagement.comments}
                            </span>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-green-500">
                            <Share2 className="h-3 w-3" />
                            <span className="text-xs font-semibold">
                              {post.engagement.shares}
                            </span>
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-purple-500">
                            <Eye className="h-3 w-3" />
                            <span className="text-xs font-semibold">
                              {post.engagement.views > 1000
                                ? `${(post.engagement.views / 1000).toFixed(1)}K`
                                : post.engagement.views}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        Modifica
                      </Button>
                      <Button variant="ghost" size="sm">
                        Visualizza
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
