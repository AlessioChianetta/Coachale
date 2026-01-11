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
  Check,
  Save,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Video,
  Camera,
  FileText as FileTextIcon,
  AlignLeft,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  mediaType?: "video" | "photo";
  copyType?: "short" | "long";
  videoScript?: string;
  imageDescription?: string;
  imageOverlayText?: string;
  copyContent?: string;
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
  const [savedIdeaIndexes, setSavedIdeaIndexes] = useState<Set<number>>(new Set());
  const [mediaType, setMediaType] = useState<"video" | "photo">("photo");
  const [copyType, setCopyType] = useState<"short" | "long">("short");

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterContentType, setFilterContentType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("score-desc");
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: templatesResponse } = useQuery({
    queryKey: ["/api/content/idea-templates"],
    queryFn: async () => {
      const response = await fetch("/api/content/idea-templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });
  const templates = templatesResponse?.data || [];

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    try {
      const response = await fetch("/api/content/idea-templates", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          topic,
          targetAudience,
          objective,
          contentTypes: JSON.stringify(contentTypes),
          additionalContext,
        }),
      });
      if (response.ok) {
        toast({ title: "Template salvato!", description: `"${templateName}" è stato salvato` });
        setShowSaveTemplateDialog(false);
        setTemplateName("");
        queryClient.invalidateQueries({ queryKey: ["/api/content/idea-templates"] });
      }
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile salvare il template", variant: "destructive" });
    }
  };

  const handleLoadTemplate = (template: any) => {
    setTopic(template.topic || "");
    setTargetAudience(template.targetAudience || "");
    setObjective(template.objective || "");
    setContentTypes(template.contentTypes ? JSON.parse(template.contentTypes) : []);
    setAdditionalContext(template.additionalContext || "");
    toast({ title: "Template caricato", description: `"${template.name}" applicato` });
  };

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
          mediaType,
          copyType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate ideas");
      }

      const result = await response.json();
      setGeneratedIdeas(result.data.ideas || []);
      setSavedIdeaIndexes(new Set()); // Reset saved state for new batch
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

  const handleSaveGeneratedIdea = (idea: any, index: number) => {
    createIdeaMutation.mutate({
      title: idea.title,
      description: idea.description,
      hook: idea.suggestedHook || idea.hook,
      score: idea.aiScore || idea.score || 80,
      contentType: contentTypes.join(", "),
      targetAudience: targetAudience,
      status: "new",
      mediaType: idea.mediaType || mediaType,
      copyType: idea.copyType || copyType,
      videoScript: idea.videoScript,
      imageDescription: idea.imageDescription,
      imageOverlayText: idea.imageOverlayText,
      copyContent: idea.copyContent,
    }, {
      onSuccess: () => {
        setSavedIdeaIndexes(prev => new Set(prev).add(index));
        toast({
          title: "Idea salvata!",
          description: `"${idea.title}" è stata aggiunta alle tue idee`,
        });
      }
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label>Tipo Media</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setMediaType("video")}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          mediaType === "video"
                            ? "border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-border hover:border-blue-300"
                        }`}
                      >
                        <div className="flex flex-col items-center text-center gap-2">
                          <Video className={`h-6 w-6 ${mediaType === "video" ? "text-blue-500" : "text-muted-foreground"}`} />
                          <h4 className={`font-medium text-sm ${mediaType === "video" ? "text-blue-700 dark:text-blue-300" : ""}`}>Video</h4>
                          <p className="text-xs text-muted-foreground">Script parlato per video</p>
                        </div>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setMediaType("photo")}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          mediaType === "photo"
                            ? "border-2 border-green-500 bg-green-50 dark:bg-green-900/20"
                            : "border-border hover:border-green-300"
                        }`}
                      >
                        <div className="flex flex-col items-center text-center gap-2">
                          <Camera className={`h-6 w-6 ${mediaType === "photo" ? "text-green-500" : "text-muted-foreground"}`} />
                          <h4 className={`font-medium text-sm ${mediaType === "photo" ? "text-green-700 dark:text-green-300" : ""}`}>Foto</h4>
                          <p className="text-xs text-muted-foreground">Descrizione immagine + overlay</p>
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Tipo Copy</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setCopyType("short")}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          copyType === "short"
                            ? "border-2 border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                            : "border-border hover:border-orange-300"
                        }`}
                      >
                        <div className="flex flex-col items-center text-center gap-2">
                          <FileTextIcon className={`h-6 w-6 ${copyType === "short" ? "text-orange-500" : "text-muted-foreground"}`} />
                          <h4 className={`font-medium text-sm ${copyType === "short" ? "text-orange-700 dark:text-orange-300" : ""}`}>Copy Corto</h4>
                          <p className="text-xs text-muted-foreground">Diretto, 3-4 blocchi</p>
                        </div>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setCopyType("long")}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          copyType === "long"
                            ? "border-2 border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                            : "border-border hover:border-purple-300"
                        }`}
                      >
                        <div className="flex flex-col items-center text-center gap-2">
                          <AlignLeft className={`h-6 w-6 ${copyType === "long" ? "text-purple-500" : "text-muted-foreground"}`} />
                          <h4 className={`font-medium text-sm ${copyType === "long" ? "text-purple-700 dark:text-purple-300" : ""}`}>Copy Lungo</h4>
                          <p className="text-xs text-muted-foreground">Narrativo, emotivo, storytelling</p>
                        </div>
                      </motion.div>
                    </div>
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

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleGenerateIdeas}
                    disabled={isGenerating}
                    className="flex-1 sm:flex-none"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {isGenerating ? "Generazione in corso..." : "Genera Idee con AI"}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => setShowSaveTemplateDialog(true)}
                    disabled={!topic && !targetAudience}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Salva Template
                  </Button>
                  
                  {templates.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          <FolderOpen className="h-4 w-4 mr-2" />
                          Carica Template
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {templates.map((template: any) => (
                          <DropdownMenuItem key={template.id} onClick={() => handleLoadTemplate(template)}>
                            <FileText className="h-4 w-4 mr-2" />
                            {template.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
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
                  {filteredAndSortedIdeas.map((idea) => (
                    <motion.div
                      key={idea.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`group relative bg-card rounded-xl border-l-4 shadow-sm hover:shadow-md transition-all ${
                        (idea.score || 0) >= 85 ? "border-l-green-500" :
                        (idea.score || 0) >= 70 ? "border-l-amber-500" : "border-l-red-500"
                      }`}
                    >
                      <div className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base line-clamp-2">{idea.title}</h3>
                            <div 
                              className="mt-1 cursor-pointer group/desc"
                              onClick={() => {
                                const newSet = new Set(expandedDescriptions);
                                if (newSet.has(idea.id)) {
                                  newSet.delete(idea.id);
                                } else {
                                  newSet.add(idea.id);
                                }
                                setExpandedDescriptions(newSet);
                              }}
                            >
                              <p className={`text-sm text-muted-foreground ${expandedDescriptions.has(idea.id) ? "" : "line-clamp-2"}`}>
                                {idea.description}
                              </p>
                              {idea.description && idea.description.length > 100 && (
                                <button className="text-xs text-primary hover:underline mt-1 flex items-center gap-1">
                                  {expandedDescriptions.has(idea.id) ? (
                                    <>Mostra meno <ChevronUp className="h-3 w-3" /></>
                                  ) : (
                                    <>Mostra tutto <ChevronDown className="h-3 w-3" /></>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                              (idea.score || 0) >= 85 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                              (idea.score || 0) >= 70 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                              "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            }`}>
                              {idea.score || 0}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleDevelopPost(idea)}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Sviluppa Post
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <ImageIcon className="h-4 w-4 mr-2" />
                                  Genera Immagine
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Calendar className="h-4 w-4 mr-2" />
                                  Aggiungi a Calendario
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => deleteIdeaMutation.mutate(idea.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Elimina
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {idea.hook && (
                          <div className="bg-purple-50 dark:bg-purple-950/20 p-2 rounded-lg">
                            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">Hook:</p>
                            <p className="text-sm italic line-clamp-2">"{idea.hook}"</p>
                          </div>
                        )}

                        {(idea.videoScript || idea.imageDescription || idea.copyContent) && (
                          <div className="space-y-2 pt-2 border-t">
                            {idea.mediaType === "video" && idea.videoScript && (
                              <div className="bg-blue-50 dark:bg-blue-950/20 p-2 rounded-lg">
                                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 mb-1">
                                  <Video className="h-3 w-3" />
                                  <span className="text-xs font-medium">Script Video</span>
                                </div>
                                <p className="text-xs line-clamp-3">{idea.videoScript}</p>
                              </div>
                            )}
                            {idea.mediaType === "photo" && idea.imageDescription && (
                              <div className="bg-green-50 dark:bg-green-950/20 p-2 rounded-lg">
                                <div className="flex items-center gap-1 text-green-600 dark:text-green-400 mb-1">
                                  <Camera className="h-3 w-3" />
                                  <span className="text-xs font-medium">Descrizione Immagine</span>
                                </div>
                                <p className="text-xs line-clamp-2">{idea.imageDescription}</p>
                                {idea.imageOverlayText && (
                                  <p className="text-xs font-medium mt-1">Overlay: "{idea.imageOverlayText}"</p>
                                )}
                              </div>
                            )}
                            {idea.copyContent && (
                              <div className="bg-purple-50 dark:bg-purple-950/20 p-2 rounded-lg">
                                <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 mb-1">
                                  {idea.copyType === "long" ? <AlignLeft className="h-3 w-3" /> : <FileTextIcon className="h-3 w-3" />}
                                  <span className="text-xs font-medium">{idea.copyType === "long" ? "Copy Lungo" : "Copy Corto"}</span>
                                </div>
                                <p className="text-xs line-clamp-3 whitespace-pre-wrap">{idea.copyContent}</p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          {idea.contentType && (
                            <Badge variant="outline" className="text-xs">{idea.contentType}</Badge>
                          )}
                          {idea.mediaType && (
                            <Badge variant="outline" className="text-xs">
                              {idea.mediaType === "video" ? <><Video className="h-3 w-3 mr-1" />Video</> : <><Camera className="h-3 w-3 mr-1" />Foto</>}
                            </Badge>
                          )}
                          {idea.copyType && (
                            <Badge variant="outline" className="text-xs">
                              {idea.copyType === "long" ? "Copy Lungo" : "Copy Corto"}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {(idea.score || 0) >= 85 ? "Alto Potenziale" :
                             (idea.score || 0) >= 70 ? "Medio Potenziale" : "Da Sviluppare"}
                          </Badge>
                        </div>
                      </div>
                    </motion.div>
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

      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5 text-purple-500" />
              Salva Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nome Template</Label>
              <Input
                id="template-name"
                placeholder="Es: Template B2B SaaS..."
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Verranno salvati:</p>
              <ul className="list-disc list-inside text-xs">
                {topic && <li>Topic: {topic.slice(0, 50)}...</li>}
                {targetAudience && <li>Target: {targetAudience.slice(0, 50)}...</li>}
                {objective && <li>Obiettivo: {objective}</li>}
                {contentTypes.length > 0 && <li>Tipi: {contentTypes.join(", ")}</li>}
              </ul>
            </div>
            <Button onClick={handleSaveTemplate} disabled={!templateName.trim()} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Salva Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showGeneratedDialog} onOpenChange={(open) => {
        setShowGeneratedDialog(open);
        if (!open) setSavedIdeaIndexes(new Set()); // Reset when closing
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Idee Generate ({generatedIdeas.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {generatedIdeas.map((idea, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-b">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{idea.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{idea.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(idea.aiScore || idea.score) && (
                          <Badge className={getScoreColor(idea.aiScore || idea.score)}>
                            {idea.aiScore || idea.score}
                          </Badge>
                        )}
                        <Badge variant="outline" className="capitalize">
                          {idea.mediaType === "video" ? (
                            <><Video className="h-3 w-3 mr-1" /> Video</>
                          ) : (
                            <><Camera className="h-3 w-3 mr-1" /> Foto</>
                          )}
                        </Badge>
                        <Badge variant="outline">
                          {idea.copyType === "long" ? "Copy Lungo" : "Copy Corto"}
                        </Badge>
                      </div>
                    </div>
                    {(idea.suggestedHook || idea.hook) && (
                      <div className="mt-3 p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                        <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                          Hook: "{idea.suggestedHook || idea.hook}"
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-4">
                    {idea.mediaType === "video" && idea.videoScript && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                          <Video className="h-4 w-4" />
                          <span className="font-medium text-sm">Script Video (da parlare)</span>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{idea.videoScript}</p>
                        </div>
                      </div>
                    )}

                    {idea.mediaType === "photo" && (idea.imageDescription || idea.imageOverlayText) && (
                      <div className="space-y-3">
                        {idea.imageDescription && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                              <Camera className="h-4 w-4" />
                              <span className="font-medium text-sm">Descrizione Immagine</span>
                            </div>
                            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                              <p className="text-sm">{idea.imageDescription}</p>
                            </div>
                          </div>
                        )}
                        {idea.imageOverlayText && (
                          <div className="space-y-2">
                            <span className="font-medium text-sm text-green-600 dark:text-green-400">Testo Overlay:</span>
                            <div className="bg-black text-white p-3 rounded-lg text-center font-bold">
                              "{idea.imageOverlayText}"
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {idea.copyContent && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                          {idea.copyType === "long" ? <AlignLeft className="h-4 w-4" /> : <FileTextIcon className="h-4 w-4" />}
                          <span className="font-medium text-sm">
                            {idea.copyType === "long" ? "Copy Lungo (Narrativo)" : "Copy Corto (Diretto)"}
                          </span>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{idea.copyContent}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t">
                      {idea.suggestedCta && (
                        <p className="text-xs text-muted-foreground">
                          CTA suggerita: <span className="font-medium">{idea.suggestedCta}</span>
                        </p>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleSaveGeneratedIdea(idea, index)}
                        disabled={createIdeaMutation.isPending || savedIdeaIndexes.has(index)}
                        className={savedIdeaIndexes.has(index) ? "bg-green-500 hover:bg-green-500" : ""}
                      >
                        {createIdeaMutation.isPending && !savedIdeaIndexes.has(index) ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : savedIdeaIndexes.has(index) ? (
                          <Check className="h-4 w-4 mr-2" />
                        ) : (
                          <Bookmark className="h-4 w-4 mr-2" />
                        )}
                        {savedIdeaIndexes.has(index) ? "Salvata!" : "Salva Idea"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
