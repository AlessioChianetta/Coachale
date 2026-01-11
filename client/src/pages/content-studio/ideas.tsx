import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
} from "@/components/ui/dialog";
import {
  Lightbulb,
  Sparkles,
  Star,
  FileText,
  Zap,
  Loader2,
  Trash2,
  AlertCircle,
  Calendar,
  ImageIcon,
  Bookmark,
  BookmarkCheck,
  ArrowUpDown,
  HelpCircle,
  Hash,
  MessageCircleQuestion,
  Wrench,
  TrendingUp,
  Eye,
  Heart,
  UserPlus,
  ShoppingCart,
  GraduationCap,
  Award,
} from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { useLocation } from "wouter";

interface Idea {
  id: string;
  title: string;
  description: string;
  score: number;
  hook: string;
  contentType: string;
  targetAudience: string;
  status: string;
  createdAt: string;
  isSaved?: boolean;
}

const CONTENT_TYPES = [
  { value: "post", label: "Post" },
  { value: "carosello", label: "Carosello" },
  { value: "reel", label: "Reel" },
  { value: "video", label: "Video" },
  { value: "story", label: "Story" },
  { value: "articolo", label: "Articolo" },
];

const OBJECTIVES = [
  { value: "awareness", label: "Brand Awareness", description: "Fai conoscere il tuo brand a nuove persone", icon: Eye },
  { value: "engagement", label: "Engagement", description: "Aumenta like, commenti e interazioni", icon: Heart },
  { value: "leads", label: "Lead Generation", description: "Raccogli contatti e richieste", icon: UserPlus },
  { value: "sales", label: "Vendite", description: "Converti il pubblico in clienti", icon: ShoppingCart },
  { value: "education", label: "Educazione", description: "Insegna e condividi valore", icon: GraduationCap },
  { value: "authority", label: "Autorità", description: "Posizionati come esperto del settore", icon: Award },
];

type HookType = "how-to" | "curiosità" | "numero" | "problema";

function getHookType(hook: string): HookType {
  if (!hook) return "problema";
  const lowerHook = hook.toLowerCase();
  if (lowerHook.includes("come ") || lowerHook.includes("come?")) return "how-to";
  if (lowerHook.includes("?")) return "curiosità";
  if (/\d+/.test(hook)) return "numero";
  return "problema";
}

function getHookTypeInfo(hookType: HookType) {
  switch (hookType) {
    case "how-to":
      return { label: "How-to", icon: Wrench, color: "bg-blue-500/10 text-blue-600" };
    case "curiosità":
      return { label: "Curiosità", icon: MessageCircleQuestion, color: "bg-purple-500/10 text-purple-600" };
    case "numero":
      return { label: "Numero", icon: Hash, color: "bg-orange-500/10 text-orange-600" };
    default:
      return { label: "Problema", icon: HelpCircle, color: "bg-slate-500/10 text-slate-600" };
  }
}

function getPotential(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Alto", color: "bg-green-500/10 text-green-600" };
  if (score >= 70) return { label: "Medio", color: "bg-amber-500/10 text-amber-600" };
  return { label: "Basso", color: "bg-red-500/10 text-red-600" };
}

function getScoreProgressColor(score: number): string {
  if (score >= 85) return "bg-green-500";
  if (score >= 70) return "bg-amber-500";
  return "bg-red-500";
}

export default function ContentStudioIdeas() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [objective, setObjective] = useState("");
  const [ideaCount, setIdeaCount] = useState(5);
  const [additionalContext, setAdditionalContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedIdeas, setGeneratedIdeas] = useState<any[]>([]);
  const [showGeneratedDialog, setShowGeneratedDialog] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterContentType, setFilterContentType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("score-desc");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleDevelopPost = (idea: Idea) => {
    const params = new URLSearchParams();
    if (idea.title) params.set("ideaTitle", idea.title);
    if (idea.hook) params.set("ideaHook", idea.hook);
    if (idea.description) params.set("ideaDescription", idea.description);
    setLocation(`/consultant/content-studio/posts?${params.toString()}`);
  };

  const { data: ideasResponse, isLoading } = useQuery({
    queryKey: ["/api/content/ideas"],
    queryFn: async () => {
      const response = await fetch("/api/content/ideas", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch ideas");
      return response.json();
    },
  });

  const ideas: Idea[] = ideasResponse?.data || [];

  const filteredAndSortedIdeas = useMemo(() => {
    let result = [...ideas];

    if (filterStatus !== "all") {
      const statusMap: Record<string, string> = {
        new: "new",
        "in-progress": "in_progress",
        used: "used",
      };
      result = result.filter((idea) => idea.status === statusMap[filterStatus]);
    }

    if (filterContentType !== "all") {
      result = result.filter((idea) =>
        idea.contentType?.toLowerCase().includes(filterContentType.toLowerCase())
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "score-desc":
          return (b.score || 0) - (a.score || 0);
        case "date-desc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "content-type":
          return (a.contentType || "").localeCompare(b.contentType || "");
        default:
          return 0;
      }
    });

    return result;
  }, [ideas, filterStatus, filterContentType, sortBy]);

  const createIdeaMutation = useMutation({
    mutationFn: async (idea: Partial<Idea>) => {
      const response = await fetch("/api/content/ideas", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(idea),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create idea");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Idea salvata",
        description: "L'idea è stata salvata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/ideas"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteIdeaMutation = useMutation({
    mutationFn: async (ideaId: string) => {
      const response = await fetch(`/api/content/ideas/${ideaId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete idea");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Idea eliminata",
        description: "L'idea è stata eliminata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/ideas"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleContentTypeToggle = (value: string) => {
    setContentTypes((prev) =>
      prev.includes(value)
        ? prev.filter((t) => t !== value)
        : [...prev, value]
    );
  };

  const handleGenerateIdeas = async () => {
    if (!topic || !targetAudience || contentTypes.length === 0 || !objective) {
      toast({
        title: "Campi obbligatori",
        description: "Compila tutti i campi per generare le idee",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/content/ai/generate-ideas", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          niche: topic,
          targetAudience,
          contentType: contentTypes.join(", "),
          objective,
          count: ideaCount,
          additionalContext,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate ideas");
      }

      const result = await response.json();
      setGeneratedIdeas(result.data.ideas || []);
      setShowGeneratedDialog(true);
      toast({
        title: "Idee generate!",
        description: `Sono state generate ${result.data.ideas?.length || 0} nuove idee`,
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

  const handleSaveGeneratedIdea = (idea: any) => {
    createIdeaMutation.mutate({
      title: idea.title,
      description: idea.description,
      hook: idea.hook,
      score: idea.score || 80,
      contentType: contentTypes.join(", "),
      targetAudience: targetAudience,
      status: "new",
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-600 bg-green-500/10";
    if (score >= 70) return "text-amber-600 bg-amber-500/10";
    return "text-red-600 bg-red-500/10";
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                  <Lightbulb className="h-8 w-8 text-amber-500" />
                  Generatore Idee
                </h1>
                <p className="text-muted-foreground">
                  Genera idee creative per i tuoi contenuti con l'AI
                </p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Genera Nuove Idee
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic / Argomento</Label>
                  <Textarea
                    id="topic"
                    placeholder="Descrivi l'argomento o la nicchia del tuo contenuto. Es: Sono un personal trainer specializzato in crossfit e fitness funzionale. Il mio metodo si chiama..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="targetAudience">Target Audience</Label>
                  <Textarea
                    id="targetAudience"
                    placeholder="Descrivi il tuo pubblico ideale. Es: Sportivi amatoriali 25-45 anni che vogliono migliorare le prestazioni, professionisti stressati che cercano equilibrio..."
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Obiettivo</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {OBJECTIVES.map((obj) => {
                      const IconComponent = obj.icon;
                      const isSelected = objective === obj.value;
                      return (
                        <motion.div
                          key={obj.value}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setObjective(obj.value)}
                          className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-lg ${
                            isSelected
                              ? "border-2 border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                              : "border-border hover:border-purple-300"
                          }`}
                        >
                          <div className="flex flex-col items-center text-center gap-2">
                            <IconComponent className={`h-6 w-6 ${isSelected ? "text-purple-500" : "text-muted-foreground"}`} />
                            <h4 className={`font-medium text-sm ${isSelected ? "text-purple-700 dark:text-purple-300" : ""}`}>{obj.label}</h4>
                            <p className="text-xs text-muted-foreground">{obj.description}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Tipo Contenuto</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {CONTENT_TYPES.map((type) => (
                      <div
                        key={type.value}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`content-type-${type.value}`}
                          checked={contentTypes.includes(type.value)}
                          onCheckedChange={() => handleContentTypeToggle(type.value)}
                        />
                        <Label
                          htmlFor={`content-type-${type.value}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {type.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Numero Idee da Generare</Label>
                    <span className="text-sm font-medium text-muted-foreground">
                      {ideaCount}
                    </span>
                  </div>
                  <Slider
                    value={[ideaCount]}
                    onValueChange={(value) => setIdeaCount(value[0])}
                    min={5}
                    max={20}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalContext">Contesto Aggiuntivo (opzionale)</Label>
                  <Textarea
                    id="additionalContext"
                    placeholder="Aggiungi dettagli specifici, stagionalità, eventi, o informazioni sul tuo brand..."
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button
                  onClick={handleGenerateIdeas}
                  disabled={isGenerating}
                  className="w-full sm:w-auto"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  {isGenerating ? "Generazione in corso..." : "Genera Idee con AI"}
                </Button>
              </CardContent>
            </Card>

            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Le Tue Idee ({filteredAndSortedIdeas.length})
              </h2>

              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                          <SelectValue placeholder="Ordina per" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="score-desc">Score (alto-basso)</SelectItem>
                          <SelectItem value="date-desc">Data (recente)</SelectItem>
                          <SelectItem value="content-type">Tipo contenuto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-full sm:w-[160px]">
                        <SelectValue placeholder="Filtra per Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti gli status</SelectItem>
                        <SelectItem value="new">Nuove</SelectItem>
                        <SelectItem value="in-progress">In lavorazione</SelectItem>
                        <SelectItem value="used">Usate</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={filterContentType} onValueChange={setFilterContentType}>
                      <SelectTrigger className="w-full sm:w-[160px]">
                        <SelectValue placeholder="Filtra per Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti i tipi</SelectItem>
                        <SelectItem value="post">Post</SelectItem>
                        <SelectItem value="carosello">Carosello</SelectItem>
                        <SelectItem value="reel">Reel</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="story">Story</SelectItem>
                        <SelectItem value="articolo">Articolo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {isLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-4 space-y-3">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredAndSortedIdeas.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredAndSortedIdeas.map((idea) => {
                    const hookType = getHookType(idea.hook);
                    const hookTypeInfo = getHookTypeInfo(hookType);
                    const HookIcon = hookTypeInfo.icon;
                    const potential = getPotential(idea.score || 0);
                    
                    return (
                      <Card key={idea.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-base">{idea.title}</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {idea.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteIdeaMutation.mutate(idea.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>

                          {idea.score && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div
                                  className={`flex items-center gap-1 px-2 py-1 rounded-lg ${getScoreColor(
                                    idea.score
                                  )}`}
                                >
                                  <Star className="h-4 w-4" />
                                  <span className="font-bold">{idea.score}</span>
                                </div>
                                <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${potential.color}`}>
                                  <TrendingUp className="h-3 w-3" />
                                  {potential.label}
                                </div>
                              </div>
                              <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`absolute left-0 top-0 h-full rounded-full transition-all ${getScoreProgressColor(idea.score)}`}
                                  style={{ width: `${idea.score}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {idea.hook && (
                            <div className="bg-muted/50 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-xs text-muted-foreground">
                                  Hook Suggerito:
                                </p>
                                <Badge variant="outline" className={`text-xs ${hookTypeInfo.color}`}>
                                  <HookIcon className="h-3 w-3 mr-1" />
                                  {hookTypeInfo.label}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium italic">"{idea.hook}"</p>
                            </div>
                          )}

                          <div className="flex items-center gap-2 flex-wrap">
                            {idea.contentType && (
                              <Badge variant="outline">{idea.contentType}</Badge>
                            )}
                            {idea.targetAudience && (
                              <Badge variant="secondary">{idea.targetAudience}</Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDevelopPost(idea)}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Sviluppa Post
                            </Button>
                            <Button variant="outline" size="sm">
                              <ImageIcon className="h-4 w-4 mr-1" />
                              Genera Immagine
                            </Button>
                            <Button variant="outline" size="sm">
                              <Calendar className="h-4 w-4 mr-1" />
                              Calendario
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={idea.isSaved}
                            >
                              {idea.isSaved ? (
                                <BookmarkCheck className="h-4 w-4 mr-1" />
                              ) : (
                                <Bookmark className="h-4 w-4 mr-1" />
                              )}
                              Salva
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">Nessuna idea salvata</h3>
                    <p className="text-muted-foreground mb-4">
                      Genera nuove idee con l'AI o creane una manualmente
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showGeneratedDialog} onOpenChange={setShowGeneratedDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Idee Generate ({generatedIdeas.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {generatedIdeas.map((idea, index) => (
              <Card key={index}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold">{idea.title}</h4>
                    {idea.score && (
                      <Badge className={getScoreColor(idea.score)}>
                        Score: {idea.score}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{idea.description}</p>
                  {idea.hook && (
                    <p className="text-sm italic text-purple-600">Hook: "{idea.hook}"</p>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handleSaveGeneratedIdea(idea)}
                    disabled={createIdeaMutation.isPending}
                  >
                    {createIdeaMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Salva Idea
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
