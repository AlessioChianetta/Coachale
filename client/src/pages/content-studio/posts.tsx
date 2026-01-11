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
  Loader2,
  Trash2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";

interface Post {
  id: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  platform: string;
  status: string;
  scheduledDate?: string;
  contentType?: string;
  engagement?: {
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    hook: "",
    body: "",
    cta: "",
    platform: "",
    status: "draft",
  });
  const [ideaForCopy, setIdeaForCopy] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: postsResponse, isLoading } = useQuery({
    queryKey: ["/api/content/posts"],
    queryFn: async () => {
      const response = await fetch("/api/content/posts", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
  });

  const posts: Post[] = postsResponse?.data || [];

  const createPostMutation = useMutation({
    mutationFn: async (post: Partial<Post>) => {
      const response = await fetch("/api/content/posts", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(post),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create post");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Post creato",
        description: "Il post è stato creato con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/posts"] });
      setIsDialogOpen(false);
      setFormData({ title: "", hook: "", body: "", cta: "", platform: "", status: "draft" });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(`/api/content/posts/${postId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete post");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Post eliminato",
        description: "Il post è stato eliminato con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/posts"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGenerateCopy = async () => {
    if (!ideaForCopy || !formData.platform) {
      toast({
        title: "Campi obbligatori",
        description: "Inserisci un'idea e seleziona la piattaforma",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/content/ai/generate-copy", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idea: ideaForCopy,
          platform: formData.platform,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate copy");
      }

      const result = await response.json();
      const generatedCopy = result.data.copy;

      setFormData((prev) => ({
        ...prev,
        title: generatedCopy.title || prev.title,
        hook: generatedCopy.hook || prev.hook,
        body: generatedCopy.body || prev.body,
        cta: generatedCopy.cta || prev.cta,
      }));

      toast({
        title: "Copy generato!",
        description: "Il copy è stato generato con successo",
      });
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

  const handleCreatePost = () => {
    if (!formData.title && !formData.hook) {
      toast({
        title: "Campi obbligatori",
        description: "Inserisci almeno un titolo o un hook",
        variant: "destructive",
      });
      return;
    }
    createPostMutation.mutate(formData);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case "instagram":
        return <Instagram className="h-4 w-4 text-pink-500" />;
      case "facebook":
        return <Facebook className="h-4 w-4 text-blue-600" />;
      case "linkedin":
        return <Linkedin className="h-4 w-4 text-blue-700" />;
      case "twitter":
      case "tiktok":
        return <Twitter className="h-4 w-4 text-sky-500" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "draft":
      case "bozza":
        return (
          <Badge variant="secondary" className="bg-gray-500/10 text-gray-600">
            Bozza
          </Badge>
        );
      case "scheduled":
      case "programmato":
        return (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
            Programmato
          </Badge>
        );
      case "published":
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
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuovo Post
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Crea Nuovo Post</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
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
                          <SelectItem value="tiktok">TikTok</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Genera con AI (opzionale)</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Descrivi l'idea del post..."
                          value={ideaForCopy}
                          onChange={(e) => setIdeaForCopy(e.target.value)}
                        />
                        <Button
                          variant="outline"
                          onClick={handleGenerateCopy}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="title">Titolo</Label>
                      <Input
                        id="title"
                        placeholder="Titolo del post..."
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                      />
                    </div>

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
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setFormData({ ...formData, status: "draft" });
                          handleCreatePost();
                        }}
                        disabled={createPostMutation.isPending}
                      >
                        Salva Bozza
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => {
                          setFormData({ ...formData, status: "scheduled" });
                          handleCreatePost();
                        }}
                        disabled={createPostMutation.isPending}
                      >
                        {createPostMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Programma
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : posts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {posts.map((post) => (
                  <Card key={post.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(post.platform)}
                          <span className="text-sm font-medium capitalize">
                            {post.platform}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(post.status)}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deletePostMutation.mutate(post.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold">{post.title || "Post senza titolo"}</h3>
                        {post.hook && (
                          <p className="text-sm text-muted-foreground mt-1 italic">
                            "{post.hook}"
                          </p>
                        )}
                      </div>

                      {post.scheduledDate && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(post.scheduledDate).toLocaleString("it-IT")}</span>
                        </div>
                      )}

                      {post.status === "published" && post.engagement && (
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
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Nessun post creato</h3>
                  <p className="text-muted-foreground mb-4">
                    Crea il tuo primo post cliccando il pulsante "Nuovo Post"
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
