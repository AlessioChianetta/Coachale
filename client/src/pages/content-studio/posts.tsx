import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Hash,
  Filter,
  ArrowUpDown,
  Check,
  Bookmark,
  Send,
  ThumbsUp,
  Repeat2,
  MoreHorizontal,
  Globe,
  ChevronDown,
  ChevronUp,
  Image,
  Layers,
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  createdAt?: string;
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
}

interface CopyVariation {
  hook: string;
  body: string;
  cta: string;
  hashtags?: string[];
}

interface CarouselSlide {
  title: string;
  content: string;
}

const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  instagram: 2200,
  twitter: 280,
  facebook: 63206,
  linkedin: 3000,
  tiktok: 2200,
};

interface SocialPreviewProps {
  platform: string;
  hook: string;
  body: string;
  cta: string;
}

function formatTextWithHashtags(text: string) {
  if (!text) return null;
  const parts = text.split(/(#\w+)/g);
  return parts.map((part, index) => {
    if (part.startsWith("#")) {
      return (
        <span key={index} className="text-blue-500 font-medium">
          {part}
        </span>
      );
    }
    return part;
  });
}

function SocialPreview({ platform, hook, body, cta }: SocialPreviewProps) {
  const fullText = [hook, body, cta].filter(Boolean).join("\n\n");
  const charCount = fullText.length;
  const twitterLimit = 280;

  if (!platform) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Seleziona una piattaforma per vedere l'anteprima</p>
      </div>
    );
  }

  if (platform === "instagram") {
    return (
      <div className="bg-white dark:bg-zinc-950 rounded-xl border shadow-sm overflow-hidden max-w-sm mx-auto">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-600 text-white text-xs">
                TU
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">il_tuo_brand</p>
              <p className="text-xs text-muted-foreground">Sponsorizzato</p>
            </div>
          </div>
          <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Immagine del post</p>
          </div>
        </div>
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Heart className="h-6 w-6 cursor-pointer hover:text-red-500 transition-colors" />
              <MessageCircle className="h-6 w-6 cursor-pointer" />
              <Send className="h-6 w-6 cursor-pointer" />
            </div>
            <Bookmark className="h-6 w-6 cursor-pointer" />
          </div>
          <p className="text-sm font-semibold">1.234 Mi piace</p>
          <div className="text-sm space-y-1">
            <p>
              <span className="font-semibold">il_tuo_brand</span>{" "}
              {hook && <span className="font-bold">{hook}</span>}
              {hook && body && " "}
              {formatTextWithHashtags(body)}
              {(hook || body) && cta && " "}
              {cta && <span className="font-medium">{cta}</span>}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">2 ore fa</p>
        </div>
      </div>
    );
  }

  if (platform === "facebook") {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border shadow-sm overflow-hidden max-w-md mx-auto">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-blue-600 text-white text-sm">
                TU
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-sm">Il Tuo Brand</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>2 ore fa</span>
                <span>·</span>
                <Globe className="h-3 w-3" />
              </div>
            </div>
            <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-3 text-sm space-y-2">
            {hook && <p className="font-semibold">{hook}</p>}
            {body && <p className="whitespace-pre-wrap">{formatTextWithHashtags(body)}</p>}
            {cta && <p className="font-medium text-blue-600">{cta}</p>}
          </div>
        </div>
        <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Immagine del post</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <ThumbsUp className="h-3 w-3 text-white" />
                </div>
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                  <Heart className="h-3 w-3 text-white" />
                </div>
              </div>
              <span>234</span>
            </div>
            <div className="flex gap-3">
              <span>45 commenti</span>
              <span>12 condivisioni</span>
            </div>
          </div>
          <Separator />
          <div className="flex justify-between">
            <Button variant="ghost" size="sm" className="flex-1 gap-2">
              <ThumbsUp className="h-4 w-4" />
              Mi piace
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 gap-2">
              <MessageCircle className="h-4 w-4" />
              Commenta
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 gap-2">
              <Share2 className="h-4 w-4" />
              Condividi
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (platform === "linkedin") {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl border shadow-sm overflow-hidden max-w-md mx-auto">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-blue-700 text-white text-sm">
                TU
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-sm">Il Tuo Nome</p>
              <p className="text-xs text-muted-foreground">CEO & Founder | Business Coach | Speaker</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <span>2h</span>
                <span>·</span>
                <Globe className="h-3 w-3" />
              </div>
            </div>
            <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-4 text-sm space-y-3">
            {hook && <p className="font-semibold text-base">{hook}</p>}
            {body && <p className="whitespace-pre-wrap leading-relaxed">{formatTextWithHashtags(body)}</p>}
            {cta && <p className="font-medium text-blue-600">{cta}</p>}
          </div>
        </div>
        <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Immagine del post</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex -space-x-1">
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center border-2 border-white dark:border-zinc-900">
                <ThumbsUp className="h-3 w-3 text-white" />
              </div>
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center border-2 border-white dark:border-zinc-900">
                <span className="text-[10px]">👏</span>
              </div>
              <div className="w-5 h-5 rounded-full bg-red-400 flex items-center justify-center border-2 border-white dark:border-zinc-900">
                <Heart className="h-3 w-3 text-white" />
              </div>
            </div>
            <span>1.234 reactions</span>
            <span className="ml-auto">87 comments · 23 reposts</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <Button variant="ghost" size="sm" className="flex-1 gap-2">
              <ThumbsUp className="h-4 w-4" />
              Like
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 gap-2">
              <MessageCircle className="h-4 w-4" />
              Comment
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 gap-2">
              <Repeat2 className="h-4 w-4" />
              Repost
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 gap-2">
              <Send className="h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (platform === "twitter") {
    const isOverLimit = charCount > twitterLimit;
    return (
      <div className="bg-white dark:bg-zinc-950 rounded-xl border shadow-sm overflow-hidden max-w-md mx-auto">
        <div className="p-4">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-sky-500 text-white text-sm">
                TU
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm">Il Tuo Brand</p>
                <p className="text-sm text-muted-foreground">@iltuobrand · 2h</p>
              </div>
              <div className="mt-2 text-sm space-y-2">
                {hook && <p className="font-medium">{hook}</p>}
                {body && <p className="whitespace-pre-wrap">{formatTextWithHashtags(body)}</p>}
                {cta && <p className="text-sky-500">{cta}</p>}
              </div>
              <div className="mt-4 aspect-video rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-900 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Image className="h-8 w-8 mx-auto mb-1 opacity-40" />
                  <p className="text-xs">Immagine</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 text-muted-foreground">
                <div className="flex items-center gap-1 hover:text-sky-500 cursor-pointer">
                  <MessageCircle className="h-4 w-4" />
                  <span className="text-xs">45</span>
                </div>
                <div className="flex items-center gap-1 hover:text-green-500 cursor-pointer">
                  <Repeat2 className="h-4 w-4" />
                  <span className="text-xs">123</span>
                </div>
                <div className="flex items-center gap-1 hover:text-red-500 cursor-pointer">
                  <Heart className="h-4 w-4" />
                  <span className="text-xs">567</span>
                </div>
                <div className="flex items-center gap-1 hover:text-sky-500 cursor-pointer">
                  <Eye className="h-4 w-4" />
                  <span className="text-xs">12K</span>
                </div>
                <div className="flex items-center gap-1">
                  <Bookmark className="h-4 w-4 hover:text-sky-500 cursor-pointer" />
                  <Share2 className="h-4 w-4 hover:text-sky-500 cursor-pointer" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={`px-4 py-2 border-t text-xs flex items-center justify-between ${isOverLimit ? "bg-red-50 dark:bg-red-950" : "bg-muted/30"}`}>
          <span className="text-muted-foreground">Conteggio caratteri:</span>
          <span className={`font-mono font-medium ${isOverLimit ? "text-red-500" : "text-green-600"}`}>
            {charCount} / {twitterLimit}
            {isOverLimit && " ⚠️"}
          </span>
        </div>
      </div>
    );
  }

  if (platform === "tiktok") {
    return (
      <div className="bg-black rounded-xl border shadow-sm overflow-hidden max-w-xs mx-auto">
        <div className="aspect-[9/16] bg-gradient-to-br from-zinc-800 to-zinc-900 relative flex items-center justify-center">
          <div className="text-center text-white/50">
            <Image className="h-12 w-12 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Video TikTok</p>
          </div>
          <div className="absolute right-3 bottom-20 flex flex-col items-center gap-4">
            <div className="text-center">
              <Heart className="h-8 w-8 text-white" />
              <span className="text-xs text-white">12.3K</span>
            </div>
            <div className="text-center">
              <MessageCircle className="h-8 w-8 text-white" />
              <span className="text-xs text-white">234</span>
            </div>
            <div className="text-center">
              <Bookmark className="h-8 w-8 text-white" />
              <span className="text-xs text-white">567</span>
            </div>
            <div className="text-center">
              <Share2 className="h-8 w-8 text-white" />
              <span className="text-xs text-white">89</span>
            </div>
          </div>
          <div className="absolute bottom-4 left-3 right-16 text-white">
            <p className="font-semibold text-sm">@iltuobrand</p>
            <p className="text-xs mt-1 line-clamp-3">
              {hook && <span className="font-bold">{hook} </span>}
              {body && formatTextWithHashtags(body)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-8 text-muted-foreground">
      <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm">Anteprima non disponibile per questa piattaforma</p>
    </div>
  );
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

  const [copyVariations, setCopyVariations] = useState<CopyVariation[]>([]);
  const [showVariationsDialog, setShowVariationsDialog] = useState(false);
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);

  const [isCarouselMode, setIsCarouselMode] = useState(false);
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([
    { title: "", content: "" },
  ]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortPosts, setSortPosts] = useState<string>("date-desc");
  const [showPreview, setShowPreview] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchString = useSearch();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const ideaTitle = params.get("ideaTitle");
    const ideaHook = params.get("ideaHook");
    const ideaDescription = params.get("ideaDescription");

    if (ideaTitle || ideaHook || ideaDescription) {
      setFormData((prev) => ({
        ...prev,
        title: ideaTitle || "",
        hook: ideaHook || "",
        body: ideaDescription || "",
      }));
      setIdeaForCopy(ideaDescription || ideaTitle || "");
      setIsDialogOpen(true);
      toast({
        title: "Idea caricata da Generatore Idee",
        description: "Puoi ora sviluppare il post dalla tua idea",
      });
      setLocation("/consultant/content-studio/posts", { replace: true });
    }
  }, []);

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

  const filteredPosts = useMemo(() => {
    let result = [...posts];

    if (filterPlatform !== "all") {
      result = result.filter(
        (p) => p.platform?.toLowerCase() === filterPlatform.toLowerCase()
      );
    }

    if (filterStatus !== "all") {
      result = result.filter((p) => {
        const status = p.status?.toLowerCase();
        if (filterStatus === "draft") return status === "draft" || status === "bozza";
        if (filterStatus === "scheduled") return status === "scheduled" || status === "programmato";
        if (filterStatus === "published") return status === "published" || status === "pubblicato";
        return true;
      });
    }

    if (sortPosts === "date-desc") {
      result.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.scheduledDate || 0).getTime();
        const dateB = new Date(b.createdAt || b.scheduledDate || 0).getTime();
        return dateB - dateA;
      });
    } else if (sortPosts === "title-asc") {
      result.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    }

    return result;
  }, [posts, filterPlatform, filterStatus, sortPosts]);

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
      setSuggestedHashtags([]);
      resetCarouselState();
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
      const response = await fetch("/api/content/ai/generate-copy-variations", {
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
        throw new Error(error.error || "Failed to generate copy variations");
      }

      const result = await response.json();
      const variations: CopyVariation[] = result.data.variations || [];

      if (variations.length > 0) {
        setCopyVariations(variations);
        setShowVariationsDialog(true);
        const allHashtags = variations.flatMap((v) => v.hashtags || []);
        const uniqueHashtags = [...new Set(allHashtags)];
        setSuggestedHashtags(uniqueHashtags);
      }

      toast({
        title: "Variazioni generate!",
        description: `${variations.length} variazioni create con successo`,
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

  const handleSelectVariation = (variation: CopyVariation) => {
    setFormData((prev) => ({
      ...prev,
      hook: variation.hook || prev.hook,
      body: variation.body || prev.body,
      cta: variation.cta || prev.cta,
    }));
    if (variation.hashtags?.length) {
      setSuggestedHashtags(variation.hashtags);
    }
    setShowVariationsDialog(false);
    toast({
      title: "Variazione selezionata",
      description: "Il copy è stato applicato al form",
    });
  };

  const handleAddHashtag = (hashtag: string) => {
    const hashtagText = hashtag.startsWith("#") ? hashtag : `#${hashtag}`;
    setFormData((prev) => ({
      ...prev,
      body: prev.body ? `${prev.body}\n${hashtagText}` : hashtagText,
    }));
    toast({
      title: "Hashtag aggiunto",
      description: hashtagText,
    });
  };

  const handleAddSlide = () => {
    if (carouselSlides.length >= 10) {
      toast({
        title: "Limite raggiunto",
        description: "Puoi avere massimo 10 slide per carosello",
        variant: "destructive",
      });
      return;
    }
    setCarouselSlides([...carouselSlides, { title: "", content: "" }]);
    setActiveSlideIndex(carouselSlides.length);
  };

  const handleRemoveSlide = (index: number) => {
    if (carouselSlides.length <= 1) {
      toast({
        title: "Impossibile rimuovere",
        description: "Il carosello deve avere almeno una slide",
        variant: "destructive",
      });
      return;
    }
    const newSlides = carouselSlides.filter((_, i) => i !== index);
    setCarouselSlides(newSlides);
    if (activeSlideIndex >= newSlides.length) {
      setActiveSlideIndex(newSlides.length - 1);
    }
  };

  const handleUpdateSlide = (
    index: number,
    field: keyof CarouselSlide,
    value: string
  ) => {
    const newSlides = [...carouselSlides];
    newSlides[index] = { ...newSlides[index], [field]: value };
    setCarouselSlides(newSlides);
  };

  const splitContentIntoSlides = (content: string): CarouselSlide[] => {
    const lines = content.split("\n").filter((line) => line.trim());
    const slides: CarouselSlide[] = [];

    let currentSlide: CarouselSlide = { title: "", content: "" };

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.match(/^[\-\•\*\d\.]\s/) ||
        trimmed.match(/^\d+[\.\)]\s/)
      ) {
        if (currentSlide.title || currentSlide.content) {
          slides.push(currentSlide);
        }
        const cleanedLine = trimmed.replace(/^[\-\•\*\d\.\)]+\s*/, "");
        currentSlide = { title: cleanedLine.slice(0, 50), content: cleanedLine };
      } else if (!currentSlide.title) {
        currentSlide.title = trimmed.slice(0, 50);
        currentSlide.content = trimmed;
      } else {
        currentSlide.content += "\n" + trimmed;
      }
    }

    if (currentSlide.title || currentSlide.content) {
      slides.push(currentSlide);
    }

    if (slides.length === 0) {
      return [{ title: "", content: content }];
    }

    return slides.slice(0, 10);
  };

  const handleConvertToCarouselSlides = () => {
    if (!ideaForCopy && !formData.body) {
      toast({
        title: "Nessun contenuto",
        description: "Genera prima del contenuto AI o inserisci del testo",
        variant: "destructive",
      });
      return;
    }

    const contentToSplit = formData.body || ideaForCopy;
    const newSlides = splitContentIntoSlides(contentToSplit);
    setCarouselSlides(newSlides);
    setActiveSlideIndex(0);
    toast({
      title: "Slide create",
      description: `${newSlides.length} slide generate dal contenuto`,
    });
  };

  const handleCreatePost = () => {
    if (isCarouselMode) {
      const hasContent = carouselSlides.some(
        (slide) => slide.title.trim() || slide.content.trim()
      );
      if (!hasContent) {
        toast({
          title: "Carosello vuoto",
          description: "Aggiungi contenuto ad almeno una slide",
          variant: "destructive",
        });
        return;
      }

      const concatenatedBody = carouselSlides
        .map((slide, idx) => {
          const parts = [];
          if (slide.title) parts.push(`[Slide ${idx + 1}] ${slide.title}`);
          if (slide.content) parts.push(slide.content);
          return parts.join("\n");
        })
        .join("\n\n---\n\n");

      createPostMutation.mutate({
        ...formData,
        body: concatenatedBody,
        contentType: "carousel",
        title: formData.title || `Carosello ${carouselSlides.length} slide`,
      });
    } else {
      if (!formData.title && !formData.hook) {
        toast({
          title: "Campi obbligatori",
          description: "Inserisci almeno un titolo o un hook",
          variant: "destructive",
        });
        return;
      }
      createPostMutation.mutate(formData);
    }
  };

  const resetCarouselState = () => {
    setIsCarouselMode(false);
    setCarouselSlides([{ title: "", content: "" }]);
    setActiveSlideIndex(0);
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

  const getCharacterLimit = () => {
    return PLATFORM_CHAR_LIMITS[formData.platform?.toLowerCase()] || 2200;
  };

  const getCharacterCount = () => {
    return formData.body.length;
  };

  const getCharacterProgress = () => {
    const limit = getCharacterLimit();
    const count = getCharacterCount();
    return Math.min((count / limit) * 100, 100);
  };

  const isOverLimit = () => {
    return getCharacterCount() > getCharacterLimit();
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
                <DialogContent className={`max-h-[90vh] overflow-y-auto ${isCarouselMode ? "max-w-4xl" : "max-w-lg"}`}>
                  <DialogHeader>
                    <DialogTitle>
                      {isCarouselMode ? "Crea Carosello" : "Crea Nuovo Post"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="space-y-2 flex-1">
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

                      <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                        <Layers className="h-5 w-5 text-purple-500" />
                        <div className="flex-1">
                          <Label htmlFor="carousel-mode" className="font-medium cursor-pointer">
                            Modalità Carosello
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Post multi-slide
                          </p>
                        </div>
                        <Switch
                          id="carousel-mode"
                          checked={isCarouselMode}
                          onCheckedChange={(checked) => {
                            setIsCarouselMode(checked);
                            if (checked && carouselSlides.length === 1 && !carouselSlides[0].title && !carouselSlides[0].content) {
                              setCarouselSlides([{ title: "", content: "" }]);
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Genera con AI {isCarouselMode ? "(contenuto per slide)" : "(3 variazioni)"}</Label>
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
                        {isCarouselMode && (formData.body || ideaForCopy) && (
                          <Button
                            variant="secondary"
                            onClick={handleConvertToCarouselSlides}
                            title="Dividi contenuto in slide"
                          >
                            <Layers className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {isCarouselMode && (
                        <p className="text-xs text-muted-foreground">
                          Genera il contenuto AI, poi clicca sull'icona Layers per dividerlo automaticamente in slide
                        </p>
                      )}
                    </div>

                    {isCarouselMode ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-purple-500" />
                            Slide del Carosello ({carouselSlides.length}/10)
                          </Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAddSlide}
                            disabled={carouselSlides.length >= 10}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Aggiungi Slide
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-1">
                            <ScrollArea className="h-[300px] rounded-lg border bg-muted/20 p-2">
                              <div className="space-y-2">
                                {carouselSlides.map((slide, index) => (
                                  <div
                                    key={index}
                                    className={`relative p-3 rounded-lg border cursor-pointer transition-all ${
                                      activeSlideIndex === index
                                        ? "border-purple-500 bg-purple-500/10 shadow-sm"
                                        : "border-border hover:border-purple-300 bg-background"
                                    }`}
                                    onClick={() => setActiveSlideIndex(index)}
                                  >
                                    <div className="flex items-start gap-2">
                                      <div
                                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                          activeSlideIndex === index
                                            ? "bg-purple-500 text-white"
                                            : "bg-muted text-muted-foreground"
                                        }`}
                                      >
                                        {index + 1}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">
                                          {slide.title || `Slide ${index + 1}`}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                                          {slide.content?.slice(0, 40) || "Nessun contenuto"}
                                          {slide.content?.length > 40 ? "..." : ""}
                                        </p>
                                      </div>
                                      {carouselSlides.length > 1 && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 opacity-50 hover:opacity-100 hover:text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveSlide(index);
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>

                          <div className="md:col-span-2 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={activeSlideIndex === 0}
                                  onClick={() => setActiveSlideIndex(activeSlideIndex - 1)}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm font-medium">
                                  Slide {activeSlideIndex + 1} di {carouselSlides.length}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={activeSlideIndex === carouselSlides.length - 1}
                                  onClick={() => setActiveSlideIndex(activeSlideIndex + 1)}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-3 p-4 rounded-lg border bg-background">
                              <div className="space-y-2">
                                <Label htmlFor="slide-title">Titolo Slide</Label>
                                <Input
                                  id="slide-title"
                                  placeholder="Titolo della slide..."
                                  value={carouselSlides[activeSlideIndex]?.title || ""}
                                  onChange={(e) =>
                                    handleUpdateSlide(activeSlideIndex, "title", e.target.value)
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="slide-content">Contenuto Slide</Label>
                                <Textarea
                                  id="slide-content"
                                  placeholder="Testo della slide..."
                                  rows={6}
                                  value={carouselSlides[activeSlideIndex]?.content || ""}
                                  onChange={(e) =>
                                    handleUpdateSlide(activeSlideIndex, "content", e.target.value)
                                  }
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">
                                Anteprima Miniature
                              </Label>
                              <div className="flex gap-2 flex-wrap">
                                {carouselSlides.map((slide, idx) => (
                                  <div
                                    key={idx}
                                    className={`w-12 h-12 rounded border flex items-center justify-center text-xs font-bold cursor-pointer transition-all ${
                                      idx === activeSlideIndex
                                        ? "border-purple-500 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                                        : slide.title || slide.content
                                        ? "border-green-300 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                        : "border-dashed border-muted-foreground/30 text-muted-foreground"
                                    }`}
                                    onClick={() => setActiveSlideIndex(idx)}
                                    title={slide.title || `Slide ${idx + 1}`}
                                  >
                                    {idx + 1}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
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
                          {formData.platform && (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span
                                  className={
                                    isOverLimit()
                                      ? "text-red-500 font-medium"
                                      : "text-green-600"
                                  }
                                >
                                  {getCharacterCount()} / {getCharacterLimit()} caratteri
                                </span>
                                {isOverLimit() && (
                                  <span className="text-red-500 text-xs">
                                    Limite superato!
                                  </span>
                                )}
                              </div>
                              <Progress
                                value={getCharacterProgress()}
                                className={`h-1 ${
                                  isOverLimit() ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"
                                }`}
                              />
                            </div>
                          )}
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
                      </>
                    )}

                    {suggestedHashtags.length > 0 && (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          Hashtag Suggeriti
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {suggestedHashtags.map((hashtag, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                              onClick={() => handleAddHashtag(hashtag)}
                            >
                              {hashtag.startsWith("#") ? hashtag : `#${hashtag}`}
                              <Plus className="h-3 w-3 ml-1" />
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Clicca su un hashtag per aggiungerlo al corpo del post
                        </p>
                      </div>
                    )}

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

                    <Collapsible open={showPreview} onOpenChange={setShowPreview}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                          type="button"
                        >
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            Anteprima Social
                          </div>
                          {showPreview ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4">
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="flex items-center gap-2 mb-4">
                            {formData.platform && (
                              <>
                                {formData.platform === "instagram" && (
                                  <Instagram className="h-4 w-4 text-pink-500" />
                                )}
                                {formData.platform === "facebook" && (
                                  <Facebook className="h-4 w-4 text-blue-600" />
                                )}
                                {formData.platform === "linkedin" && (
                                  <Linkedin className="h-4 w-4 text-blue-700" />
                                )}
                                {formData.platform === "twitter" && (
                                  <Twitter className="h-4 w-4 text-sky-500" />
                                )}
                                {formData.platform === "tiktok" && (
                                  <span className="text-sm">🎵</span>
                                )}
                              </>
                            )}
                            <span className="text-sm font-medium">
                              {formData.platform
                                ? `Anteprima ${formData.platform.charAt(0).toUpperCase() + formData.platform.slice(1)}`
                                : "Seleziona una piattaforma"}
                            </span>
                          </div>
                          <SocialPreview
                            platform={formData.platform}
                            hook={formData.hook}
                            body={formData.body}
                            cta={formData.cta}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

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

            <Dialog open={showVariationsDialog} onOpenChange={setShowVariationsDialog}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                    Scegli una Variazione
                  </DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="0" className="mt-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="0">Variazione 1</TabsTrigger>
                    <TabsTrigger value="1">Variazione 2</TabsTrigger>
                    <TabsTrigger value="2">Variazione 3</TabsTrigger>
                  </TabsList>
                  {copyVariations.map((variation, idx) => (
                    <TabsContent key={idx} value={String(idx)} className="space-y-4">
                      <Card>
                        <CardContent className="p-4 space-y-3">
                          <div>
                            <Label className="text-xs text-muted-foreground">Hook</Label>
                            <p className="text-sm font-medium mt-1">{variation.hook}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Body</Label>
                            <p className="text-sm mt-1 whitespace-pre-wrap">{variation.body}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">CTA</Label>
                            <p className="text-sm font-medium mt-1">{variation.cta}</p>
                          </div>
                          {variation.hashtags && variation.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {variation.hashtags.map((tag, tagIdx) => (
                                <Badge key={tagIdx} variant="secondary" className="text-xs">
                                  {tag.startsWith("#") ? tag : `#${tag}`}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <Button
                            className="w-full mt-4"
                            onClick={() => handleSelectVariation(variation)}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Usa questa variazione
                          </Button>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  ))}
                </Tabs>
              </DialogContent>
            </Dialog>

            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filtri:</span>
                  </div>
                  <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Piattaforma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="twitter">Twitter/X</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      <SelectItem value="draft">Bozza</SelectItem>
                      <SelectItem value="scheduled">Programmato</SelectItem>
                      <SelectItem value="published">Pubblicato</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 ml-auto">
                    <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                    <Select value={sortPosts} onValueChange={setSortPosts}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Ordina per" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date-desc">Data recente</SelectItem>
                        <SelectItem value="title-asc">Titolo A-Z</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

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
            ) : filteredPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPosts.map((post) => (
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
                  <h3 className="font-semibold mb-2">
                    {posts.length === 0
                      ? "Nessun post creato"
                      : "Nessun post corrisponde ai filtri"}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {posts.length === 0
                      ? "Crea il tuo primo post cliccando il pulsante \"Nuovo Post\""
                      : "Prova a modificare i filtri per vedere altri post"}
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
