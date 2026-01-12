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
  DialogDescription,
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
  Video,
  Link,
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
  ideaId?: string;
  copyType?: string;
  mediaType?: string;
  chiCosaCome?: string;
  errore?: string;
  soluzione?: string;
  riprovaSociale?: string;
  videoHook?: string;
  videoProblema?: string;
  videoSoluzione?: string;
  videoCta?: string;
  videoFullScript?: string;
  imageDescription?: string;
  imageOverlayText?: string;
  structuredContent?: {
    copyType?: string;
    mediaType?: string;
    hook?: string;
    body?: string;
    cta?: string;
    chiCosaCome?: string;
    errore?: string;
    soluzione?: string;
    riprovaSociale?: string;
    videoHook?: string;
    videoProblema?: string;
    videoSoluzione?: string;
    videoCta?: string;
    videoFullScript?: string;
    imageDescription?: string;
    imageOverlayText?: string;
  };
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
}

type CopyOutputType = "copy_short" | "copy_long" | "video_script" | "image_copy";

interface VideoScriptSegment {
  timing: string;
  visual: string;
  voiceover: string;
}

interface ShortCopyVariation {
  outputType: "copy_short";
  hook: string;
  cta: string;
  hashtags?: string[];
}

interface LongCopyVariation {
  outputType: "copy_long";
  hook: string;
  chiCosaCome: string;
  errore: string;
  soluzione: string;
  riprovaSociale: string;
  cta: string;
  hashtags?: string[];
}

interface VideoScriptVariation {
  outputType: "video_script";
  segments: VideoScriptSegment[];
  hashtags?: string[];
}

interface ImageCopyVariation {
  outputType: "image_copy";
  imageText: string;
  subtitle: string;
  conceptDescription: string;
  hashtags?: string[];
}

type CopyVariation = ShortCopyVariation | LongCopyVariation | VideoScriptVariation | ImageCopyVariation;

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
  copyType?: "short" | "long";
  chiCosaCome?: string;
  errore?: string;
  soluzione?: string;
  riprovaSociale?: string;
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

function SocialPreview({ platform, hook, body, cta, copyType, chiCosaCome, errore, soluzione, riprovaSociale }: SocialPreviewProps) {
  // Build body content based on copy type
  let displayBody = body;
  if (copyType === "long") {
    const longCopyParts = [
      chiCosaCome,
      errore,
      soluzione,
      riprovaSociale,
    ].filter(Boolean);
    if (longCopyParts.length > 0) {
      displayBody = longCopyParts.join("\n\n");
    }
  }
  
  const fullText = [hook, displayBody, cta].filter(Boolean).join("\n\n");
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
              {hook && displayBody && " "}
              {formatTextWithHashtags(displayBody)}
              {(hook || displayBody) && cta && " "}
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
            {displayBody && <p className="whitespace-pre-wrap">{formatTextWithHashtags(displayBody)}</p>}
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
            {displayBody && <p className="whitespace-pre-wrap leading-relaxed">{formatTextWithHashtags(displayBody)}</p>}
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
                {displayBody && <p className="whitespace-pre-wrap">{formatTextWithHashtags(displayBody)}</p>}
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
              {displayBody && formatTextWithHashtags(displayBody)}
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
    chiCosaCome: "",
    errore: "",
    soluzione: "",
    riprovaSociale: "",
    videoHook: "",
    videoProblema: "",
    videoSoluzione: "",
    videoCta: "",
    videoFullScript: "",
    videoUrl: "",
    imageDescription: "",
    imageOverlayText: "",
  });
  const [ideaForCopy, setIdeaForCopy] = useState("");
  const [sourceIdeaId, setSourceIdeaId] = useState<string | null>(null);
  const [sourceIdeaTitle, setSourceIdeaTitle] = useState<string | null>(null);
  const [copyTypeFromIdea, setCopyTypeFromIdea] = useState<boolean>(false);
  const [mediaTypeFromIdea, setMediaTypeFromIdea] = useState<boolean>(false);

  const [copyVariations, setCopyVariations] = useState<CopyVariation[]>([]);
  const [showVariationsDialog, setShowVariationsDialog] = useState(false);
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  const [selectedCopyType, setSelectedCopyType] = useState<"short" | "long">("long");
  const [selectedMediaType, setSelectedMediaType] = useState<"video" | "foto">("foto");
  const [videoSectionOpen, setVideoSectionOpen] = useState(true);
  const [imageSectionOpen, setImageSectionOpen] = useState(true);

  const [isCarouselMode, setIsCarouselMode] = useState(false);
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([
    { title: "", content: "" },
  ]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortPosts, setSortPosts] = useState<string>("date-desc");
  const [showPreview, setShowPreview] = useState(false);

  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [viewingPost, setViewingPost] = useState<Post | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchString = useSearch();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const ideaId = params.get("ideaId");

    if (!ideaId) return;

    const fetchIdea = async () => {
      try {
        const response = await fetch(`/api/content/ideas/${ideaId}`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) {
          throw new Error("Failed to fetch idea");
        }
        const result = await response.json();
        const idea = result.data;
        
        if (!idea) {
          toast({
            title: "Errore",
            description: "Idea non trovata",
            variant: "destructive",
          });
          return;
        }

        setSourceIdeaId(idea.id);
        setSourceIdeaTitle(idea.title || null);

        const structured = idea.structuredContent;
        const ideaCopyType = idea.copyType || (structured?.type === "copy_long" ? "long" : structured?.type === "copy_short" ? "short" : null);
        const ideaMediaType = idea.mediaType as "video" | "foto" | null;

        // Set copy type from idea (or default to long)
        if (ideaCopyType === "long" || ideaCopyType === "short") {
          setSelectedCopyType(ideaCopyType);
          setCopyTypeFromIdea(true);
        } else if (structured?.type === "copy_long") {
          setSelectedCopyType("long");
          setCopyTypeFromIdea(true);
        } else if (structured?.type === "copy_short") {
          setSelectedCopyType("short");
          setCopyTypeFromIdea(true);
        }

        // Set media type from idea (or default to foto)
        if (ideaMediaType === "video" || ideaMediaType === "foto") {
          setSelectedMediaType(ideaMediaType);
          setMediaTypeFromIdea(true);
        } else if (idea.videoScript) {
          setSelectedMediaType("video");
          setMediaTypeFromIdea(true);
        } else if (idea.imageDescription) {
          setSelectedMediaType("foto");
          setMediaTypeFromIdea(true);
        }

        // Build complete form data with ALL fields populated
        const newFormData: Partial<typeof formData> = {
          title: idea.title || "",
          hook: structured?.hook || idea.hook || "",
          body: idea.description || "",
          cta: structured?.cta || "",
        };

        // Populate copy_long fields if available
        if (structured?.type === "copy_long" || ideaCopyType === "long") {
          // Check if structured content has the separated fields
          const hasStructuredLongCopy = structured?.chiCosaCome || structured?.errore || structured?.soluzione || structured?.riprovaSociale;
          
          if (hasStructuredLongCopy) {
            // Use separated fields from structured content
            newFormData.chiCosaCome = structured?.chiCosaCome || "";
            newFormData.errore = structured?.errore || "";
            newFormData.soluzione = structured?.soluzione || "";
            newFormData.riprovaSociale = structured?.riprovaSociale || "";
          } else if (idea.copyContent) {
            // Fallback: use copyContent as the full body text
            // The user can see it and manually edit into structured fields if needed
            newFormData.body = idea.copyContent;
          }
        }

        // Populate copy_short body if available
        if (structured?.type === "copy_short" || ideaCopyType === "short") {
          newFormData.body = structured?.body || idea.copyContent || idea.description || "";
        }
        
        // Always ensure body has content from copyContent if not already set
        if (!newFormData.body && idea.copyContent) {
          newFormData.body = idea.copyContent;
        }

        // Populate video script fields (from structuredContent.videoScript or idea.videoScript)
        const videoData = structured?.videoScript || (structured?.type === "video_script" ? structured : null);
        if (videoData || idea.videoScript) {
          newFormData.videoHook = videoData?.hook || structured?.hook || idea.hook || "";
          newFormData.videoProblema = videoData?.problema || structured?.problema || "";
          newFormData.videoSoluzione = videoData?.soluzione || structured?.soluzione || "";
          newFormData.videoCta = videoData?.cta || structured?.cta || "";
          newFormData.videoFullScript = videoData?.fullScript || structured?.fullScript || idea.videoScript || "";
        }

        // Populate image description fields
        if (idea.imageDescription || idea.imageOverlayText) {
          newFormData.imageDescription = idea.imageDescription || "";
          newFormData.imageOverlayText = idea.imageOverlayText || "";
        }

        setFormData((prev) => ({
          ...prev,
          ...newFormData,
        }));

        setIdeaForCopy(idea.copyContent || idea.description || idea.title || "");
        setIsDialogOpen(true);
        toast({
          title: "Idea caricata",
          description: `Ora puoi sviluppare il post da "${idea.title}"`,
        });
        setLocation("/consultant/content-studio/posts", { replace: true });
      } catch (error: any) {
        toast({
          title: "Errore",
          description: error.message || "Impossibile caricare l'idea",
          variant: "destructive",
        });
      }
    };

    fetchIdea();
  }, [searchString]);

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
    mutationFn: async (post: Partial<Post> & { id?: string }) => {
      const isEditing = !!editingPost;
      const url = isEditing ? `/api/content/posts/${editingPost.id}` : "/api/content/posts";
      const method = isEditing ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(post),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${isEditing ? "update" : "create"} post`);
      }
      return response.json();
    },
    onSuccess: () => {
      const isEditing = !!editingPost;
      toast({
        title: isEditing ? "Post aggiornato" : "Post creato",
        description: isEditing ? "Il post è stato aggiornato con successo" : "Il post è stato creato con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/posts"] });
      setIsDialogOpen(false);
      setEditingPost(null);
      setFormData({ title: "", hook: "", body: "", cta: "", platform: "", status: "draft", chiCosaCome: "", errore: "", soluzione: "", riprovaSociale: "", videoHook: "", videoProblema: "", videoSoluzione: "", videoCta: "", videoFullScript: "", videoUrl: "", imageDescription: "", imageOverlayText: "" });
      setSuggestedHashtags([]);
      resetCarouselState();
      setCopyTypeFromIdea(false);
      setMediaTypeFromIdea(false);
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

    const outputType = selectedCopyType === "long" ? "copy_long" : "copy_short";

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
          outputType: outputType,
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
        description: `${variations.length} variazioni ${getCopyTypeLabel(selectedCopyType)} create con successo`,
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

  const getCopyTypeLabel = (type: "short" | "long"): string => {
    switch (type) {
      case "short": return "Copy Corto";
      case "long": return "Copy Lungo";
      default: return "Copy";
    }
  };

  const getOutputTypeLabel = (type: CopyOutputType): string => {
    switch (type) {
      case "copy_short": return "Copy Corto";
      case "copy_long": return "Copy Lungo";
      case "video_script": return "Script Video";
      case "image_copy": return "Copy Immagine";
      default: return "Copy";
    }
  };

  const handleSelectVariation = (variation: CopyVariation) => {
    const updates: Partial<typeof formData> = {};
    
    switch (variation.outputType) {
      case "copy_short":
        updates.hook = variation.hook || "";
        updates.body = variation.body || "";
        updates.cta = variation.cta || "";
        break;
      case "copy_long":
        updates.hook = variation.hook || "";
        updates.chiCosaCome = variation.chiCosaCome || "";
        updates.errore = variation.errore || "";
        updates.soluzione = variation.soluzione || "";
        updates.riprovaSociale = variation.riprovaSociale || "";
        updates.cta = variation.cta || "";
        break;
      case "video_script":
        updates.videoHook = variation.segments?.[0]?.voiceover || variation.hook || "";
        updates.videoProblema = variation.segments?.[1]?.voiceover || "";
        updates.videoSoluzione = variation.segments?.[2]?.voiceover || "";
        updates.videoCta = variation.segments?.[variation.segments.length - 1]?.voiceover || "";
        updates.videoFullScript = variation.segments?.map(s => 
          `[${s.timing}]\n🎬 ${s.visual}\n🎤 ${s.voiceover}`
        ).join("\n\n") || "";
        break;
      case "image_copy":
        updates.imageDescription = variation.conceptDescription || "";
        updates.imageOverlayText = variation.imageText || "";
        break;
    }
    
    setFormData((prev) => ({
      ...prev,
      ...updates,
    }));
    if (variation.hashtags?.length) {
      setSuggestedHashtags(variation.hashtags);
    }
    setShowVariationsDialog(false);
    toast({
      title: "Variazione selezionata",
      description: `${getOutputTypeLabel(variation.outputType)} applicato al form`,
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
    const structuredContent: Record<string, any> = {
      copyType: selectedCopyType,
      mediaType: selectedMediaType,
      hook: formData.hook,
      body: formData.body,
      cta: formData.cta,
      chiCosaCome: formData.chiCosaCome,
      errore: formData.errore,
      soluzione: formData.soluzione,
      riprovaSociale: formData.riprovaSociale,
      videoHook: formData.videoHook,
      videoProblema: formData.videoProblema,
      videoSoluzione: formData.videoSoluzione,
      videoCta: formData.videoCta,
      videoFullScript: formData.videoFullScript,
      imageDescription: formData.imageDescription,
      imageOverlayText: formData.imageOverlayText,
    };

    // Base payload with all flat fields for database columns
    const basePayload = {
      ...formData,
      copyType: selectedCopyType,
      mediaType: selectedMediaType,
      chiCosaCome: formData.chiCosaCome || undefined,
      errore: formData.errore || undefined,
      soluzione: formData.soluzione || undefined,
      riprovaSociale: formData.riprovaSociale || undefined,
      videoHook: formData.videoHook || undefined,
      videoProblema: formData.videoProblema || undefined,
      videoSoluzione: formData.videoSoluzione || undefined,
      videoCta: formData.videoCta || undefined,
      videoFullScript: formData.videoFullScript || undefined,
      imageDescription: formData.imageDescription || undefined,
      imageOverlayText: formData.imageOverlayText || undefined,
      structuredContent,
      ideaId: sourceIdeaId || undefined,
    };

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
        ...basePayload,
        body: concatenatedBody,
        contentType: "carosello",
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
      
      let contentType: string = "post";
      if (selectedMediaType === "video") {
        contentType = "reel";
      } else if (selectedCopyType === "long") {
        contentType = "articolo";
      }
      
      createPostMutation.mutate({
        ...basePayload,
        contentType,
      });
    }
  };

  const resetCarouselState = () => {
    setIsCarouselMode(false);
    setCarouselSlides([{ title: "", content: "" }]);
    setActiveSlideIndex(0);
  };

  const handleEditPost = (post: Post) => {
    const structured = post.structuredContent || {};
    
    setFormData({
      title: post.title || "",
      hook: structured.hook || post.hook || "",
      body: structured.body || post.body || "",
      cta: structured.cta || post.cta || "",
      platform: post.platform || "",
      status: post.status || "draft",
      chiCosaCome: structured.chiCosaCome || "",
      errore: structured.errore || "",
      soluzione: structured.soluzione || "",
      riprovaSociale: structured.riprovaSociale || "",
      videoHook: structured.videoHook || "",
      videoProblema: structured.videoProblema || "",
      videoSoluzione: structured.videoSoluzione || "",
      videoCta: structured.videoCta || "",
      videoFullScript: structured.videoFullScript || "",
      videoUrl: "",
      imageDescription: structured.imageDescription || "",
      imageOverlayText: structured.imageOverlayText || "",
    });
    
    const copyType = structured.copyType || post.copyType;
    if (copyType === "short" || copyType === "long") {
      setSelectedCopyType(copyType);
    }
    
    const mediaType = structured.mediaType || post.mediaType;
    if (mediaType === "video" || mediaType === "foto") {
      setSelectedMediaType(mediaType);
    }
    
    setEditingPost(post);
    setIsDialogOpen(true);
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
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) {
                  setEditingPost(null);
                  setSourceIdeaId(null);
                  setSourceIdeaTitle(null);
                  setFormData({ title: "", hook: "", body: "", cta: "", platform: "", status: "draft", chiCosaCome: "", errore: "", soluzione: "", riprovaSociale: "", videoHook: "", videoProblema: "", videoSoluzione: "", videoCta: "", videoFullScript: "", videoUrl: "", imageDescription: "", imageOverlayText: "" });
                  setSuggestedHashtags([]);
                  resetCarouselState();
                }
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuovo Post
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto max-w-5xl w-full">
                  <DialogHeader>
                    <DialogTitle>
                      {editingPost ? "Modifica Post" : isCarouselMode ? "Crea Carosello" : "Crea Nuovo Post"}
                    </DialogTitle>
                    {sourceIdeaTitle && (
                      <div className="flex items-center gap-2 pt-2">
                        <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Da idea: {sourceIdeaTitle}
                        </Badge>
                      </div>
                    )}
                  </DialogHeader>
                  <div className="py-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Colonna sinistra - Impostazioni */}
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg border bg-muted/20 space-y-4">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <Globe className="h-4 w-4 text-blue-500" />
                            Impostazioni
                          </h4>
                          
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
                            <Label className="text-xs text-muted-foreground">Tipo Copy</Label>
                            {copyTypeFromIdea ? (
                              <Badge variant="secondary" className="text-xs w-full justify-center py-2">
                                {selectedCopyType === "long" && "📄 Copy Lungo"}
                                {selectedCopyType === "short" && "📝 Copy Corto"}
                                <span className="ml-1 text-muted-foreground">(da idea)</span>
                              </Badge>
                            ) : (
                              <Select
                                value={selectedCopyType}
                                onValueChange={(value) => setSelectedCopyType(value as "short" | "long")}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona tipo" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="short">📝 Copy Corto</SelectItem>
                                  <SelectItem value="long">📄 Copy Lungo</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Tipo Media</Label>
                            {mediaTypeFromIdea ? (
                              <Badge variant="secondary" className="text-xs w-full justify-center py-2">
                                {selectedMediaType === "video" && "🎬 Video"}
                                {selectedMediaType === "foto" && "📷 Foto"}
                                <span className="ml-1 text-muted-foreground">(da idea)</span>
                              </Badge>
                            ) : (
                              <Select
                                value={selectedMediaType}
                                onValueChange={(value) => setSelectedMediaType(value as "video" | "foto")}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleziona media" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="video">🎬 Video</SelectItem>
                                  <SelectItem value="foto">📷 Foto</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>

                          <div className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                            <Layers className="h-5 w-5 text-purple-500" />
                            <div className="flex-1">
                              <Label htmlFor="carousel-mode" className="font-medium cursor-pointer text-sm">
                                Carosello
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Multi-slide
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

                        <div className="p-4 rounded-lg border bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 space-y-3">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-500" />
                            Genera con AI
                          </h4>
                          <Textarea
                            placeholder="Descrivi l'idea del post..."
                            value={ideaForCopy}
                            onChange={(e) => setIdeaForCopy(e.target.value)}
                            rows={3}
                            className="bg-background"
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              onClick={handleGenerateCopy}
                              disabled={isGenerating}
                              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                            >
                              {isGenerating ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Sparkles className="h-4 w-4 mr-2" />
                              )}
                              {isCarouselMode ? "Genera" : "3 Variazioni"}
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
                              Genera il contenuto AI, poi clicca l'icona Layers per dividerlo in slide
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Colonna destra - Contenuto (2 colonne) */}
                      <div className="lg:col-span-2 space-y-4">

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
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          />
                        </div>

                        {selectedCopyType === "short" && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="hook">Hook</Label>
                              <Input
                                id="hook"
                                placeholder="La prima frase che cattura l'attenzione..."
                                value={formData.hook}
                                onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="body">Caption</Label>
                              <Textarea
                                id="body"
                                placeholder="Il testo della caption..."
                                rows={3}
                                value={formData.body}
                                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="cta">Call to Action</Label>
                              <Input
                                id="cta"
                                placeholder="Es: Clicca il link in bio!"
                                value={formData.cta}
                                onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                              />
                            </div>
                          </>
                        )}

                        {selectedCopyType === "long" && (
                          <div className="space-y-3">
                            {/* Show body field if it has content from idea.copyContent */}
                            {formData.body && !formData.chiCosaCome && !formData.errore && !formData.soluzione && !formData.riprovaSociale && (
                              <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg space-y-2 border border-orange-200 dark:border-orange-800">
                                <Label className="text-xs text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-1">
                                  📋 COPY COMPLETO (dall'idea)
                                </Label>
                                <Textarea
                                  placeholder="Testo completo del copy..."
                                  rows={4}
                                  value={formData.body}
                                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                                  className="text-sm"
                                />
                                <p className="text-xs text-orange-600 dark:text-orange-400">
                                  Puoi copiare parti di questo testo nei campi sottostanti per strutturare il copy
                                </p>
                              </div>
                            )}
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 p-3 rounded-lg space-y-2">
                              <Label className="text-xs text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                                1. 🎣 HOOK
                              </Label>
                              <Input
                                placeholder="La frase che cattura l'attenzione..."
                                value={formData.hook}
                                onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
                              />
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg space-y-2">
                              <Label className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                                2. 👋 CHI-COSA-COME
                              </Label>
                              <Textarea
                                placeholder="Ciao, sono [Nome] e aiuto [chi] a [cosa] attraverso [metodo]..."
                                rows={2}
                                value={formData.chiCosaCome || ""}
                                onChange={(e) => setFormData({ ...formData, chiCosaCome: e.target.value })}
                              />
                            </div>
                            <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg space-y-2">
                              <Label className="text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                                3. ❌ ERRORE
                              </Label>
                              <Textarea
                                placeholder="L'errore specifico che il tuo target sta commettendo..."
                                rows={2}
                                value={formData.errore || ""}
                                onChange={(e) => setFormData({ ...formData, errore: e.target.value })}
                              />
                            </div>
                            <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg space-y-2">
                              <Label className="text-xs text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                                4. ✅ SOLUZIONE
                              </Label>
                              <Textarea
                                placeholder="Il tuo metodo unico per risolvere il problema..."
                                rows={2}
                                value={formData.soluzione || ""}
                                onChange={(e) => setFormData({ ...formData, soluzione: e.target.value })}
                              />
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg space-y-2">
                              <Label className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                                5. 💬 RIPROVA SOCIALE
                              </Label>
                              <Textarea
                                placeholder="Storie concrete con nomi ed eventi reali..."
                                rows={2}
                                value={formData.riprovaSociale || ""}
                                onChange={(e) => setFormData({ ...formData, riprovaSociale: e.target.value })}
                              />
                            </div>
                            <div className="bg-indigo-50 dark:bg-indigo-950/20 p-3 rounded-lg space-y-2">
                              <Label className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                                6. 🎯 CTA
                              </Label>
                              <Input
                                placeholder="Chiamata all'azione finale..."
                                value={formData.cta}
                                onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                              />
                            </div>
                          </div>
                        )}

                        {formData.platform && (
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className={isOverLimit() ? "text-red-500 font-medium" : "text-green-600"}>
                                {getCharacterCount()} / {getCharacterLimit()} caratteri
                              </span>
                              {isOverLimit() && <span className="text-red-500 text-xs">Limite superato!</span>}
                            </div>
                            <Progress
                              value={getCharacterProgress()}
                              className={`h-1 ${isOverLimit() ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`}
                            />
                          </div>
                        )}

                        {selectedMediaType === "video" && (
                          <Collapsible open={videoSectionOpen} onOpenChange={setVideoSectionOpen}>
                            <CollapsibleTrigger asChild>
                              <Button variant="outline" className="w-full justify-between" type="button">
                                <div className="flex items-center gap-2">
                                  <Video className="h-4 w-4 text-purple-500" />
                                  🎬 Script Video (riferimento produzione)
                                </div>
                                {videoSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 space-y-3">
                              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 p-3 rounded-lg space-y-2">
                                <Label className="text-xs text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1">
                                  1. 🎣 HOOK VIDEO
                                </Label>
                                <Textarea
                                  placeholder="La frase di apertura che cattura l'attenzione..."
                                  rows={2}
                                  value={formData.videoHook || ""}
                                  onChange={(e) => setFormData({ ...formData, videoHook: e.target.value })}
                                />
                              </div>
                              <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg space-y-2">
                                <Label className="text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                                  2. ❌ PROBLEMA
                                </Label>
                                <Textarea
                                  placeholder="Il problema che affronti nel video..."
                                  rows={2}
                                  value={formData.videoProblema || ""}
                                  onChange={(e) => setFormData({ ...formData, videoProblema: e.target.value })}
                                />
                              </div>
                              <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg space-y-2">
                                <Label className="text-xs text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                                  3. ✅ SOLUZIONE
                                </Label>
                                <Textarea
                                  placeholder="La soluzione o il contenuto principale..."
                                  rows={3}
                                  value={formData.videoSoluzione || ""}
                                  onChange={(e) => setFormData({ ...formData, videoSoluzione: e.target.value })}
                                />
                              </div>
                              <div className="bg-indigo-50 dark:bg-indigo-950/20 p-3 rounded-lg space-y-2">
                                <Label className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                                  4. 🎯 CTA VIDEO
                                </Label>
                                <Input
                                  placeholder="Chiamata all'azione finale..."
                                  value={formData.videoCta || ""}
                                  onChange={(e) => setFormData({ ...formData, videoCta: e.target.value })}
                                />
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-950/20 p-3 rounded-lg space-y-2">
                                <Label className="text-xs text-slate-600 dark:text-slate-400 font-semibold flex items-center gap-1">
                                  📜 SCRIPT COMPLETO
                                </Label>
                                <Textarea
                                  placeholder="Lo script completo del video da leggere..."
                                  rows={5}
                                  value={formData.videoFullScript || ""}
                                  onChange={(e) => setFormData({ ...formData, videoFullScript: e.target.value })}
                                  className="font-mono text-sm"
                                />
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {selectedMediaType === "foto" && (
                          <Collapsible open={imageSectionOpen} onOpenChange={setImageSectionOpen}>
                            <CollapsibleTrigger asChild>
                              <Button variant="outline" className="w-full justify-between" type="button">
                                <div className="flex items-center gap-2">
                                  <Image className="h-4 w-4 text-pink-500" />
                                  📷 Descrizione Immagine (riferimento grafico)
                                </div>
                                {imageSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 space-y-3">
                              <div className="bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20 p-3 rounded-lg space-y-2">
                                <Label className="text-xs text-pink-600 dark:text-pink-400 font-semibold">
                                  🖼️ DESCRIZIONE IMMAGINE
                                </Label>
                                <Textarea
                                  placeholder="Descrivi il concetto visivo dell'immagine..."
                                  rows={3}
                                  value={formData.imageDescription || ""}
                                  onChange={(e) => setFormData({ ...formData, imageDescription: e.target.value })}
                                />
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-950/20 p-3 rounded-lg space-y-2">
                                <Label className="text-xs text-slate-600 dark:text-slate-400 font-semibold">
                                  📝 TESTO OVERLAY
                                </Label>
                                <Input
                                  placeholder="Il testo che appare sull'immagine..."
                                  value={formData.imageOverlayText || ""}
                                  onChange={(e) => setFormData({ ...formData, imageOverlayText: e.target.value })}
                                />
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}
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

                    {selectedMediaType === "video" ? (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Video className="h-4 w-4 text-purple-500" />
                          Link Video
                        </Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="https://youtube.com/watch?v=... oppure TikTok, Instagram Reels..."
                              value={formData.videoUrl || ""}
                              onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Inserisci il link al video pubblicato (YouTube, TikTok, Instagram, etc.)
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <ImagePlus className="h-4 w-4 text-pink-500" />
                          Immagine
                        </Label>
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
                    )}

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
                                copyType={selectedCopyType}
                                chiCosaCome={formData.chiCosaCome}
                                errore={formData.errore}
                                soluzione={formData.soluzione}
                                riprovaSociale={formData.riprovaSociale}
                              />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t mt-4">
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
                    Scegli una Variazione - {getCopyTypeLabel(selectedCopyType)}
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
                          {variation.outputType === "copy_short" && (
                            <>
                              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 p-3 rounded-lg">
                                <Label className="text-xs text-purple-600 dark:text-purple-400 font-semibold">📝 HOOK</Label>
                                <p className="text-sm font-medium mt-1">{variation.hook}</p>
                              </div>
                              <div className="bg-indigo-50 dark:bg-indigo-950/20 p-3 rounded-lg">
                                <Label className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">🎯 CTA</Label>
                                <p className="text-sm font-medium mt-1">{variation.cta}</p>
                              </div>
                            </>
                          )}
                          
                          {variation.outputType === "copy_long" && (
                            <>
                              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 p-3 rounded-lg">
                                <Label className="text-xs text-purple-600 dark:text-purple-400 font-semibold">1. 🎣 HOOK</Label>
                                <p className="text-sm font-medium mt-1">{variation.hook}</p>
                              </div>
                              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                                <Label className="text-xs text-blue-600 dark:text-blue-400 font-semibold">2. 👤 CHI-COSA-COME</Label>
                                <p className="text-sm mt-1">{variation.chiCosaCome}</p>
                              </div>
                              <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
                                <Label className="text-xs text-red-600 dark:text-red-400 font-semibold">3. ❌ ERRORE</Label>
                                <p className="text-sm mt-1">{variation.errore}</p>
                              </div>
                              <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
                                <Label className="text-xs text-green-600 dark:text-green-400 font-semibold">4. ✅ SOLUZIONE</Label>
                                <p className="text-sm mt-1">{variation.soluzione}</p>
                              </div>
                              <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg">
                                <Label className="text-xs text-amber-600 dark:text-amber-400 font-semibold">5. 📊 RIPROVA SOCIALE</Label>
                                <p className="text-sm mt-1">{variation.riprovaSociale}</p>
                              </div>
                              <div className="bg-indigo-50 dark:bg-indigo-950/20 p-3 rounded-lg">
                                <Label className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">6. 🎯 CTA</Label>
                                <p className="text-sm font-medium mt-1">{variation.cta}</p>
                              </div>
                            </>
                          )}
                          
                          {variation.outputType === "video_script" && (
                            <>
                              {variation.segments?.map((segment, segIdx) => (
                                <div key={segIdx} className={`p-3 rounded-lg ${
                                  segIdx === 0 ? "bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20" :
                                  segIdx === 1 ? "bg-blue-50 dark:bg-blue-950/20" :
                                  segIdx === 2 ? "bg-red-50 dark:bg-red-950/20" :
                                  segIdx === 3 ? "bg-green-50 dark:bg-green-950/20" :
                                  "bg-indigo-50 dark:bg-indigo-950/20"
                                }`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="text-xs font-mono">{segment.timing}</Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {segIdx === 0 ? "HOOK" : segIdx === 1 ? "CHI-COSA-COME" : segIdx === 2 ? "ERRORE" : segIdx === 3 ? "SOLUZIONE + RIPROVA" : "CTA"}
                                    </span>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-start gap-2">
                                      <span className="text-xs font-semibold text-muted-foreground">🎬 Visual:</span>
                                      <p className="text-xs text-muted-foreground italic">{segment.visual}</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <span className="text-xs font-semibold">🎤 Voiceover:</span>
                                      <p className="text-sm font-medium">{segment.voiceover}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                          
                          {variation.outputType === "image_copy" && (
                            <>
                              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 p-4 rounded-lg text-center">
                                <Label className="text-xs text-purple-600 dark:text-purple-400 font-semibold">🖼️ TESTO SULL'IMMAGINE</Label>
                                <p className="text-lg font-bold mt-2 leading-tight">{variation.imageText}</p>
                              </div>
                              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                                <Label className="text-xs text-blue-600 dark:text-blue-400 font-semibold">📝 SOTTOTITOLO / CAPTION</Label>
                                <p className="text-sm mt-1">{variation.subtitle}</p>
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-950/20 p-3 rounded-lg">
                                <Label className="text-xs text-gray-600 dark:text-gray-400 font-semibold">🎨 CONCEPT VISIVO</Label>
                                <p className="text-sm mt-1 italic text-muted-foreground">{variation.conceptDescription}</p>
                              </div>
                            </>
                          )}
                          
                          {variation.hashtags && variation.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-2">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-5 space-y-3">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-6 w-16" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredPosts.map((post) => {
                  const structured = post.structuredContent || {};
                  const hookText = structured.hook || post.hook || "";
                  return (
                    <Card 
                      key={post.id} 
                      className="group relative overflow-hidden border-0 shadow-sm hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50/50 dark:from-zinc-900 dark:to-zinc-950"
                    >
                      {/* Accent ribbon */}
                      <div className={`absolute top-0 left-0 right-0 h-1 ${
                        post.platform === "instagram" ? "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400" :
                        post.platform === "facebook" ? "bg-blue-600" :
                        post.platform === "linkedin" ? "bg-blue-700" :
                        post.platform === "twitter" ? "bg-sky-500" :
                        post.platform === "tiktok" ? "bg-gradient-to-r from-cyan-400 to-pink-500" :
                        "bg-gray-400"
                      }`} />
                      
                      <CardContent className="p-5">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${
                              post.platform === "instagram" ? "bg-gradient-to-br from-purple-500/10 to-pink-500/10" :
                              post.platform === "facebook" ? "bg-blue-500/10" :
                              post.platform === "linkedin" ? "bg-blue-600/10" :
                              post.platform === "twitter" ? "bg-sky-500/10" :
                              "bg-muted"
                            }`}>
                              {getPlatformIcon(post.platform)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold capitalize">{post.platform}</span>
                                {getStatusBadge(post.status)}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(post.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={() => deletePostMutation.mutate(post.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Title */}
                        <h3 className="font-semibold text-base leading-tight line-clamp-2 mb-3">
                          {post.title || "Post senza titolo"}
                        </h3>

                        {/* Hook preview */}
                        {hookText && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 italic border-l-2 border-purple-300 pl-3">
                            "{hookText}"
                          </p>
                        )}

                        {/* Tags row */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {post.mediaType && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              post.mediaType === "video" 
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            }`}>
                              {post.mediaType === "video" ? <Video className="h-3 w-3" /> : <Image className="h-3 w-3" />}
                              {post.mediaType === "video" ? "Video" : "Foto"}
                            </span>
                          )}
                          {post.copyType && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              post.copyType === "long" 
                                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" 
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            }`}>
                              {post.copyType === "long" ? "Lungo" : "Corto"}
                            </span>
                          )}
                        </div>

                        {/* Scheduled indicator */}
                        {post.scheduledDate && (
                          <div className="flex items-center gap-2 mb-4 p-2.5 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-800/30">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                              {new Date(post.scheduledDate).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        )}

                        {/* Engagement stats */}
                        {post.status === "published" && post.engagement && (
                          <div className="flex items-center justify-between py-3 mb-4 border-y border-dashed">
                            <div className="flex items-center gap-1 text-pink-500">
                              <Heart className="h-3.5 w-3.5" />
                              <span className="text-xs font-semibold">{post.engagement.likes}</span>
                            </div>
                            <div className="flex items-center gap-1 text-blue-500">
                              <MessageCircle className="h-3.5 w-3.5" />
                              <span className="text-xs font-semibold">{post.engagement.comments}</span>
                            </div>
                            <div className="flex items-center gap-1 text-green-500">
                              <Share2 className="h-3.5 w-3.5" />
                              <span className="text-xs font-semibold">{post.engagement.shares}</span>
                            </div>
                            <div className="flex items-center gap-1 text-purple-500">
                              <Eye className="h-3.5 w-3.5" />
                              <span className="text-xs font-semibold">
                                {post.engagement.views > 1000 ? `${(post.engagement.views / 1000).toFixed(1)}K` : post.engagement.views}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="flex-1 h-9 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-sm"
                            onClick={() => handleEditPost(post)}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            Modifica
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="h-9 px-3"
                            onClick={() => setViewingPost(post)}
                          >
                            <Eye className="h-3.5 w-3.5" />
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

      <Dialog open={!!viewingPost} onOpenChange={(open) => !open && setViewingPost(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0 gap-0">
          {viewingPost && (() => {
            const viewStructured = viewingPost.structuredContent || {};
            const viewCopyType = viewStructured.copyType || viewingPost.copyType || "short";
            const hookText = viewStructured.hook || viewingPost.hook;
            const bodyText = viewStructured.body || viewingPost.body;
            const ctaText = viewStructured.cta || viewingPost.cta;
            
            return (
              <div className="flex flex-col lg:flex-row h-full">
                {/* Left Panel - Preview */}
                <div className="lg:w-[380px] flex-shrink-0 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-zinc-950 p-6 border-b lg:border-b-0 lg:border-r overflow-y-auto">
                  <div className="sticky top-0">
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`p-2 rounded-lg ${
                        viewingPost.platform === "instagram" ? "bg-gradient-to-br from-purple-500/20 to-pink-500/20" :
                        viewingPost.platform === "facebook" ? "bg-blue-500/20" :
                        viewingPost.platform === "linkedin" ? "bg-blue-600/20" :
                        "bg-muted"
                      }`}>
                        {getPlatformIcon(viewingPost.platform)}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold capitalize">{viewingPost.platform}</h4>
                        <p className="text-xs text-muted-foreground">Anteprima</p>
                      </div>
                    </div>
                    <div className="transform scale-[0.92] origin-top">
                      <SocialPreview
                        platform={viewingPost.platform || "instagram"}
                        hook={hookText}
                        body={bodyText}
                        cta={ctaText}
                        copyType={viewCopyType as "short" | "long"}
                        chiCosaCome={viewStructured.chiCosaCome || viewingPost.chiCosaCome}
                        errore={viewStructured.errore || viewingPost.errore}
                        soluzione={viewStructured.soluzione || viewingPost.soluzione}
                        riprovaSociale={viewStructured.riprovaSociale || viewingPost.riprovaSociale}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Panel - Content */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Header */}
                  <div className="px-6 py-4 border-b bg-white dark:bg-zinc-950">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-xl font-bold leading-tight truncate">
                          {viewingPost.title || "Post senza titolo"}
                        </h2>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {getStatusBadge(viewingPost.status)}
                          {viewingPost.mediaType && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              viewingPost.mediaType === "video" 
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            }`}>
                              {viewingPost.mediaType === "video" ? <Video className="h-3 w-3" /> : <Image className="h-3 w-3" />}
                              {viewingPost.mediaType === "video" ? "Video" : "Foto"}
                            </span>
                          )}
                          {viewingPost.copyType && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              viewingPost.copyType === "long" 
                                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" 
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            }`}>
                              {viewingPost.copyType === "long" ? "Copy Lungo" : "Copy Corto"}
                            </span>
                          )}
                          {viewingPost.contentType && (
                            <Badge variant="secondary" className="text-xs">{viewingPost.contentType}</Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                        onClick={() => {
                          setViewingPost(null);
                          handleEditPost(viewingPost);
                        }}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        Modifica
                      </Button>
                    </div>
                  </div>

                  {/* Content Sections */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Schedule info */}
                    {viewingPost.scheduledDate && (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/30">
                        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                          <Calendar className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Programmato per</p>
                          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                            {new Date(viewingPost.scheduledDate).toLocaleDateString("it-IT", { 
                              weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" 
                            })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Hook */}
                    {hookText && (
                      <div className="rounded-xl overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2">
                          <span className="text-xs font-semibold text-white/90 uppercase tracking-wide">🎣 Hook</span>
                        </div>
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 p-4">
                          <p className="text-sm font-medium leading-relaxed">{hookText}</p>
                        </div>
                      </div>
                    )}

                    {/* Body */}
                    {bodyText && (
                      <div className="rounded-xl overflow-hidden border">
                        <div className="bg-slate-100 dark:bg-zinc-800 px-4 py-2">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">📝 Contenuto</span>
                        </div>
                        <div className="bg-white dark:bg-zinc-900 p-4 max-h-48 overflow-y-auto">
                          <div className="text-sm whitespace-pre-wrap leading-relaxed">
                            {formatTextWithHashtags(bodyText)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CTA */}
                    {ctaText && (
                      <div className="rounded-xl overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2">
                          <span className="text-xs font-semibold text-white/90 uppercase tracking-wide">🎯 Call to Action</span>
                        </div>
                        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 p-4">
                          <p className="text-sm font-medium">{ctaText}</p>
                        </div>
                      </div>
                    )}

                    {/* Long Copy Sections */}
                    {(() => {
                      const chiCosaCome = viewStructured.chiCosaCome || viewingPost.chiCosaCome;
                      const errore = viewStructured.errore || viewingPost.errore;
                      const soluzione = viewStructured.soluzione || viewingPost.soluzione;
                      const riprovaSociale = viewStructured.riprovaSociale || viewingPost.riprovaSociale;
                      const hasLongCopyContent = (chiCosaCome?.trim()) || (errore?.trim()) || (soluzione?.trim()) || (riprovaSociale?.trim());
                      
                      if (hasLongCopyContent) {
                        return (
                          <div className="rounded-xl border overflow-hidden">
                            <div className="bg-violet-100 dark:bg-violet-900/30 px-4 py-2">
                              <span className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">📄 Copy Lungo - Sezioni</span>
                            </div>
                            <div className="divide-y">
                              {chiCosaCome && (
                                <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20">
                                  <p className="text-xs font-semibold text-blue-600 mb-1">👤 Chi-Cosa-Come</p>
                                  <p className="text-sm">{chiCosaCome}</p>
                                </div>
                              )}
                              {errore && (
                                <div className="p-4 bg-red-50/50 dark:bg-red-950/20">
                                  <p className="text-xs font-semibold text-red-600 mb-1">❌ Errore</p>
                                  <p className="text-sm">{errore}</p>
                                </div>
                              )}
                              {soluzione && (
                                <div className="p-4 bg-green-50/50 dark:bg-green-950/20">
                                  <p className="text-xs font-semibold text-green-600 mb-1">✅ Soluzione</p>
                                  <p className="text-sm">{soluzione}</p>
                                </div>
                              )}
                              {riprovaSociale && (
                                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20">
                                  <p className="text-xs font-semibold text-amber-600 mb-1">📊 Riprova Sociale</p>
                                  <p className="text-sm">{riprovaSociale}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Video Script */}
                    {(() => {
                      const videoFullScript = viewStructured.videoFullScript || viewingPost.videoFullScript;
                      if (viewingPost.mediaType === "video" || videoFullScript) {
                        return (
                          <div className="rounded-xl border overflow-hidden">
                            <div className="bg-blue-100 dark:bg-blue-900/30 px-4 py-2">
                              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">🎬 Script Video</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-4 max-h-40 overflow-y-auto">
                              <pre className="text-xs whitespace-pre-wrap font-mono">{videoFullScript || "Nessuno script video"}</pre>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Image Description */}
                    {(() => {
                      const imageDescription = viewStructured.imageDescription || viewingPost.imageDescription;
                      const imageOverlayText = viewStructured.imageOverlayText || viewingPost.imageOverlayText;
                      if (imageDescription || imageOverlayText) {
                        return (
                          <div className="rounded-xl border overflow-hidden">
                            <div className="bg-emerald-100 dark:bg-emerald-900/30 px-4 py-2">
                              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">🖼️ Descrizione Immagine</span>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-4 space-y-3">
                              {imageDescription && <p className="text-sm">{imageDescription}</p>}
                              {imageOverlayText && (
                                <div className="bg-slate-100 dark:bg-zinc-800 p-3 rounded-lg text-center">
                                  <p className="text-xs text-muted-foreground mb-1">Testo overlay</p>
                                  <p className="font-bold">{imageOverlayText}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-3 border-t bg-slate-50 dark:bg-zinc-900">
                    <p className="text-xs text-muted-foreground">
                      Creato il {new Date(viewingPost.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
