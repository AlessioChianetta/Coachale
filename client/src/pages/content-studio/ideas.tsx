import { useState } from "react";
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
  Megaphone,
  Zap,
  Loader2,
  Trash2,
  AlertCircle,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";

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
}

const CONTENT_TYPES = [
  { value: "post", label: "Post" },
  { value: "carosello", label: "Carosello" },
  { value: "reel", label: "Reel" },
  { value: "video", label: "Video" },
  { value: "story", label: "Story" },
  { value: "articolo", label: "Articolo" },
];

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

  const queryClient = useQueryClient();
  const { toast } = useToast();

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
    if (score >= 90) return "text-green-600 bg-green-500/10";
    if (score >= 80) return "text-amber-600 bg-amber-500/10";
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="topic">Topic / Argomento</Label>
                    <Input
                      id="topic"
                      placeholder="Es: Fitness, Nutrizione, Mindset..."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Target Audience</Label>
                    <Select value={targetAudience} onValueChange={setTargetAudience}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona target" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="principianti">Principianti</SelectItem>
                        <SelectItem value="intermedi">Intermedi</SelectItem>
                        <SelectItem value="avanzati">Avanzati</SelectItem>
                        <SelectItem value="professionisti">Professionisti 30-45</SelectItem>
                        <SelectItem value="giovani">Giovani 18-25</SelectItem>
                        <SelectItem value="tutti">Tutti</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Obiettivo</Label>
                    <Select value={objective} onValueChange={setObjective}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona obiettivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="awareness">Brand Awareness</SelectItem>
                        <SelectItem value="engagement">Engagement</SelectItem>
                        <SelectItem value="leads">Lead Generation</SelectItem>
                        <SelectItem value="sales">Vendite</SelectItem>
                        <SelectItem value="education">Educazione</SelectItem>
                      </SelectContent>
                    </Select>
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
                    min={3}
                    max={15}
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
                Le Tue Idee ({ideas.length})
              </h2>

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
              ) : ideas.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {ideas.map((idea) => (
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
                            {idea.score && (
                              <div
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg ${getScoreColor(
                                  idea.score
                                )}`}
                              >
                                <Star className="h-4 w-4" />
                                <span className="font-bold">{idea.score}</span>
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteIdeaMutation.mutate(idea.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>

                        {idea.hook && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">
                              Hook Suggerito:
                            </p>
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

                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" size="sm" className="flex-1">
                            <FileText className="h-4 w-4 mr-1" />
                            Usa per Post
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1">
                            <Megaphone className="h-4 w-4 mr-1" />
                            Usa per Campagna
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
