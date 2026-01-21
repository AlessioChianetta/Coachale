import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Target,
  Cog,
  Rocket,
  Crown,
  Eye,
  Heart,
  UserPlus,
  ShoppingCart,
  GraduationCap,
  Award,
  Brain,
  AlertTriangle,
  Compass,
  Package,
  Gift,
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
  CheckCircle,
  Clock,
  Archive,
  ExternalLink,
  PlayCircle,
  Wand2,
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
  status: "new" | "in_progress" | "developed" | "archived";
  createdAt: string;
  isSaved?: boolean;
  mediaType?: "video" | "photo";
  copyType?: "short" | "long";
  videoScript?: string;
  imageDescription?: string;
  imageOverlayText?: string;
  copyContent?: string;
  developedPostId?: string;
  lengthWarning?: string;
}

type IdeaStatus = "new" | "in_progress" | "developed" | "archived";

const STATUS_FILTERS = [
  { value: "all", label: "Tutte", icon: Lightbulb },
  { value: "new", label: "Nuove", icon: Sparkles },
  { value: "in_progress", label: "In Lavorazione", icon: Clock },
  { value: "developed", label: "Sviluppate", icon: CheckCircle },
  { value: "archived", label: "Archiviate", icon: Archive },
] as const;

function getStatusInfo(status: IdeaStatus, developedPostId?: string) {
  if (developedPostId || status === "developed") {
    return { 
      label: "Sviluppata", 
      color: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800", 
      icon: CheckCircle,
      cardClass: "border-l-4 border-l-green-500"
    };
  }
  switch (status) {
    case "in_progress":
      return { 
        label: "In Lavorazione", 
        color: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800", 
        icon: Clock,
        cardClass: "border-l-4 border-l-amber-500"
      };
    case "archived":
      return { 
        label: "Archiviata", 
        color: "bg-gray-500/10 text-gray-500 border-gray-200 dark:border-gray-700", 
        icon: Archive,
        cardClass: "border-l-4 border-l-gray-400 opacity-75"
      };
    default:
      return { 
        label: "Nuova", 
        color: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800", 
        icon: Sparkles,
        cardClass: ""
      };
  }
}

const OBJECTIVES = [
  { value: "awareness", label: "Brand Awareness", description: "Fai conoscere il tuo brand a nuove persone", icon: Eye },
  { value: "engagement", label: "Engagement", description: "Aumenta like, commenti e interazioni", icon: Heart },
  { value: "leads", label: "Lead Generation", description: "Raccogli contatti e richieste", icon: UserPlus },
  { value: "sales", label: "Vendite", description: "Converti il pubblico in clienti", icon: ShoppingCart },
  { value: "education", label: "Educazione", description: "Insegna e condividi valore", icon: GraduationCap },
  { value: "authority", label: "Autorità", description: "Posizionati come esperto del settore", icon: Award },
];

const AWARENESS_LEVELS = [
  { value: "unaware", label: "Non Consapevole", description: "Non sa di avere un problema", icon: Brain, color: "red" },
  { value: "problem_aware", label: "Consapevole Problema", description: "Sente disagio ma non conosce soluzioni", icon: AlertTriangle, color: "orange" },
  { value: "solution_aware", label: "Consapevole Soluzione", description: "Conosce soluzioni ma non la tua", icon: Compass, color: "yellow" },
  { value: "product_aware", label: "Consapevole Prodotto", description: "Conosce il tuo prodotto ma non è convinto", icon: Package, color: "blue" },
  { value: "most_aware", label: "Più Consapevole", description: "Desidera il prodotto, aspetta l'offerta giusta", icon: Gift, color: "green" },
];

const SOPHISTICATION_LEVELS = [
  { value: "level_1", label: "Livello 1 - Beneficio Diretto", description: "Primo sul mercato, claim semplice", icon: Target, color: "emerald" },
  { value: "level_2", label: "Livello 2 - Amplifica Promessa", description: "Secondo sul mercato, prove concrete", icon: TrendingUp, color: "blue" },
  { value: "level_3", label: "Livello 3 - Meccanismo Unico", description: "Mercato saturo, differenziati", icon: Cog, color: "purple" },
  { value: "level_4", label: "Livello 4 - Meccanismo Migliorato", description: "Concorrenza attiva, specializzati", icon: Rocket, color: "orange" },
  { value: "level_5", label: "Livello 5 - Identità e Brand", description: "Mercato scettico, connessione emotiva", icon: Crown, color: "pink" },
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
  const [objective, setObjective] = useState("");
  const [ideaCount, setIdeaCount] = useState(3);
  const [awarenessLevel, setAwarenessLevel] = useState<"unaware" | "problem_aware" | "solution_aware" | "product_aware" | "most_aware">("problem_aware");
  const [sophisticationLevel, setSophisticationLevel] = useState<"level_1" | "level_2" | "level_3" | "level_4" | "level_5">("level_3");
  const [additionalContext, setAdditionalContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedIdeas, setGeneratedIdeas] = useState<any[]>([]);
  const [showGeneratedDialog, setShowGeneratedDialog] = useState(false);
  const [savedIdeaIndexes, setSavedIdeaIndexes] = useState<Set<number>>(new Set());
  const [mediaType, setMediaType] = useState<"video" | "photo">("photo");
  const [copyType, setCopyType] = useState<"short" | "long">("short");
  const [isSuggestingLevels, setIsSuggestingLevels] = useState(false);
  const [showLevelsSuggestionDialog, setShowLevelsSuggestionDialog] = useState(false);
  const [levelsSuggestion, setLevelsSuggestion] = useState<{
    awarenessLevel: string;
    awarenessReason: string;
    sophisticationLevel: string;
    sophisticationReason: string;
  } | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [filterContentType, setFilterContentType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("score-desc");
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(["all"]));
  const [viewingIdea, setViewingIdea] = useState<Idea | null>(null);
  
  // Wizard accordion state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["brand"]));
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };
  
  // Calculate form completion progress
  const formProgress = useMemo(() => {
    let completed = 0;
    const total = 3;
    if (topic.trim()) completed++;
    if (targetAudience.trim()) completed++;
    if (objective) completed++;
    return { completed, total, percentage: Math.round((completed / total) * 100) };
  }, [topic, targetAudience, objective]);

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (filter === "all") {
        return new Set(["all"]);
      }
      newFilters.delete("all");
      if (newFilters.has(filter)) {
        newFilters.delete(filter);
        if (newFilters.size === 0) {
          return new Set(["all"]);
        }
      } else {
        newFilters.add(filter);
      }
      return newFilters;
    });
  };

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
          additionalContext,
          awarenessLevel,
          sophisticationLevel,
          mediaType,
          copyType,
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
    setAdditionalContext(template.additionalContext || "");
    setAwarenessLevel(template.awarenessLevel || "problem_aware");
    setSophisticationLevel(template.sophisticationLevel || "level_3");
    setMediaType(template.mediaType || "photo");
    setCopyType(template.copyType || "short");
    toast({ title: "Template caricato", description: `"${template.name}" applicato` });
  };

  const handleDevelopPost = (idea: Idea) => {
    if (idea.id) {
      setLocation(`/consultant/content-studio/posts?ideaId=${idea.id}`);
    } else {
      toast({
        title: "Errore",
        description: "Idea non valida: ID mancante",
        variant: "destructive",
      });
    }
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

    // Filtra per stato
    if (statusFilter === "all") {
      // "Tutte" mostra solo idee NON sviluppate (senza developedPostId e status !== "developed")
      result = result.filter((idea) => !idea.developedPostId && idea.status !== "developed");
    } else if (statusFilter === "developed") {
      // "Sviluppate" mostra solo idee già sviluppate
      result = result.filter((idea) => idea.status === "developed" || idea.developedPostId);
    } else {
      // Altri filtri (new, in_progress, archived) - escludono sempre le sviluppate
      result = result.filter((idea) => idea.status === statusFilter && !idea.developedPostId);
    }

    if (filterContentType !== "all") {
      result = result.filter((idea) =>
        idea.contentType?.toLowerCase().includes(filterContentType.toLowerCase())
      );
    }

    if (!activeFilters.has("all")) {
      result = result.filter((idea) => {
        const matchesVideo = activeFilters.has("video") && idea.mediaType === "video";
        const matchesPhoto = activeFilters.has("photo") && idea.mediaType === "photo";
        const matchesLong = activeFilters.has("long") && idea.copyType === "long";
        const matchesShort = activeFilters.has("short") && idea.copyType === "short";
        
        const hasMediaFilter = activeFilters.has("video") || activeFilters.has("photo");
        const hasCopyFilter = activeFilters.has("long") || activeFilters.has("short");
        
        const matchesMedia = !hasMediaFilter || matchesVideo || matchesPhoto;
        const matchesCopy = !hasCopyFilter || matchesLong || matchesShort;
        
        return matchesMedia && matchesCopy;
      });
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
  }, [ideas, statusFilter, filterContentType, sortBy, activeFilters]);

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

  const updateIdeaStatusMutation = useMutation({
    mutationFn: async ({ ideaId, status, developedPostId }: { ideaId: string; status: IdeaStatus; developedPostId?: string }) => {
      const response = await fetch(`/api/content/ideas/${ideaId}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, developedPostId }),
      });
      if (!response.ok) throw new Error("Failed to update idea status");
      return response.json();
    },
    onSuccess: (_, variables) => {
      const statusLabels: Record<IdeaStatus, string> = {
        new: "Nuova",
        in_progress: "In Lavorazione",
        developed: "Sviluppata",
        archived: "Archiviata",
      };
      toast({
        title: "Stato aggiornato",
        description: `L'idea è stata segnata come "${statusLabels[variables.status]}"`,
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

  const handleStatusChange = (ideaId: string, newStatus: IdeaStatus) => {
    updateIdeaStatusMutation.mutate({ ideaId, status: newStatus });
  };

  const handleSuggestLevels = async () => {
    if (!topic && !targetAudience) {
      toast({ title: "Inserisci prima Topic o Target Audience", variant: "destructive" });
      return;
    }
    setIsSuggestingLevels(true);
    try {
      const response = await fetch("/api/content/ai/suggest-levels", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ topic, targetAudience, objective }),
      });
      const data = await response.json();
      if (data.awarenessLevel) setAwarenessLevel(data.awarenessLevel);
      if (data.sophisticationLevel) setSophisticationLevel(data.sophisticationLevel);
      setLevelsSuggestion(data);
      setShowLevelsSuggestionDialog(true);
    } catch (error) {
      toast({ title: "Errore nel suggerimento", variant: "destructive" });
    } finally {
      setIsSuggestingLevels(false);
    }
  };

  const handleGoToPost = (postId: string) => {
    setLocation(`/consultant/content-studio/posts?postId=${postId}`);
  };

  const handleGenerateIdeas = async () => {
    if (!topic || !targetAudience || !objective) {
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
          objective,
          count: ideaCount,
          additionalContext,
          mediaType,
          copyType,
          awarenessLevel,
          sophisticationLevel,
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
      suggestedHook: idea.suggestedHook,
      suggestedCta: idea.suggestedCta,
      aiScore: idea.aiScore || 80,
      aiReasoning: idea.aiReasoning,
      targetAudience: targetAudience,
      status: "draft",
      mediaType: idea.mediaType || mediaType,
      copyType: idea.copyType || copyType,
      videoScript: idea.videoScript,
      imageDescription: idea.imageDescription || idea.structuredContent?.imageDescription,
      imageOverlayText: idea.imageOverlayText || idea.structuredContent?.imageOverlayText,
      copyContent: idea.copyContent,
      structuredContent: idea.structuredContent,
      awarenessLevel: awarenessLevel,
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

            {/* Wizard Form - Clean 3-Step Structure */}
            <div className="space-y-4">
              {/* Progress Bar */}
              <Card className="border-0 shadow-sm bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Completamento: {formProgress.completed}/{formProgress.total} campi obbligatori
                    </span>
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {formProgress.percentage}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${formProgress.percentage}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Step 1: Brand & Target */}
              <Card className="overflow-hidden">
                <button
                  onClick={() => toggleSection("brand")}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 hover:from-amber-100 hover:to-orange-100 dark:hover:from-amber-950/40 dark:hover:to-orange-950/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-sm">1</div>
                    <div className="text-left">
                      <h3 className="font-semibold text-foreground">Il Tuo Brand</h3>
                      <p className="text-xs text-muted-foreground">Topic e Target Audience</p>
                    </div>
                    {topic && targetAudience && (
                      <CheckCircle className="h-5 w-5 text-green-500 ml-2" />
                    )}
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedSections.has("brand") ? "rotate-180" : ""}`} />
                </button>
                
                <div
                  className={`grid transition-all duration-300 ease-in-out ${expandedSections.has("brand") ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                    <CardContent className="pt-4 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="topic" className="text-sm font-medium">Topic / Argomento *</Label>
                        <Textarea
                          id="topic"
                          placeholder="Es: Sono un personal trainer specializzato in crossfit e fitness funzionale..."
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          rows={3}
                          className="resize-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="targetAudience" className="text-sm font-medium">Target Audience *</Label>
                        <Textarea
                          id="targetAudience"
                          placeholder="Es: Sportivi amatoriali 25-45 anni che vogliono migliorare le prestazioni..."
                          value={targetAudience}
                          onChange={(e) => setTargetAudience(e.target.value)}
                          rows={2}
                          className="resize-none"
                        />
                      </div>
                    </CardContent>
                  </div>
                </div>
              </Card>

              {/* Step 2: Objective & Format */}
              <Card className="overflow-hidden">
                <button
                  onClick={() => toggleSection("objective")}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-950/40 dark:hover:to-pink-950/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-sm">2</div>
                    <div className="text-left">
                      <h3 className="font-semibold text-foreground">Obiettivo & Formato</h3>
                      <p className="text-xs text-muted-foreground">Cosa vuoi ottenere e come</p>
                    </div>
                    {objective && (
                      <CheckCircle className="h-5 w-5 text-green-500 ml-2" />
                    )}
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedSections.has("objective") ? "rotate-180" : ""}`} />
                </button>
                
                <div
                  className={`grid transition-all duration-300 ease-in-out ${expandedSections.has("objective") ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                  <CardContent className="pt-4 space-y-5">
                    {/* Objectives as compact pills */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Obiettivo *</Label>
                      <div className="flex flex-wrap gap-2">
                        {OBJECTIVES.map((obj) => {
                          const IconComponent = obj.icon;
                          const isSelected = objective === obj.value;
                          return (
                            <button
                              key={obj.value}
                              onClick={() => setObjective(obj.value)}
                              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                                isSelected
                                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"
                                  : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <IconComponent className="h-4 w-4" />
                              {obj.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Media & Copy Type - Inline Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Tipo Media</Label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setMediaType("video")}
                            className={`flex-1 px-3 py-2.5 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                              mediaType === "video"
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                                : "border-border hover:border-blue-300"
                            }`}
                          >
                            <Video className="h-4 w-4" />
                            <span className="font-medium text-sm">Video</span>
                          </button>
                          <button
                            onClick={() => setMediaType("photo")}
                            className={`flex-1 px-3 py-2.5 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                              mediaType === "photo"
                                ? "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                                : "border-border hover:border-green-300"
                            }`}
                          >
                            <Camera className="h-4 w-4" />
                            <span className="font-medium text-sm">Foto</span>
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Tipo Copy</Label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCopyType("short")}
                            className={`flex-1 px-3 py-2.5 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                              copyType === "short"
                                ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300"
                                : "border-border hover:border-orange-300"
                            }`}
                          >
                            <FileTextIcon className="h-4 w-4" />
                            <span className="font-medium text-sm">Corto</span>
                          </button>
                          <button
                            onClick={() => setCopyType("long")}
                            className={`flex-1 px-3 py-2.5 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                              copyType === "long"
                                ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300"
                                : "border-border hover:border-purple-300"
                            }`}
                          >
                            <AlignLeft className="h-4 w-4" />
                            <span className="font-medium text-sm">Lungo</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Number of ideas - compact */}
                    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <Label className="text-sm font-medium whitespace-nowrap">Numero Idee:</Label>
                      <Slider
                        value={[ideaCount]}
                        onValueChange={(value) => setIdeaCount(value[0])}
                        min={1}
                        max={5}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-lg font-bold text-purple-600 dark:text-purple-400 min-w-[2rem] text-center">{ideaCount}</span>
                    </div>
                  </CardContent>
                  </div>
                </div>
              </Card>

              {/* Step 3: Advanced Options (Collapsed by default) */}
              <Card className="overflow-hidden">
                <button
                  onClick={() => toggleSection("advanced")}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 hover:from-slate-100 hover:to-gray-100 dark:hover:from-slate-950/40 dark:hover:to-gray-950/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-500 flex items-center justify-center text-white font-bold text-sm">
                      <Cog className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-foreground">Opzioni Avanzate</h3>
                      <p className="text-xs text-muted-foreground">Livelli di consapevolezza e sofisticazione</p>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedSections.has("advanced") ? "rotate-180" : ""}`} />
                </button>
                
                <div
                  className={`grid transition-all duration-300 ease-in-out ${expandedSections.has("advanced") ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                  <CardContent className="pt-4 space-y-5">
                    {/* AI Suggest Button */}
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSuggestLevels}
                        disabled={isSuggestingLevels || (!topic && !targetAudience)}
                        className="gap-2"
                      >
                        {isSuggestingLevels ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                        AI Suggerisci Livelli
                      </Button>
                    </div>

                    {/* Awareness Level - Compact Pills with Tooltips */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Livello di Consapevolezza</Label>
                      <TooltipProvider delayDuration={200}>
                        <div className="flex flex-wrap gap-2">
                          {AWARENESS_LEVELS.map((level) => {
                            const isSelected = awarenessLevel === level.value;
                            const colorMap: Record<string, string> = {
                              red: isSelected ? "bg-red-500 text-white" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
                              orange: isSelected ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
                              yellow: isSelected ? "bg-yellow-500 text-white" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
                              blue: isSelected ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                              green: isSelected ? "bg-green-500 text-white" : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
                            };
                            return (
                              <Tooltip key={level.value}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => setAwarenessLevel(level.value as any)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${colorMap[level.color]} ${isSelected ? "shadow-md ring-2 ring-offset-2 ring-offset-background" : "hover:opacity-80"}`}
                                    style={{ ["--tw-ring-color" as any]: isSelected ? `var(--${level.color}-500)` : undefined }}
                                  >
                                    {level.label}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs">
                                  <p className="font-medium">{level.label}</p>
                                  <p className="text-muted-foreground text-xs">{level.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </TooltipProvider>
                    </div>

                    {/* Sophistication Level - Compact Pills with Tooltips */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Sofisticazione Mercato (Schwartz)</Label>
                      <TooltipProvider delayDuration={200}>
                        <div className="flex flex-wrap gap-2">
                          {SOPHISTICATION_LEVELS.map((level) => {
                            const isSelected = sophisticationLevel === level.value;
                            const colorMap: Record<string, string> = {
                              emerald: isSelected ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                              blue: isSelected ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                              purple: isSelected ? "bg-purple-500 text-white" : "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
                              orange: isSelected ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
                              pink: isSelected ? "bg-pink-500 text-white" : "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
                            };
                            return (
                              <Tooltip key={level.value}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => setSophisticationLevel(level.value as any)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${colorMap[level.color]} ${isSelected ? "shadow-md ring-2 ring-offset-2 ring-offset-background" : "hover:opacity-80"}`}
                                  >
                                    {level.label.split(" - ")[0]}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs">
                                  <p className="font-medium">{level.label}</p>
                                  <p className="text-muted-foreground text-xs">{level.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </TooltipProvider>
                    </div>

                    {/* Additional Context */}
                    <div className="space-y-2">
                      <Label htmlFor="additionalContext" className="text-sm font-medium">Contesto Aggiuntivo (opzionale)</Label>
                      <Textarea
                        id="additionalContext"
                        placeholder="Stagionalità, eventi, informazioni extra sul tuo brand..."
                        value={additionalContext}
                        onChange={(e) => setAdditionalContext(e.target.value)}
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                  </CardContent>
                  </div>
                </div>
              </Card>

              {/* Action Buttons - Sticky Bottom */}
              <Card className="sticky bottom-4 z-10 shadow-lg border-2 border-purple-200 dark:border-purple-800">
                <CardContent className="py-3 px-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={handleGenerateIdeas}
                      disabled={isGenerating || !topic || !targetAudience || !objective}
                      size="lg"
                      className="flex-1 sm:flex-none bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-5 w-5 mr-2" />
                      )}
                      {isGenerating ? "Generazione..." : "Genera Idee"}
                    </Button>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSaveTemplateDialog(true)}
                        disabled={!topic && !targetAudience}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Salva
                      </Button>
                      
                      {templates.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <FolderOpen className="h-4 w-4 mr-1" />
                              Carica
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
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  Le Tue Idee ({filteredAndSortedIdeas.length})
                </h2>
                
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Ordina per" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="score-desc">Score (alto-basso)</SelectItem>
                      <SelectItem value="date-desc">Data (recente)</SelectItem>
                      <SelectItem value="content-type">Tipo contenuto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {STATUS_FILTERS.map((filter) => {
                  const FilterIcon = filter.icon;
                  const isActive = statusFilter === filter.value;
                  const count = filter.value === "all" 
                    ? ideas.length 
                    : filter.value === "developed"
                      ? ideas.filter(i => i.status === "developed" || i.developedPostId).length
                      : ideas.filter(i => i.status === filter.value && !i.developedPostId).length;
                  return (
                    <button
                      key={filter.value}
                      onClick={() => setStatusFilter(filter.value)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                        isActive
                          ? filter.value === "developed"
                            ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md"
                            : filter.value === "in_progress"
                              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md"
                              : filter.value === "archived"
                                ? "bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-md"
                                : filter.value === "new"
                                  ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md"
                                  : "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      }`}
                    >
                      <FilterIcon className="h-4 w-4" />
                      {filter.label}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-muted-foreground/20"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-xs text-muted-foreground self-center mr-2">Tipo:</span>
                <button
                  onClick={() => toggleFilter("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeFilters.has("all")
                      ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  Tutti
                </button>
                <button
                  onClick={() => toggleFilter("video")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                    activeFilters.has("video")
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  <Video className="h-3 w-3" />
                  Video
                </button>
                <button
                  onClick={() => toggleFilter("photo")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                    activeFilters.has("photo")
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  <Camera className="h-3 w-3" />
                  Foto
                </button>
                <button
                  onClick={() => toggleFilter("long")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                    activeFilters.has("long")
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  <AlignLeft className="h-3 w-3" />
                  Lungo
                </button>
                <button
                  onClick={() => toggleFilter("short")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                    activeFilters.has("short")
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  <FileTextIcon className="h-3 w-3" />
                  Corto
                </button>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-5 space-y-4">
                        <div className="flex gap-2">
                          <Skeleton className="h-6 w-16 rounded-full" />
                          <Skeleton className="h-6 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-16 w-full" />
                        <div className="flex gap-2">
                          <Skeleton className="h-9 flex-1" />
                          <Skeleton className="h-9 flex-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredAndSortedIdeas.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredAndSortedIdeas.map((idea) => {
                    const statusInfo = getStatusInfo(idea.status, idea.developedPostId);
                    const StatusIcon = statusInfo.icon;
                    const isDeveloped = idea.developedPostId || idea.status === "developed";
                    const isArchived = idea.status === "archived";
                    
                    return (
                    <motion.div
                      key={idea.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02, y: -4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className={`h-full overflow-hidden hover:shadow-lg transition-shadow duration-300 group ${statusInfo.cardClass} ${isArchived ? "opacity-70" : ""}`}>
                        <CardContent className="p-5 flex flex-col h-full">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex flex-wrap gap-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                                <StatusIcon className="h-3 w-3" />
                                {statusInfo.label}
                              </span>
                              {idea.mediaType && (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  idea.mediaType === "video"
                                    ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                                    : "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                                }`}>
                                  {idea.mediaType === "video" ? (
                                    <><Video className="h-3 w-3" /> Video</>
                                  ) : (
                                    <><Camera className="h-3 w-3" /> Foto</>
                                  )}
                                </span>
                              )}
                              {idea.copyType && (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  idea.copyType === "long"
                                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                                    : "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
                                }`}>
                                  {idea.copyType === "long" ? (
                                    <><AlignLeft className="h-3 w-3" /> Lungo</>
                                  ) : (
                                    <><FileTextIcon className="h-3 w-3" /> Corto</>
                                  )}
                                </span>
                              )}
                            </div>
                            
                            <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${
                              (idea.aiScore || 0) >= 85 
                                ? "bg-gradient-to-br from-green-400 to-green-600 text-white" 
                                : (idea.aiScore || 0) >= 70 
                                  ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white" 
                                  : (idea.aiScore || 0) > 0
                                    ? "bg-gradient-to-br from-red-400 to-red-600 text-white"
                                    : "bg-gradient-to-br from-slate-300 to-slate-400 text-white"
                            }`}>
                              {idea.aiScore || "-"}
                            </div>
                          </div>

                          <h3 className="font-semibold text-base mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                            {idea.title}
                          </h3>

                          {idea.lengthWarning && (
                            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded flex items-center gap-1 mb-3">
                              <AlertTriangle className="h-3 w-3" />
                              {idea.lengthWarning}
                            </div>
                          )}

                          {idea.hook && (
                            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 p-3 rounded-lg mb-3 flex-grow">
                              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                Hook
                              </p>
                              <p className="text-sm italic text-muted-foreground line-clamp-3">"{idea.hook}"</p>
                            </div>
                          )}
                          
                          {!idea.hook && idea.description && (
                            <p className="text-sm text-muted-foreground line-clamp-3 mb-3 flex-grow">
                              {idea.description}
                            </p>
                          )}

                          {isDeveloped && idea.developedPostId && (
                            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-2 mb-3">
                              <button
                                onClick={() => handleGoToPost(idea.developedPostId!)}
                                className="w-full flex items-center justify-center gap-2 text-green-600 dark:text-green-400 font-medium text-sm hover:text-green-700 dark:hover:text-green-300 transition-colors"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Vai al Post
                              </button>
                            </div>
                          )}

                          <div className="flex gap-2 mt-auto pt-3 border-t">
                            {isDeveloped ? (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="flex-1 border-green-300 text-green-600 hover:bg-green-50"
                                onClick={() => idea.developedPostId && handleGoToPost(idea.developedPostId)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Post Creato
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                                onClick={() => handleDevelopPost(idea)}
                              >
                                <Zap className="h-4 w-4 mr-1" />
                                Sviluppa
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex-1"
                              onClick={() => setViewingIdea(idea)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Visualizza
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleStatusChange(idea.id, "new")} disabled={idea.status === "new"}>
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  Segna come Nuova
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(idea.id, "in_progress")} disabled={idea.status === "in_progress"}>
                                  <Clock className="h-4 w-4 mr-2" />
                                  In Lavorazione
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(idea.id, "archived")} disabled={idea.status === "archived"}>
                                  <Archive className="h-4 w-4 mr-2" />
                                  Archivia
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
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
                        </CardContent>
                      </Card>
                    </motion.div>
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
              </ul>
            </div>
            <Button onClick={handleSaveTemplate} disabled={!templateName.trim()} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Salva Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLevelsSuggestionDialog} onOpenChange={setShowLevelsSuggestionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-purple-500" />
              Livelli Suggeriti dall'AI
            </DialogTitle>
          </DialogHeader>
          {levelsSuggestion && (
            <div className="space-y-6 py-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-orange-500" />
                  <h4 className="font-semibold">Livello di Consapevolezza</h4>
                </div>
                <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                  <p className="font-medium text-orange-700 dark:text-orange-300 mb-2">
                    {AWARENESS_LEVELS.find(l => l.value === levelsSuggestion.awarenessLevel)?.label || levelsSuggestion.awarenessLevel}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {levelsSuggestion.awarenessReason}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-500" />
                  <h4 className="font-semibold">Livello di Sofisticazione</h4>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <p className="font-medium text-purple-700 dark:text-purple-300 mb-2">
                    {SOPHISTICATION_LEVELS.find(l => l.value === levelsSuggestion.sophisticationLevel)?.label || levelsSuggestion.sophisticationLevel}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {levelsSuggestion.sophisticationReason}
                  </p>
                </div>
              </div>

              <Button 
                onClick={() => setShowLevelsSuggestionDialog(false)} 
                className="w-full"
              >
                Ho capito, grazie!
              </Button>
            </div>
          )}
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

      <Dialog open={!!viewingIdea} onOpenChange={(open) => !open && setViewingIdea(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-500" />
              Dettagli Idea
            </DialogTitle>
          </DialogHeader>
          {viewingIdea && (() => {
            const viewStatusInfo = getStatusInfo(viewingIdea.status, viewingIdea.developedPostId);
            const ViewStatusIcon = viewStatusInfo.icon;
            const isViewDeveloped = viewingIdea.developedPostId || viewingIdea.status === "developed";
            
            return (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${viewStatusInfo.color}`}>
                  <ViewStatusIcon className="h-4 w-4" />
                  {viewStatusInfo.label}
                </span>
                {viewingIdea.mediaType && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                    viewingIdea.mediaType === "video"
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                      : "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                  }`}>
                    {viewingIdea.mediaType === "video" ? (
                      <><Video className="h-4 w-4" /> Video</>
                    ) : (
                      <><Camera className="h-4 w-4" /> Foto</>
                    )}
                  </span>
                )}
                {viewingIdea.copyType && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                    viewingIdea.copyType === "long"
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                      : "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
                  }`}>
                    {viewingIdea.copyType === "long" ? (
                      <><AlignLeft className="h-4 w-4" /> Copy Lungo</>
                    ) : (
                      <><FileTextIcon className="h-4 w-4" /> Copy Corto</>
                    )}
                  </span>
                )}
                <div className={`flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-bold ${
                  (viewingIdea.score || 0) >= 85 
                    ? "bg-gradient-to-br from-green-400 to-green-600 text-white" 
                    : (viewingIdea.score || 0) >= 70 
                      ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white" 
                      : "bg-gradient-to-br from-red-400 to-red-600 text-white"
                }`}>
                  Score: {viewingIdea.score || 0}
                </div>
              </div>

              {isViewDeveloped && viewingIdea.developedPostId && (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Questa idea è stata sviluppata in un post</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-300 text-green-600 hover:bg-green-100"
                      onClick={() => {
                        handleGoToPost(viewingIdea.developedPostId!);
                        setViewingIdea(null);
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Vai al Post
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold mb-2">{viewingIdea.title}</h3>
                {viewingIdea.description && (
                  <p className="text-muted-foreground">{viewingIdea.description}</p>
                )}
              </div>

              {viewingIdea.hook && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 p-4 rounded-xl">
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Hook
                  </p>
                  <p className="text-lg italic">"{viewingIdea.hook}"</p>
                </div>
              )}

              {viewingIdea.mediaType === "video" && viewingIdea.videoScript && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Video className="h-5 w-5" />
                    <span className="font-semibold">Script Video</span>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                    <p className="whitespace-pre-wrap leading-relaxed">{viewingIdea.videoScript}</p>
                  </div>
                </div>
              )}

              {viewingIdea.mediaType === "photo" && (viewingIdea.imageDescription || viewingIdea.imageOverlayText) && (
                <div className="space-y-4">
                  {viewingIdea.imageDescription && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <Camera className="h-5 w-5" />
                        <span className="font-semibold">Descrizione Immagine</span>
                      </div>
                      <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                        <p>{viewingIdea.imageDescription}</p>
                      </div>
                    </div>
                  )}
                  {viewingIdea.imageOverlayText && (
                    <div className="space-y-2">
                      <span className="font-semibold text-green-600 dark:text-green-400">Testo Overlay:</span>
                      <div className="bg-black text-white p-4 rounded-xl text-center font-bold text-lg">
                        "{viewingIdea.imageOverlayText}"
                      </div>
                    </div>
                  )}
                </div>
              )}

              {viewingIdea.copyContent && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                    {viewingIdea.copyType === "long" ? <AlignLeft className="h-5 w-5" /> : <FileTextIcon className="h-5 w-5" />}
                    <span className="font-semibold">
                      {viewingIdea.copyType === "long" ? "Copy Lungo" : "Copy Corto"}
                    </span>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
                    <p className="whitespace-pre-wrap leading-relaxed">{viewingIdea.copyContent}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                {isViewDeveloped ? (
                  <Button 
                    variant="outline"
                    className="flex-1 border-green-300 text-green-600 hover:bg-green-50"
                    onClick={() => {
                      if (viewingIdea.developedPostId) {
                        handleGoToPost(viewingIdea.developedPostId);
                      }
                      setViewingIdea(null);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Vai al Post
                  </Button>
                ) : (
                  <Button 
                    className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                    onClick={() => {
                      handleDevelopPost(viewingIdea);
                      setViewingIdea(null);
                    }}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Sviluppa Post
                  </Button>
                )}
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    deleteIdeaMutation.mutate(viewingIdea.id);
                    setViewingIdea(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Elimina
                </Button>
              </div>
            </div>
          );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
