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
  FolderOpen,
  FolderPlus,
  Folder,
  Menu,
  X,
  MoveRight,
  Copy,
  ClipboardCheck,
  Briefcase,
  MoreVertical,
  MessageSquare,
  Pencil,
  Search,
  List,
  LayoutGrid,
  Clock,
  CheckCircle2,
  XCircle,
  Upload,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import Navbar from "@/components/navbar";
import { PublerPublishDialog } from "@/components/publer/PublerPublishDialog";
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
  folderId?: string;
  folder?: { id: string; name: string; color?: string };
  publerStatus?: 'draft' | 'scheduled' | 'published' | 'failed';
  publerScheduledAt?: string;
  publerPostId?: string;
  publerError?: string;
  publerMediaIds?: Array<string | { id: string; path?: string; thumbnail?: string }>;
}

interface ContentFolder {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  folderType: "project" | "folder";
  parentId?: string | null;
  sortOrder: number;
  children?: ContentFolder[];
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
  const [isSyncingStatuses, setIsSyncingStatuses] = useState(false);
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
  const [sophisticationLevel, setSophisticationLevel] = useState<"level_1" | "level_2" | "level_3" | "level_4" | "level_5">("level_3");
  const [videoSectionOpen, setVideoSectionOpen] = useState(true);
  const [imageSectionOpen, setImageSectionOpen] = useState(true);

  const [isCarouselMode, setIsCarouselMode] = useState(false);
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([
    { title: "", content: "" },
  ]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  
  const [uploadedMedia, setUploadedMedia] = useState<{ id: string; path: string; thumbnail?: string; localPreview?: string }[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const [uploadedVideo, setUploadedVideo] = useState<{ id: string; path: string; thumbnail?: string } | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoSourceType, setVideoSourceType] = useState<'link' | 'upload'>('link');

  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortPosts, setSortPosts] = useState<string>("date-desc");
  const [showPreview, setShowPreview] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [viewingPost, setViewingPost] = useState<Post | null>(null);
  const [publerDialogOpen, setPublerDialogOpen] = useState(false);
  const [publerPost, setPublerPost] = useState<Post | null>(null);
  const [openPublerAfterSave, setOpenPublerAfterSave] = useState(false);

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedPublerFilter, setSelectedPublerFilter] = useState<string>("all");
  const [folderSidebarOpen, setFolderSidebarOpen] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderType, setNewFolderType] = useState<"project" | "folder">("folder");
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");

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

  // Reset carousel mode when Twitter is selected (Twitter doesn't support carousels)
  useEffect(() => {
    if (formData.platform === 'twitter' && isCarouselMode) {
      setIsCarouselMode(false);
      toast({
        title: "Carosello disattivato",
        description: "Twitter/X non supporta i post carosello",
      });
    }
  }, [formData.platform]);

  // Populate uploadedMedia/uploadedVideo when editing a post with saved media
  useEffect(() => {
    // Reset state when no post is being edited
    if (!editingPost) {
      setUploadedMedia([]);
      setUploadedVideo(null);
      return;
    }
    
    if (editingPost.publerMediaIds && Array.isArray(editingPost.publerMediaIds) && editingPost.publerMediaIds.length > 0) {
      const mediaItems = editingPost.publerMediaIds;
      
      // Check if these are old-format (string IDs) or new-format (objects with id, path, thumbnail)
      const firstItem = mediaItems[0];
      if (typeof firstItem === 'object' && firstItem !== null && 'id' in firstItem) {
        // New format - objects with id, path, thumbnail
        const mediaObjects = mediaItems as Array<{ id: string; path?: string; thumbnail?: string }>;
        
        // Check if this is a video (single item with video-like characteristics)
        if (mediaObjects.length === 1 && editingPost.mediaType === 'video') {
          setUploadedVideo({
            id: mediaObjects[0].id,
            path: mediaObjects[0].path || '',
            thumbnail: mediaObjects[0].thumbnail
          });
          setUploadedMedia([]); // Clear images when it's a video
        } else {
          // Images
          setUploadedMedia(mediaObjects.map(m => ({
            id: m.id,
            path: m.path,
            thumbnail: m.thumbnail,
            localPreview: undefined // No local preview for saved media
          })));
          setUploadedVideo(null); // Clear video when it's images
        }
      } else {
        // Old format (string IDs only) - can't show previews, reset state
        setUploadedMedia([]);
        setUploadedVideo(null);
      }
    } else {
      // No media saved - reset state
      setUploadedMedia([]);
      setUploadedVideo(null);
    }
  }, [editingPost]);

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

  const { data: foldersData } = useQuery({
    queryKey: ["/api/content/folders"],
    queryFn: async () => {
      // Request flat array to build hierarchy in frontend
      const response = await fetch("/api/content/folders?flat=true", { headers: getAuthHeaders() });
      if (!response.ok) throw new Error("Failed to fetch folders");
      return response.json();
    },
  });

  const posts: Post[] = postsResponse?.data || [];
  const folders: ContentFolder[] = foldersData?.data || [];

  const filteredPosts = useMemo(() => {
    let result = [...posts];

    // Filtro per cartella
    // Se selectedFolderId è null E abbiamo un filtro publerStatus attivo -> mostra TUTTI i post (ignora cartella)
    // Se selectedFolderId è "root" -> mostra solo post senza cartella
    // Se selectedFolderId è un ID specifico -> mostra post in quella cartella
    if (selectedFolderId === null) {
      // Nessun filtro cartella - mostra tutti i post (per permettere filtro stato pubblicazione)
      // Non filtrare per cartella
    } else if (selectedFolderId === "root") {
      // Mostra solo i post senza cartella
      result = result.filter((p) => !p.folderId);
    } else if (selectedFolderId) {
      // Vista cartella specifica: mostra i post in quella cartella
      result = result.filter((p) => p.folderId === selectedFolderId);
    }

    // Filtro per ricerca
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        const title = (p.title || "").toLowerCase();
        const hook = (p.hook || p.structuredContent?.hook || "").toLowerCase();
        const body = (p.body || p.structuredContent?.body || "").toLowerCase();
        return title.includes(query) || hook.includes(query) || body.includes(query);
      });
    }

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

    if (selectedPublerFilter !== "all") {
      result = result.filter((p) => {
        if (selectedPublerFilter === "draft") return !p.publerStatus || p.publerStatus === 'draft';
        if (selectedPublerFilter === "scheduled") return p.publerStatus === 'scheduled';
        if (selectedPublerFilter === "published") return p.publerStatus === 'published';
        if (selectedPublerFilter === "failed") return p.publerStatus === 'failed';
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
  }, [posts, filterPlatform, filterStatus, sortPosts, selectedFolderId, searchQuery, selectedPublerFilter]);

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
    onSuccess: async (result) => {
      const isEditing = !!editingPost;
      const createdPost = result?.data || result;
      
      if (!isEditing && sourceIdeaId && createdPost?.id) {
        try {
          await fetch(`/api/content/ideas/${sourceIdeaId}`, {
            method: "PUT",
            headers: {
              ...getAuthHeaders(),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status: "developed",
              developedPostId: createdPost.id,
            }),
          });
          queryClient.invalidateQueries({ queryKey: ["/api/content/ideas"] });
        } catch (error) {
          console.error("Failed to update idea status:", error);
        }
      }
      
      toast({
        title: isEditing ? "Post aggiornato" : "Post creato",
        description: isEditing ? "Il post è stato aggiornato con successo" : "Il post è stato creato con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/posts"] });
      
      // Check if we need to open Publer dialog after save
      if (openPublerAfterSave && createdPost) {
        setPublerPost(createdPost);
        setPublerDialogOpen(true);
        setOpenPublerAfterSave(false);
      }
      setIsDialogOpen(false);
      setEditingPost(null);
      setFormData({ title: "", hook: "", body: "", cta: "", platform: "", status: "draft", chiCosaCome: "", errore: "", soluzione: "", riprovaSociale: "", videoHook: "", videoProblema: "", videoSoluzione: "", videoCta: "", videoFullScript: "", videoUrl: "", imageDescription: "", imageOverlayText: "" });
      setSuggestedHashtags([]);
      resetCarouselState();
      setCopyTypeFromIdea(false);
      setMediaTypeFromIdea(false);
      setSourceIdeaId(null);
      setSourceIdeaTitle(null);
      // Cleanup object URLs to prevent memory leaks
      uploadedMedia.forEach(m => {
        if (m.localPreview) URL.revokeObjectURL(m.localPreview);
      });
      setUploadedMedia([]);
      setUploadedVideo(null);
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

  const moveToFolderMutation = useMutation({
    mutationFn: async ({ postId, folderId }: { postId: string; folderId: string | null }) => {
      const response = await fetch(`/api/content/posts/${postId}/folder`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
      if (!response.ok) throw new Error("Failed to move post");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content/posts"] });
      toast({ title: "Post spostato", description: "Il post è stato spostato nella cartella" });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (folder: { name: string; folderType: "project" | "folder"; parentId?: string | null }) => {
      const response = await fetch("/api/content/folders", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(folder),
      });
      if (!response.ok) throw new Error("Failed to create folder");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content/folders"] });
      toast({ title: "Cartella creata", description: "La cartella è stata creata con successo" });
      setCreateFolderDialogOpen(false);
      setNewFolderName("");
      setNewFolderType("folder");
      setNewFolderParentId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveFolderMutation = useMutation({
    mutationFn: async ({ folderId, parentId }: { folderId: string; parentId: string | null }) => {
      const response = await fetch(`/api/content/folders/${folderId}/move`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ parentId }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to move folder");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content/folders"] });
      toast({ title: "Cartella spostata", description: "La cartella è stata spostata con successo" });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const renameFolderMutation = useMutation({
    mutationFn: async ({ folderId, name }: { folderId: string; name: string }) => {
      const response = await fetch(`/api/content/folders/${folderId}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to rename folder");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content/folders"] });
      toast({ title: "Cartella rinominata", description: "Il nome è stato aggiornato con successo" });
      setRenameFolderId(null);
      setRenameFolderName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const getPostCountForFolder = (folderId: string | null): number => {
    if (folderId === null) return posts.length;
    if (folderId === "root") return posts.filter((p) => !p.folderId).length;
    
    const collectDescendantIds = (parentId: string): string[] => {
      const childFolders = folders.filter(f => f.parentId === parentId);
      let ids = [parentId];
      childFolders.forEach(child => {
        ids = ids.concat(collectDescendantIds(child.id));
      });
      return ids;
    };
    
    const folderIds = collectDescendantIds(folderId);
    return posts.filter((p) => p.folderId && folderIds.includes(p.folderId)).length;
  };

  // Build recursive folder hierarchy - supports unlimited nesting like Google Drive
  const buildFolderHierarchy = (folders: ContentFolder[]): ContentFolder[] => {
    const buildChildren = (parentId: string | null): ContentFolder[] => {
      return folders
        .filter((f) => (f.parentId ?? null) === parentId)
        .map((folder) => ({
          ...folder,
          children: buildChildren(folder.id),
        }))
        .sort((a, b) => {
          // Projects first, then folders
          if (a.folderType === "project" && b.folderType !== "project") return -1;
          if (a.folderType !== "project" && b.folderType === "project") return 1;
          return a.sortOrder - b.sortOrder;
        });
    };
    
    // Get all root-level items (no parent)
    return buildChildren(null);
  };

  const folderHierarchy = useMemo(() => buildFolderHierarchy(folders), [folders]);

  const handleSyncStatuses = async () => {
    setIsSyncingStatuses(true);
    try {
      const response = await fetch('/api/publer/sync-statuses', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Sincronizzazione completata",
          description: data.updated > 0 
            ? `Aggiornati ${data.updated} post` 
            : "Tutti i post sono già aggiornati",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/content-posts"] });
      } else {
        toast({
          title: "Errore sincronizzazione",
          description: data.error || "Impossibile sincronizzare",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la sincronizzazione",
        variant: "destructive",
      });
    } finally {
      setIsSyncingStatuses(false);
    }
  };

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
          sophisticationLevel: sophisticationLevel,
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

  const handleMediaUpload = async (files: File[]) => {
    if (files.length === 0) return;
    
    setIsUploadingMedia(true);
    setUploadProgress(0);
    
    const localPreviews: { id: string; path: string; localPreview: string }[] = [];
    for (const file of files) {
      const localPreview = URL.createObjectURL(file);
      localPreviews.push({
        id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        path: '',
        localPreview,
      });
    }
    setUploadedMedia(prev => [...prev, ...localPreviews]);
    
    try {
      const formDataUpload = new FormData();
      files.forEach(file => {
        formDataUpload.append('files', file);
      });
      
      const headersObj = getAuthHeaders();
      delete (headersObj as any)['Content-Type'];
      
      const response = await fetch('/api/publer/upload-media', {
        method: 'POST',
        headers: headersObj,
        body: formDataUpload,
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Errore durante l\'upload');
      }
      
      setUploadedMedia(prev => {
        // Cleanup object URLs for local previews to prevent memory leaks
        prev.forEach(m => {
          if (m.id.startsWith('local-') && m.localPreview) {
            URL.revokeObjectURL(m.localPreview);
          }
        });
        const withoutLocalPreviews = prev.filter(m => !m.id.startsWith('local-'));
        return [...withoutLocalPreviews, ...result.media];
      });
      
      setUploadProgress(100);
      
      if (result.errors && result.errors.length > 0) {
        toast({
          title: "Upload parziale",
          description: `Alcuni file non sono stati caricati: ${result.errors.join(', ')}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Upload completato",
          description: `${result.media.length} immagini caricate`,
        });
      }
    } catch (error: any) {
      console.error('[UPLOAD] Error:', error);
      setUploadedMedia(prev => {
        // Cleanup object URLs on error as well
        prev.forEach(m => {
          if (m.id.startsWith('local-') && m.localPreview) {
            URL.revokeObjectURL(m.localPreview);
          }
        });
        return prev.filter(m => !m.id.startsWith('local-'));
      });
      toast({
        title: "Errore upload",
        description: error.message || 'Errore durante l\'upload delle immagini',
        variant: "destructive",
      });
    } finally {
      setIsUploadingMedia(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleVideoUpload = async (file: File) => {
    if (!file) return;
    
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File troppo grande",
        description: "Il video deve essere massimo 50MB",
        variant: "destructive",
      });
      return;
    }
    
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/mov'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|webm)$/i)) {
      toast({
        title: "Formato non supportato",
        description: "Formati supportati: MP4, MOV, WebM",
        variant: "destructive",
      });
      return;
    }
    
    setIsUploadingVideo(true);
    setVideoUploadProgress(10);
    
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('files', file);
      
      const headersObj = getAuthHeaders();
      delete (headersObj as any)['Content-Type'];
      
      setVideoUploadProgress(30);
      
      const response = await fetch('/api/publer/upload-media', {
        method: 'POST',
        headers: headersObj,
        body: formDataUpload,
      });
      
      setVideoUploadProgress(70);
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Errore durante l\'upload');
      }
      
      if (result.media && result.media.length > 0) {
        setUploadedVideo(result.media[0]);
        setVideoUploadProgress(100);
        toast({
          title: "Video caricato",
          description: "Il video è stato caricato con successo",
        });
      }
    } catch (error: any) {
      console.error('[VIDEO UPLOAD] Error:', error);
      toast({
        title: "Errore upload video",
        description: error.message || 'Errore durante l\'upload del video',
        variant: "destructive",
      });
      setUploadedVideo(null);
    } finally {
      setIsUploadingVideo(false);
      setTimeout(() => setVideoUploadProgress(0), 1000);
    }
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
    const isEditing = !!editingPost;
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

    // Build publerMediaIds from uploaded media - save complete objects with id, path, thumbnail
    // Preserve existing media when editing if no new uploads
    let publerMediaIds: Array<{ id: string; path?: string; thumbnail?: string }> | undefined;
    if (uploadedMedia.length > 0) {
      publerMediaIds = uploadedMedia.map(m => ({ id: m.id, path: m.path, thumbnail: m.thumbnail }));
    } else if (uploadedVideo) {
      publerMediaIds = [{ id: uploadedVideo.id, path: uploadedVideo.path, thumbnail: uploadedVideo.thumbnail }];
    } else if (isEditing && editingPost?.publerMediaIds && Array.isArray(editingPost.publerMediaIds)) {
      // Keep existing media objects as-is
      publerMediaIds = editingPost.publerMediaIds as Array<{ id: string; path?: string; thumbnail?: string }>;
    }

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
      publerMediaIds,
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

  const getPostCountByPublerStatus = (status: string | null) => {
    if (status === "all" || status === null) return posts.length;
    if (status === "draft") return posts.filter(p => !p.publerStatus || p.publerStatus === 'draft').length;
    if (status === "scheduled") return posts.filter(p => p.publerStatus === 'scheduled').length;
    if (status === "published") return posts.filter(p => p.publerStatus === 'published').length;
    if (status === "failed") return posts.filter(p => p.publerStatus === 'failed').length;
    return 0;
  };

  const FolderSidebar = () => (
    <div className={`${isMobile ? (folderSidebarOpen ? "fixed inset-0 z-50 bg-white dark:bg-zinc-950" : "hidden") : "w-64 border-r border-gray-200 dark:border-gray-800 flex-shrink-0"} flex flex-col h-full`}>
      {isMobile && folderSidebarOpen && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtri</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFolderSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <ScrollArea className="flex-1">
        <div className="py-3 px-3">
          <div className="mb-6">
            <div className="px-1 mb-2">
              <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Stato Pubblicazione</span>
            </div>
            
            <button
              onClick={() => { setSelectedPublerFilter("all"); setSelectedFolderId(null); if (isMobile) setFolderSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                selectedPublerFilter === "all" && selectedFolderId === null
                  ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <FileText className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">Tutti i Post</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">{getPostCountByPublerStatus("all")}</span>
            </button>
            
            <button
              onClick={() => { setSelectedPublerFilter("draft"); setSelectedFolderId(null); if (isMobile) setFolderSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                selectedPublerFilter === "draft"
                  ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Pencil className="h-4 w-4 flex-shrink-0 text-gray-400" />
              <span className="flex-1">Bozze</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">{getPostCountByPublerStatus("draft")}</span>
            </button>
            
            <button
              onClick={() => { setSelectedPublerFilter("scheduled"); setSelectedFolderId(null); if (isMobile) setFolderSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                selectedPublerFilter === "scheduled"
                  ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Clock className="h-4 w-4 flex-shrink-0 text-amber-500" />
              <span className="flex-1">Programmati</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600">{getPostCountByPublerStatus("scheduled")}</span>
            </button>
            
            <button
              onClick={() => { setSelectedPublerFilter("published"); setSelectedFolderId(null); if (isMobile) setFolderSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                selectedPublerFilter === "published"
                  ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
              <span className="flex-1">Pubblicati</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600">{getPostCountByPublerStatus("published")}</span>
            </button>
            
            <button
              onClick={() => { setSelectedPublerFilter("failed"); setSelectedFolderId(null); if (isMobile) setFolderSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                selectedPublerFilter === "failed"
                  ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
              <span className="flex-1">Errori</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600">{getPostCountByPublerStatus("failed")}</span>
            </button>
          </div>
          
          <div>
            <div className="px-1 mb-2">
              <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Cartelle</span>
            </div>
            
            <button
              onClick={() => { setSelectedPublerFilter("all"); setSelectedFolderId("root"); if (isMobile) setFolderSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                selectedFolderId === "root"
                  ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Folder className="h-4 w-4 flex-shrink-0 text-gray-400" />
              <span className="flex-1">Senza Cartella</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">{getPostCountForFolder("root")}</span>
            </button>

            {(() => {
              const renderFolderItem = (folder: ContentFolder, depth: number = 0): React.ReactNode => {
                const hasChildren = folder.children && folder.children.length > 0;
                const isExpanded = expandedProjects.has(folder.id);
                const isProject = folder.folderType === "project";
                
                const getAvailableParents = () => {
                  const childrenMap = new Map<string | null, string[]>();
                  folders.forEach(f => {
                    const parentKey = f.parentId ?? null;
                    if (!childrenMap.has(parentKey)) {
                      childrenMap.set(parentKey, []);
                    }
                    childrenMap.get(parentKey)!.push(f.id);
                  });
                  
                  const collectDescendantIds = (folderId: string): string[] => {
                    const ids = [folderId];
                    const children = childrenMap.get(folderId) || [];
                    children.forEach(childId => ids.push(...collectDescendantIds(childId)));
                    return ids;
                  };
                  
                  const excludeIds = new Set(collectDescendantIds(folder.id));
                  return folders.filter(f => !excludeIds.has(f.id));
                };
                
                return (
                  <div key={folder.id}>
                    <div
                      className={`group flex items-center gap-1.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                        selectedFolderId === folder.id
                          ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                      style={{ paddingLeft: `${12 + depth * 12}px`, paddingRight: "8px" }}
                    >
                      {hasChildren ? (
                        <button
                          onClick={() => toggleProjectExpanded(folder.id)}
                          className="p-0.5 rounded flex-shrink-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-gray-400" />
                          )}
                        </button>
                      ) : (
                        <div className="w-4" />
                      )}
                      <button
                        onClick={() => { setSelectedPublerFilter("all"); setSelectedFolderId(folder.id); if (isMobile) setFolderSidebarOpen(false); }}
                        className="flex-1 flex items-center gap-2 text-left min-w-0"
                      >
                        {isProject ? (
                          <Briefcase className="h-4 w-4 flex-shrink-0 text-indigo-500" />
                        ) : (
                          <Folder className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        )}
                        <span className={`truncate text-sm ${isProject ? "font-medium" : ""}`}>{folder.name}</span>
                      </button>
                      <span className="text-xs text-gray-400 flex-shrink-0">{getPostCountForFolder(folder.id)}</span>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hover:bg-gray-200 dark:hover:bg-gray-700">
                            <MoreVertical className="h-3 w-3 text-gray-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => { setRenameFolderId(folder.id); setRenameFolderName(folder.name); }}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Rinomina
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <MoveRight className="h-3.5 w-3.5 mr-2" />
                              Sposta in...
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                              {folder.parentId && (
                                <DropdownMenuItem
                                  onClick={() => moveFolderMutation.mutate({ folderId: folder.id, parentId: null })}
                                >
                                  <FolderOpen className="h-3.5 w-3.5 mr-2 text-gray-400" />
                                  Livello Root
                                </DropdownMenuItem>
                              )}
                              {getAvailableParents().filter(f => f.folderType === "project").map(project => (
                                <DropdownMenuItem
                                  key={project.id}
                                  onClick={() => moveFolderMutation.mutate({ folderId: folder.id, parentId: project.id })}
                                  disabled={folder.parentId === project.id}
                                >
                                  <Briefcase className="h-3.5 w-3.5 mr-2 text-indigo-500" />
                                  {project.name}
                                </DropdownMenuItem>
                              ))}
                              {getAvailableParents().filter(f => f.folderType === "folder" && f.id !== folder.id).length > 0 && (
                                <>
                                  <DropdownMenuSeparator />
                                  {getAvailableParents().filter(f => f.folderType === "folder").map(f => (
                                    <DropdownMenuItem
                                      key={f.id}
                                      onClick={() => moveFolderMutation.mutate({ folderId: folder.id, parentId: f.id })}
                                      disabled={folder.parentId === f.id}
                                    >
                                      <Folder className="h-3.5 w-3.5 mr-2 text-gray-400" />
                                      {f.name}
                                    </DropdownMenuItem>
                                  ))}
                                </>
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {isExpanded && hasChildren && (
                      <div>
                        {folder.children!.map((child) => renderFolderItem(child, depth + 1))}
                      </div>
                    )}
                  </div>
                );
              };
              
              return folderHierarchy.map((folder) => renderFolderItem(folder, 0));
            })()}
          </div>
        </div>
      </ScrollArea>
      
      <div className="p-2 border-t border-gray-200 dark:border-gray-800 space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-8 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900"
          onClick={() => {
            setNewFolderType("project");
            setNewFolderParentId(null);
            setCreateFolderDialogOpen(true);
          }}
        >
          <FolderPlus className="h-4 w-4" />
          Nuovo Progetto
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-8 text-sm text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-900"
          onClick={() => {
            setNewFolderType("folder");
            setCreateFolderDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nuova Cartella
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex flex-1 overflow-hidden">
          {!isMobile && <FolderSidebar />}
          
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  {isMobile && (
                    <Button variant="outline" size="icon" onClick={() => setFolderSidebarOpen(true)}>
                      <Menu className="h-5 w-5" />
                    </Button>
                  )}
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                      <FileText className="h-8 w-8 text-blue-500" />
                      Gestione Post
                    </h1>
                    <p className="text-muted-foreground">
                      Crea e gestisci i tuoi contenuti social
                      {selectedFolderId && selectedFolderId !== "root" && (
                        <span className="ml-2 text-blue-600">
                          • {folders.find((f) => f.id === selectedFolderId)?.name || "Cartella selezionata"}
                        </span>
                      )}
                      {selectedFolderId === "root" && (
                        <span className="ml-2 text-gray-500">• Senza Cartella</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSyncStatuses}
                    disabled={isSyncingStatuses}
                    title="Aggiorna stato post da Publer"
                  >
                    <RefreshCw className={`h-4 w-4 ${isSyncingStatuses ? 'animate-spin' : ''}`} />
                  </Button>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                // Block closing during upload
                if (!open && (isUploadingMedia || isUploadingVideo)) {
                  return;
                }
                setIsDialogOpen(open);
                if (!open) {
                  setEditingPost(null);
                  setSourceIdeaId(null);
                  setSourceIdeaTitle(null);
                  setFormData({ title: "", hook: "", body: "", cta: "", platform: "", status: "draft", chiCosaCome: "", errore: "", soluzione: "", riprovaSociale: "", videoHook: "", videoProblema: "", videoSoluzione: "", videoCta: "", videoFullScript: "", videoUrl: "", imageDescription: "", imageOverlayText: "" });
                  setSuggestedHashtags([]);
                  resetCarouselState();
                  // Cleanup object URLs when dialog is closed without saving
                  uploadedMedia.forEach(m => {
                    if (m.localPreview) URL.revokeObjectURL(m.localPreview);
                  });
                  setUploadedMedia([]);
                  setUploadedVideo(null);
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
                        <Badge variant="secondary" className="text-xs">
                          <Sparkles className="h-3 w-3 mr-1 text-gray-500" />
                          Da idea: {sourceIdeaTitle}
                        </Badge>
                      </div>
                    )}
                  </DialogHeader>
                  <div className="py-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Colonna sinistra - Impostazioni */}
                      <div className="space-y-4">
                        <div className="space-y-4">
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
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
                                {selectedCopyType === "long" && "Copy Lungo"}
                                {selectedCopyType === "short" && "Copy Corto"}
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
                                  <SelectItem value="short">Copy Corto</SelectItem>
                                  <SelectItem value="long">Copy Lungo</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Tipo Media</Label>
                            {mediaTypeFromIdea ? (
                              <Badge variant="secondary" className="text-xs w-full justify-center py-2">
                                {selectedMediaType === "video" && "Video"}
                                {selectedMediaType === "foto" && "Foto"}
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
                                  <SelectItem value="video">Video</SelectItem>
                                  <SelectItem value="foto">Foto</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Sofisticazione Mercato</Label>
                            <Select
                              value={sophisticationLevel}
                              onValueChange={(value) => setSophisticationLevel(value as "level_1" | "level_2" | "level_3" | "level_4" | "level_5")}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona livello" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="level_1">Beneficio Diretto</SelectItem>
                                <SelectItem value="level_2">Amplifica Promessa</SelectItem>
                                <SelectItem value="level_3">Meccanismo Unico</SelectItem>
                                <SelectItem value="level_4">Meccanismo Migliorato</SelectItem>
                                <SelectItem value="level_5">Identità e Brand</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
                            <Layers className="h-5 w-5 text-gray-500" />
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
                              disabled={formData.platform === 'twitter'}
                              onCheckedChange={(checked) => {
                                setIsCarouselMode(checked);
                                if (checked && carouselSlides.length === 1 && !carouselSlides[0].title && !carouselSlides[0].content) {
                                  setCarouselSlides([{ title: "", content: "" }]);
                                }
                              }}
                            />
                            {formData.platform === 'twitter' && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                Twitter/X non supporta i caroselli
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 space-y-3">
                          <h4 className="font-semibold text-sm flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-gray-500" />
                            Genera con AI
                          </h4>
                          <Textarea
                            placeholder="Descrivi l'idea del post..."
                            value={ideaForCopy}
                            onChange={(e) => setIdeaForCopy(e.target.value)}
                            className="bg-background min-h-[60px]"
                            style={{ fieldSizing: 'content' } as React.CSSProperties}
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              onClick={handleGenerateCopy}
                              disabled={isGenerating}
                              className="flex-1"
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
                            <Layers className="h-4 w-4 text-gray-500" />
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
                                        ? "border-gray-900 dark:border-gray-100 bg-gray-100 dark:bg-gray-800 shadow-sm"
                                        : "border-border hover:border-gray-400 bg-background"
                                    }`}
                                    onClick={() => setActiveSlideIndex(index)}
                                  >
                                    <div className="flex items-start gap-2">
                                      <div
                                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                          activeSlideIndex === index
                                            ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
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
                                  value={carouselSlides[activeSlideIndex]?.content || ""}
                                  onChange={(e) =>
                                    handleUpdateSlide(activeSlideIndex, "content", e.target.value)
                                  }
                                  className="min-h-[100px]"
                                  style={{ fieldSizing: 'content' } as React.CSSProperties}
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
                                        ? "border-gray-900 dark:border-gray-100 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        : slide.title || slide.content
                                        ? "border-gray-400 bg-gray-50 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300"
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
                            
                            {/* Image Upload for Carousel */}
                            <div className="space-y-3 mt-4">
                              <Label className="flex items-center gap-2">
                                <ImagePlus className="h-4 w-4 text-gray-500" />
                                Immagini Carosello ({uploadedMedia.length}/{formData.platform === 'tiktok' ? 35 : 10})
                              </Label>
                              
                              <div
                                className={`relative border-2 border-dashed rounded-lg p-4 transition-all ${
                                  isDragOver 
                                    ? "border-gray-900 dark:border-gray-100 bg-gray-100 dark:bg-gray-800" 
                                    : "border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50"
                                } ${isUploadingMedia ? "opacity-50 pointer-events-none" : "hover:border-gray-400 dark:hover:border-gray-600 cursor-pointer"}`}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setIsDragOver(true);
                                }}
                                onDragLeave={(e) => {
                                  e.preventDefault();
                                  setIsDragOver(false);
                                }}
                                onDrop={async (e) => {
                                  e.preventDefault();
                                  setIsDragOver(false);
                                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                                  if (files.length === 0) return;
                                  
                                  const maxLimit = formData.platform === 'tiktok' ? 35 : 10;
                                  const remainingSlots = maxLimit - uploadedMedia.length;
                                  if (remainingSlots <= 0) {
                                    toast({ title: "Limite raggiunto", description: `Massimo ${maxLimit} immagini per ${formData.platform || 'Instagram'}`, variant: "destructive" });
                                    return;
                                  }
                                  
                                  const filesToUpload = files.slice(0, remainingSlots);
                                  await handleMediaUpload(filesToUpload);
                                }}
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.multiple = true;
                                  input.onchange = async (e) => {
                                    const files = Array.from((e.target as HTMLInputElement).files || []);
                                    if (files.length === 0) return;
                                    
                                    const maxLimit = formData.platform === 'tiktok' ? 35 : 10;
                                    const remainingSlots = maxLimit - uploadedMedia.length;
                                    if (remainingSlots <= 0) {
                                      toast({ title: "Limite raggiunto", description: `Massimo ${maxLimit} immagini per ${formData.platform || 'Instagram'}`, variant: "destructive" });
                                      return;
                                    }
                                    
                                    const filesToUpload = files.slice(0, remainingSlots);
                                    await handleMediaUpload(filesToUpload);
                                  };
                                  input.click();
                                }}
                              >
                                {isUploadingMedia ? (
                                  <div className="text-center py-2">
                                    <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin text-gray-500" />
                                    <p className="text-sm text-muted-foreground">Caricamento in corso...</p>
                                    <Progress value={uploadProgress} className="mt-2 h-1" />
                                  </div>
                                ) : (
                                  <div className="text-center py-2">
                                    <ImagePlus className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                                    <p className="text-sm text-muted-foreground">
                                      Trascina le immagini qui o clicca per selezionarle
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Max {formData.platform === 'tiktok' ? '35' : '10'} immagini • JPG, PNG, GIF, WebP
                                    </p>
                                  </div>
                                )}
                              </div>
                              
                              {uploadedMedia.length > 0 && (
                                <div className="grid grid-cols-5 gap-2">
                                  {uploadedMedia.map((media, idx) => (
                                    <div
                                      key={media.id}
                                      className="relative group aspect-square rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-gray-100 dark:bg-gray-900"
                                    >
                                      <img
                                        src={media.localPreview || media.thumbnail || media.path}
                                        alt={`Media ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Button
                                          variant="destructive"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Cleanup object URL to prevent memory leak
                                            if (media.localPreview) {
                                              URL.revokeObjectURL(media.localPreview);
                                            }
                                            setUploadedMedia(prev => prev.filter(m => m.id !== media.id));
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                                        {idx + 1}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 border-t pt-4">
                          <div className="space-y-2">
                            <Label htmlFor="carousel-caption" className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-gray-500" />
                              Caption del Carosello
                            </Label>
                            <Textarea
                              id="carousel-caption"
                              placeholder="Il testo che accompagna il carosello sui social..."
                              value={formData.body}
                              onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                              className="min-h-[80px]"
                              style={{ fieldSizing: 'content' } as React.CSSProperties}
                            />
                            <p className="text-xs text-muted-foreground">
                              Questa caption verrà pubblicata insieme alle immagini del carosello
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="carousel-cta">Call to Action</Label>
                            <Input
                              id="carousel-cta"
                              placeholder="Es: Scorri per scoprire di più!"
                              value={formData.cta}
                              onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                            />
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
                                value={formData.body}
                                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                                className="min-h-[60px]"
                                style={{ fieldSizing: 'content' } as React.CSSProperties}
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
                              <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg space-y-2 border border-gray-200 dark:border-gray-800">
                                <Label className="text-xs text-gray-600 dark:text-gray-400 font-semibold flex items-center gap-1">
                                  Copy Completo (dall'idea)
                                </Label>
                                <Textarea
                                  placeholder="Testo completo del copy..."
                                  value={formData.body}
                                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                                  className="text-sm min-h-[80px]"
                                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                                />
                                <p className="text-xs text-gray-500">
                                  Puoi copiare parti di questo testo nei campi sottostanti per strutturare il copy
                                </p>
                              </div>
                            )}
                            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-3 rounded-lg space-y-2">
                              <Label className="text-xs text-gray-600 dark:text-gray-400 font-semibold flex items-center gap-1">
                                1. Hook
                              </Label>
                              <Input
                                placeholder="La frase che cattura l'attenzione..."
                                value={formData.hook}
                                onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
                              />
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-3 rounded-lg space-y-2">
                              <Label className="text-xs text-gray-600 dark:text-gray-400 font-semibold flex items-center gap-1">
                                2. Chi-Cosa-Come
                              </Label>
                              <Textarea
                                placeholder="Ciao, sono [Nome] e aiuto [chi] a [cosa] attraverso [metodo]..."
                                value={formData.chiCosaCome || ""}
                                onChange={(e) => setFormData({ ...formData, chiCosaCome: e.target.value })}
                                className="min-h-[60px]"
                                style={{ fieldSizing: 'content' } as React.CSSProperties}
                              />
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-3 rounded-lg space-y-2">
                              <Label className="text-xs text-gray-600 dark:text-gray-400 font-semibold flex items-center gap-1">
                                3. Errore
                              </Label>
                              <Textarea
                                placeholder="L'errore specifico che il tuo target sta commettendo..."
                                value={formData.errore || ""}
                                onChange={(e) => setFormData({ ...formData, errore: e.target.value })}
                                className="min-h-[60px]"
                                style={{ fieldSizing: 'content' } as React.CSSProperties}
                              />
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-3 rounded-lg space-y-2">
                              <Label className="text-xs text-gray-600 dark:text-gray-400 font-semibold flex items-center gap-1">
                                4. Soluzione
                              </Label>
                              <Textarea
                                placeholder="Il tuo metodo unico per risolvere il problema..."
                                value={formData.soluzione || ""}
                                onChange={(e) => setFormData({ ...formData, soluzione: e.target.value })}
                                className="min-h-[60px]"
                                style={{ fieldSizing: 'content' } as React.CSSProperties}
                              />
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-3 rounded-lg space-y-2">
                              <Label className="text-xs text-gray-600 dark:text-gray-400 font-semibold flex items-center gap-1">
                                5. Riprova Sociale
                              </Label>
                              <Textarea
                                placeholder="Storie concrete con nomi ed eventi reali..."
                                value={formData.riprovaSociale || ""}
                                onChange={(e) => setFormData({ ...formData, riprovaSociale: e.target.value })}
                                className="min-h-[60px]"
                                style={{ fieldSizing: 'content' } as React.CSSProperties}
                              />
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-3 rounded-lg space-y-2">
                              <Label className="text-xs text-gray-600 dark:text-gray-400 font-semibold flex items-center gap-1">
                                6. Call to Action
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
                                  <Video className="h-4 w-4 text-gray-500" />
                                  Script Video (riferimento produzione)
                                </div>
                                {videoSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 space-y-3">
                              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-3 rounded-lg space-y-2">
                                <Label className="text-xs text-gray-600 dark:text-gray-400 font-semibold flex items-center gap-1">
                                  1. Hook Video
                                </Label>
                                <Textarea
                                  placeholder="La frase di apertura che cattura l'attenzione..."
                                  value={formData.videoHook || ""}
                                  onChange={(e) => setFormData({ ...formData, videoHook: e.target.value })}
                                  className="min-h-[60px]"
                                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                                />
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-3 rounded-lg space-y-2">
                                <Label className="text-xs text-gray-600 dark:text-gray-400 font-semibold flex items-center gap-1">
                                  2. Problema
                                </Label>
                                <Textarea
                                  placeholder="Il problema che affronti nel video..."
                                  value={formData.videoProblema || ""}
                                  onChange={(e) => setFormData({ ...formData, videoProblema: e.target.value })}
                                  className="min-h-[60px]"
                                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                                />
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-3 rounded-lg space-y-2">
                                <Label className="text-xs text-gray-600 dark:text-gray-400 font-semibold flex items-center gap-1">
                                  3. Soluzione
                                </Label>
                                <Textarea
                                  placeholder="La soluzione o il contenuto principale..."
                                  value={formData.videoSoluzione || ""}
                                  onChange={(e) => setFormData({ ...formData, videoSoluzione: e.target.value })}
                                  className="min-h-[60px]"
                                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                                />
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-3 rounded-lg space-y-2">
                                <Label className="text-xs text-gray-600 dark:text-gray-400 font-semibold flex items-center gap-1">
                                  4. CTA Video
                                </Label>
                                <Input
                                  placeholder="Chiamata all'azione finale..."
                                  value={formData.videoCta || ""}
                                  onChange={(e) => setFormData({ ...formData, videoCta: e.target.value })}
                                />
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-3 rounded-lg space-y-2">
                                <Label className="text-xs text-gray-600 dark:text-gray-400 font-semibold flex items-center gap-1">
                                  Script Completo
                                </Label>
                                <Textarea
                                  placeholder="Lo script completo del video da leggere..."
                                  value={formData.videoFullScript || ""}
                                  onChange={(e) => setFormData({ ...formData, videoFullScript: e.target.value })}
                                  className="font-mono text-sm min-h-[100px]"
                                  style={{ fieldSizing: 'content' } as React.CSSProperties}
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
                                  <Image className="h-4 w-4 text-gray-500" />
                                  Descrizione Immagine (riferimento grafico)
                                </div>
                                {imageSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-3 space-y-3">
                              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-3 rounded-lg space-y-2">
                                <Label className="text-xs text-gray-600 dark:text-gray-400 font-semibold">
                                  Descrizione Immagine
                                </Label>
                                <Textarea
                                  placeholder="Descrivi il concetto visivo dell'immagine..."
                                  value={formData.imageDescription || ""}
                                  onChange={(e) => setFormData({ ...formData, imageDescription: e.target.value })}
                                  className="min-h-[60px]"
                                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                                />
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 p-3 rounded-lg space-y-2">
                                <Label className="text-xs text-gray-600 dark:text-gray-400 font-semibold">
                                  Testo Overlay
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
                          <Video className="h-4 w-4 text-gray-500" />
                          Video
                        </Label>
                        <Tabs value={videoSourceType} onValueChange={(v) => setVideoSourceType(v as 'link' | 'upload')} className="w-full">
                          <TabsList className="grid w-full grid-cols-2 bg-gray-50 dark:bg-gray-900/50">
                            <TabsTrigger value="link" className="text-xs">Link Esterno</TabsTrigger>
                            <TabsTrigger value="upload" className="text-xs">Carica Video</TabsTrigger>
                          </TabsList>
                          <TabsContent value="link" className="mt-3">
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="https://youtube.com/watch?v=..."
                                    value={formData.videoUrl || ""}
                                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                                    className="pl-10"
                                  />
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Inserisci link a YouTube, TikTok, Instagram, etc.
                              </p>
                            </div>
                          </TabsContent>
                          <TabsContent value="upload" className="mt-3">
                            <div className="space-y-3">
                              {isUploadingVideo ? (
                                <div className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg p-6 text-center bg-blue-50 dark:bg-blue-950/20">
                                  <Loader2 className="h-8 w-8 mx-auto text-blue-500 mb-2 animate-spin" />
                                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                    Caricamento su Publer...
                                  </p>
                                  <Progress value={videoUploadProgress} className="mt-3 h-2 max-w-xs mx-auto" />
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Non chiudere questa finestra
                                  </p>
                                </div>
                              ) : uploadedVideo ? (
                                <div className="space-y-3">
                                  <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                                    <video
                                      src={uploadedVideo.path}
                                      className="w-full max-h-48 object-contain bg-black"
                                      controls
                                    />
                                    <Button
                                      variant="destructive"
                                      size="icon"
                                      className="absolute top-2 right-2 h-6 w-6"
                                      onClick={() => setUploadedVideo(null)}
                                      type="button"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    <p className="text-xs text-green-600">Video caricato su Publer - pronto per la pubblicazione</p>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg p-6 text-center hover:border-gray-400 dark:hover:border-gray-600 transition-colors cursor-pointer bg-gray-50 dark:bg-gray-900/50"
                                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const files = e.dataTransfer.files;
                                    if (files.length > 0) handleVideoUpload(files[0]);
                                  }}
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm';
                                    input.onchange = (e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                      if (file) handleVideoUpload(file);
                                    };
                                    input.click();
                                  }}
                                >
                                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                                  <p className="text-sm text-muted-foreground">
                                    Trascina un video o clicca per selezionare
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    MP4, MOV, WebM (max 50MB)
                                  </p>
                                </div>
                              )}
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <ImagePlus className="h-4 w-4 text-gray-500" />
                          Immagine {uploadedMedia.length > 0 && `(${uploadedMedia.length})`}
                        </Label>
                        
                        {isUploadingMedia ? (
                          <div className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg p-8 text-center bg-blue-50 dark:bg-blue-950/20">
                            <Loader2 className="h-8 w-8 mx-auto text-blue-500 mb-2 animate-spin" />
                            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                              Caricamento su Publer...
                            </p>
                            <Progress value={uploadProgress} className="mt-3 h-2" />
                            <p className="text-xs text-muted-foreground mt-2">
                              Non chiudere questa finestra
                            </p>
                          </div>
                        ) : uploadedMedia.length > 0 ? (
                          <div className="space-y-3">
                            <div className="relative inline-block">
                              <img
                                src={uploadedMedia[0].localPreview || `/api/publer/media-proxy?url=${encodeURIComponent(uploadedMedia[0].path || '')}`}
                                alt="Immagine caricata"
                                className="max-h-40 rounded-lg border"
                              />
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute -top-2 -right-2 h-6 w-6"
                                onClick={() => {
                                  if (uploadedMedia[0].localPreview) {
                                    URL.revokeObjectURL(uploadedMedia[0].localPreview);
                                  }
                                  setUploadedMedia([]);
                                }}
                                type="button"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <p className="text-xs text-green-600">Caricata su Publer - pronta per la pubblicazione</p>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) {
                                  handleMediaUpload([file]);
                                }
                              };
                              input.click();
                            }}
                          >
                            <ImagePlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Clicca per caricare un'immagine
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              PNG, JPG, GIF, WebP fino a 10MB
                            </p>
                          </div>
                        )}
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
                          setFormData({ ...formData, status: "draft" });
                          setOpenPublerAfterSave(true);
                          handleCreatePost();
                        }}
                        disabled={createPostMutation.isPending}
                      >
                        {createPostMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Pubblica con Publer
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
                </div>
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
                <div className="flex flex-col gap-4">
                  {/* Row 1: Search bar prominente */}
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca per titolo, hook o contenuto..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-10"
                    />
                  </div>
                  
                  {/* Row 2: Filters and view toggle */}
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Filtri:</span>
                    </div>
                    <Select value={filterPlatform} onValueChange={setFilterPlatform}>
                      <SelectTrigger className="w-[130px] h-9">
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
                      <SelectTrigger className="w-[130px] h-9">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti</SelectItem>
                        <SelectItem value="draft">Bozza</SelectItem>
                        <SelectItem value="scheduled">Programmato</SelectItem>
                        <SelectItem value="published">Pubblicato</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={sortPosts} onValueChange={setSortPosts}>
                      <SelectTrigger className="w-[130px] h-9">
                        <SelectValue placeholder="Ordina" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date-desc">Data recente</SelectItem>
                        <SelectItem value="title-asc">Titolo A-Z</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {/* View toggle */}
                    <div className="flex items-center gap-1 ml-auto border rounded-lg p-1">
                      <Button
                        variant={viewMode === "list" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setViewMode("list")}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === "grid" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setViewMode("grid")}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {isLoading ? (
              <div className={viewMode === "list" ? "space-y-2" : "grid grid-cols-1 lg:grid-cols-2 gap-4"}>
                {Array.from({ length: 4 }).map((_, i) => (
                  viewMode === "list" ? (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="h-5 flex-1" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  ) : (
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
                  )
                ))}
              </div>
            ) : filteredPosts.length > 0 ? (
              viewMode === "list" ? (
                <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-[1fr_120px_100px_100px_40px] gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    <span>Nome</span>
                    <span>Stato</span>
                    <span>Data</span>
                    <span>Piattaforma</span>
                    <span></span>
                  </div>
                  {filteredPosts.map((post, index) => {
                    const structured = post.structuredContent || {};
                    const hookText = structured.hook || post.hook || "";
                    
                    const renderPublerStatus = () => {
                      if (post.publerStatus === 'scheduled' && post.publerScheduledAt) {
                        const scheduledDate = new Date(post.publerScheduledAt);
                        return (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <Clock className="h-3 w-3" />
                            {scheduledDate.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} {scheduledDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        );
                      }
                      if (post.publerStatus === 'published') {
                        return (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Pubblicato
                          </span>
                        );
                      }
                      if (post.publerStatus === 'failed') {
                        return (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                            <XCircle className="h-3 w-3" />
                            Errore
                          </span>
                        );
                      }
                      return null;
                    };
                    
                    const getSimpleStatusText = (status: string) => {
                      switch (status?.toLowerCase()) {
                        case "draft":
                        case "bozza":
                          return <span className="text-gray-500">Bozza</span>;
                        case "scheduled":
                        case "programmato":
                          return <span className="text-amber-600 dark:text-amber-400">Programmato</span>;
                        case "published":
                        case "pubblicato":
                          return <span className="text-green-600 dark:text-green-400">Pubblicato</span>;
                        default:
                          return <span className="text-gray-500">{status}</span>;
                      }
                    };
                    
                    return (
                      <div
                        key={post.id}
                        className={`grid grid-cols-[1fr_120px_100px_100px_40px] gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors cursor-pointer items-center`}
                        onClick={() => setViewingPost(post)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <h4 className="text-sm text-gray-900 dark:text-gray-100 truncate">
                              {post.title || "Post senza titolo"}
                            </h4>
                            {hookText && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {hookText}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-sm">
                          {renderPublerStatus() || getSimpleStatusText(post.status)}
                        </div>
                        
                        <div className="flex flex-col">
                          {post.scheduledDate ? (
                            <>
                              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                📅 {new Date(post.scheduledDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                Creato: {new Date(post.createdAt || "").toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {new Date(post.createdAt || "").toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          {getPlatformIcon(post.platform)}
                          <span className="text-sm text-gray-600 dark:text-gray-400 capitalize hidden sm:inline">
                            {post.platform}
                          </span>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                              style={{ opacity: 1 }}
                            >
                              <MoreHorizontal className="h-4 w-4 text-gray-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditPost(post); }}>
                              <Pencil className="h-3.5 w-3.5 mr-2" />
                              Modifica
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setPublerPost(post); setPublerDialogOpen(true); }}>
                              <Send className="h-3.5 w-3.5 mr-2" />
                              Pubblica su Publer
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <MoveRight className="h-3.5 w-3.5 mr-2" />
                                Sposta in cartella
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-44">
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); moveToFolderMutation.mutate({ postId: post.id, folderId: null }); }}
                                  disabled={!post.folderId}
                                >
                                  <Folder className="h-3.5 w-3.5 mr-2 text-gray-400" />
                                  Senza Cartella
                                </DropdownMenuItem>
                                {folders.length > 0 && <DropdownMenuSeparator />}
                                {folders.map((folder) => (
                                  <DropdownMenuItem
                                    key={folder.id}
                                    onClick={(e) => { e.stopPropagation(); moveToFolderMutation.mutate({ postId: post.id, folderId: folder.id }); }}
                                    disabled={post.folderId === folder.id}
                                  >
                                    {folder.folderType === "project" ? (
                                      <FolderOpen className="h-3.5 w-3.5 mr-2" style={{ color: folder.color || "#6366f1" }} />
                                    ) : (
                                      <Folder className="h-3.5 w-3.5 mr-2" style={{ color: folder.color || "#94a3b8" }} />
                                    )}
                                    {folder.name}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={(e) => { e.stopPropagation(); deletePostMutation.mutate(post.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Elimina
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredPosts.map((post) => {
                  const structured = post.structuredContent || {};
                  const hookText = structured.hook || post.hook || "";
                  const bodyText = structured.body || post.body || "";
                  const hasVideoScript = !!(structured.videoFullScript || post.videoFullScript);
                  const hasImageDesc = !!(structured.imageDescription || post.imageDescription);
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
                                {post.scheduledDate 
                                  ? `📅 ${new Date(post.scheduledDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}`
                                  : new Date(post.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
                                }
                              </span>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleEditPost(post)}>
                                <FileText className="h-4 w-4 mr-2" />
                                Modifica
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setPublerPost(post); setPublerDialogOpen(true); }}>
                                <Send className="h-4 w-4 mr-2 text-pink-500" />
                                Pubblica su Publer
                              </DropdownMenuItem>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <MoveRight className="h-4 w-4 mr-2" />
                                  Sposta in cartella
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-48">
                                  <DropdownMenuItem
                                    onClick={() => moveToFolderMutation.mutate({ postId: post.id, folderId: null })}
                                    disabled={!post.folderId}
                                  >
                                    <Folder className="h-4 w-4 mr-2 text-gray-400" />
                                    Senza Cartella
                                  </DropdownMenuItem>
                                  {folders.length > 0 && <DropdownMenuSeparator />}
                                  {folders.map((folder) => (
                                    <DropdownMenuItem
                                      key={folder.id}
                                      onClick={() => moveToFolderMutation.mutate({ postId: post.id, folderId: folder.id })}
                                      disabled={post.folderId === folder.id}
                                    >
                                      {folder.folderType === "project" ? (
                                        <FolderOpen className="h-4 w-4 mr-2" style={{ color: folder.color || "#6366f1" }} />
                                      ) : (
                                        <Folder className="h-4 w-4 mr-2" style={{ color: folder.color || "#94a3b8" }} />
                                      )}
                                      {folder.name}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => deletePostMutation.mutate(post.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Elimina
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Folder badge */}
                        {post.folder && (
                          <div className="mb-2">
                            <span 
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800"
                              style={{ borderLeft: `3px solid ${post.folder.color || "#6366f1"}` }}
                            >
                              <Folder className="h-3 w-3" style={{ color: post.folder.color || "#6366f1" }} />
                              {post.folder.name}
                            </span>
                          </div>
                        )}

                        {/* Title */}
                        <h3 className="font-semibold text-base leading-tight line-clamp-2 mb-3">
                          {post.title || "Post senza titolo"}
                        </h3>

                        {/* Content type badge */}
                        {post.contentType && (
                          <div className="mb-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {post.contentType}
                            </span>
                          </div>
                        )}

                        {/* Hook preview */}
                        {hookText && (
                          <div className="mb-3 p-3 rounded-lg bg-gradient-to-r from-purple-50/80 to-pink-50/80 dark:from-purple-950/30 dark:to-pink-950/30 border-l-3 border-purple-400">
                            <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold mb-1">🎣 Hook</p>
                            <p className="text-sm text-muted-foreground line-clamp-2 italic">
                              "{hookText}"
                            </p>
                          </div>
                        )}

                        {/* Body preview */}
                        {bodyText && !hookText && (
                          <div className="mb-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
                            <p className="text-xs text-muted-foreground font-semibold mb-1">📝 Contenuto</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {bodyText}
                            </p>
                          </div>
                        )}

                        {/* Tags row */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
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
                          {hasVideoScript && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                              🎬 Script
                            </span>
                          )}
                          {hasImageDesc && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                              🖼️ Immagine
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
              )
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
        <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0 flex flex-col">
          {viewingPost && (() => {
            const viewStructured = viewingPost.structuredContent || {};
            const viewCopyType = viewStructured.copyType || viewingPost.copyType || "short";
            const hookText = viewStructured.hook || viewingPost.hook;
            const bodyText = viewStructured.body || viewingPost.body;
            const ctaText = viewStructured.cta || viewingPost.cta;
            
            return (
              <div className="flex flex-col lg:flex-row flex-1 min-h-0">
                {/* Left Panel - Phone Mockup Preview */}
                <div className="lg:w-[420px] flex-shrink-0 bg-gradient-to-br from-slate-100 via-slate-50 to-white dark:from-zinc-900 dark:via-zinc-950 dark:to-black p-6 border-b lg:border-b-0 lg:border-r max-h-[350px] lg:max-h-full flex items-start justify-center overflow-hidden">
                  <div className="sticky top-0">
                    {/* Platform indicator */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <div className={`p-2.5 rounded-xl shadow-lg ${
                        viewingPost.platform === "instagram" ? "bg-gradient-to-br from-purple-500 to-pink-500" :
                        viewingPost.platform === "facebook" ? "bg-gradient-to-br from-blue-500 to-blue-600" :
                        viewingPost.platform === "linkedin" ? "bg-gradient-to-br from-blue-600 to-blue-700" :
                        viewingPost.platform === "twitter" ? "bg-gradient-to-br from-gray-800 to-black" :
                        viewingPost.platform === "tiktok" ? "bg-gradient-to-br from-gray-900 to-black" :
                        "bg-gradient-to-br from-gray-500 to-gray-600"
                      }`}>
                        <div className="text-white">
                          {getPlatformIcon(viewingPost.platform)}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold capitalize">{viewingPost.platform}</h4>
                        <p className="text-xs text-muted-foreground">Anteprima Live</p>
                      </div>
                    </div>
                    
                    {/* Phone Mockup Frame */}
                    <div className="relative mx-auto" style={{ width: "280px" }}>
                      {/* Phone outer frame */}
                      <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900 rounded-[2.5rem] shadow-2xl" style={{ transform: "scale(1.02)" }} />
                      
                      {/* Phone inner bezel */}
                      <div className="relative bg-gray-900 rounded-[2.3rem] p-2 shadow-inner">
                        {/* Dynamic Island / Notch */}
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-10" />
                        
                        {/* Screen */}
                        <div className="relative bg-white dark:bg-black rounded-[1.8rem] overflow-hidden" style={{ height: "500px" }}>
                          {/* Status bar */}
                          <div className="absolute top-0 inset-x-0 h-11 bg-white/80 dark:bg-black/80 backdrop-blur-sm z-10 flex items-end justify-between px-6 pb-1">
                            <span className="text-xs font-semibold">9:41</span>
                            <div className="flex items-center gap-1">
                              <div className="w-4 h-2 border border-current rounded-sm relative">
                                <div className="absolute inset-0.5 bg-current rounded-sm" style={{ width: "70%" }} />
                              </div>
                            </div>
                          </div>
                          
                          {/* App content - scrollable */}
                          <div className="h-full overflow-y-auto pt-11 pb-6 scrollbar-thin">
                            <div className="transform scale-[0.72] origin-top" style={{ width: "138.88%" }}>
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
                          
                          {/* Home indicator */}
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                        </div>
                      </div>
                      
                      {/* Side buttons */}
                      <div className="absolute left-0 top-24 w-1 h-8 bg-gray-700 rounded-l-full" />
                      <div className="absolute left-0 top-36 w-1 h-12 bg-gray-700 rounded-l-full" />
                      <div className="absolute left-0 top-52 w-1 h-12 bg-gray-700 rounded-l-full" />
                      <div className="absolute right-0 top-32 w-1 h-16 bg-gray-700 rounded-r-full" />
                    </div>
                  </div>
                </div>

                {/* Right Panel - Content */}
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                  {/* Header */}
                  <div className="px-6 py-4 border-b bg-white dark:bg-zinc-950 flex-shrink-0">
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

                  {/* Content Sections with Tabs */}
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {/* Schedule info - always visible */}
                    {viewingPost.scheduledDate && (
                      <div className="mx-6 mt-4 flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/30">
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

                    {/* Tabbed Content */}
                    <Tabs defaultValue="copy" className="flex-1 flex flex-col">
                      <div className="px-6 pt-4 pb-2 border-b bg-slate-50/50 dark:bg-zinc-900/50">
                        <TabsList className="grid w-full grid-cols-3 h-10">
                          <TabsTrigger value="copy" className="text-xs font-medium">
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            Copy
                          </TabsTrigger>
                          <TabsTrigger value="video" className="text-xs font-medium">
                            <Video className="h-3.5 w-3.5 mr-1.5" />
                            Video
                          </TabsTrigger>
                          <TabsTrigger value="visual" className="text-xs font-medium">
                            <Image className="h-3.5 w-3.5 mr-1.5" />
                            Visual
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      {/* Copy Tab */}
                      <TabsContent value="copy" className="flex-1 p-6 space-y-4 m-0">
                        {/* Copy All Button */}
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const fullText = [bodyText, hookText, ctaText].filter(Boolean).join("\n\n");
                              navigator.clipboard.writeText(fullText);
                              toast({ title: "Copiato!", description: "Testo completo copiato negli appunti" });
                            }}
                            className="gap-2"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copia Tutto
                          </Button>
                        </div>

                        {/* Body/Contenuto - Prima */}
                        {bodyText && (
                          <div className="rounded-xl overflow-hidden border group relative">
                            <div className="bg-slate-100 dark:bg-zinc-800 px-4 py-2 flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">📝 Contenuto</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                                onClick={() => {
                                  navigator.clipboard.writeText(bodyText);
                                  toast({ title: "Copiato!", description: "Contenuto copiato" });
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="bg-white dark:bg-zinc-900 p-4">
                              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                                {formatTextWithHashtags(bodyText)}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Hook - Dopo contenuto */}
                        {hookText && (
                          <div className="rounded-xl overflow-hidden group relative">
                            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 flex items-center justify-between">
                              <span className="text-xs font-semibold text-white/90 uppercase tracking-wide">🎣 Hook</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/20"
                                onClick={() => {
                                  navigator.clipboard.writeText(hookText);
                                  toast({ title: "Copiato!", description: "Hook copiato" });
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 p-4">
                              <p className="text-sm font-medium leading-relaxed">{hookText}</p>
                            </div>
                          </div>
                        )}

                        {/* Long Copy Sections - Prima del CTA */}
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

                        {/* CTA - Alla fine */}
                        {ctaText && (
                          <div className="rounded-xl overflow-hidden group relative">
                            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2 flex items-center justify-between">
                              <span className="text-xs font-semibold text-white/90 uppercase tracking-wide">🎯 Call to Action</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/20"
                                onClick={() => {
                                  navigator.clipboard.writeText(ctaText);
                                  toast({ title: "Copiato!", description: "CTA copiato" });
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 p-4">
                              <p className="text-sm font-medium">{ctaText}</p>
                            </div>
                          </div>
                        )}
                      </TabsContent>

                      {/* Video Tab */}
                      <TabsContent value="video" className="flex-1 p-6 space-y-4 m-0">
                        {(() => {
                          const videoFullScript = viewStructured.videoFullScript || viewingPost.videoFullScript;
                          const videoHook = viewStructured.videoHook || viewingPost.videoHook;
                          const videoProblema = viewStructured.videoProblema || viewingPost.videoProblema;
                          const videoSoluzione = viewStructured.videoSoluzione || viewingPost.videoSoluzione;
                          const videoCta = viewStructured.videoCta || viewingPost.videoCta;
                          
                          if (videoFullScript || videoHook || videoProblema || videoSoluzione || videoCta) {
                            return (
                              <>
                                {/* Copy Script Button */}
                                <div className="flex justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard.writeText(videoFullScript || [videoHook, videoProblema, videoSoluzione, videoCta].filter(Boolean).join("\n\n"));
                                      toast({ title: "Copiato!", description: "Script video copiato negli appunti" });
                                    }}
                                    className="gap-2"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    Copia Script
                                  </Button>
                                </div>

                                <div className="rounded-xl border overflow-hidden">
                                  <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Video className="h-5 w-5 text-white" />
                                      <span className="text-sm font-semibold text-white">Script Video Completo</span>
                                    </div>
                                  </div>
                                  <div className="bg-white dark:bg-zinc-900 p-4">
                                    <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">{videoFullScript || "Nessuno script video generato"}</pre>
                                  </div>
                                </div>

                                {(videoHook || videoProblema || videoSoluzione || videoCta) && (
                                  <div className="rounded-xl border overflow-hidden">
                                    <div className="bg-slate-100 dark:bg-zinc-800 px-4 py-2">
                                      <span className="text-xs font-semibold uppercase tracking-wide">Sezioni Script</span>
                                    </div>
                                    <div className="divide-y">
                                      {videoHook && (
                                        <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20">
                                          <p className="text-xs font-semibold text-purple-600 mb-1">🎬 Video Hook</p>
                                          <p className="text-sm">{videoHook}</p>
                                        </div>
                                      )}
                                      {videoProblema && (
                                        <div className="p-4 bg-red-50/50 dark:bg-red-950/20">
                                          <p className="text-xs font-semibold text-red-600 mb-1">❓ Problema</p>
                                          <p className="text-sm">{videoProblema}</p>
                                        </div>
                                      )}
                                      {videoSoluzione && (
                                        <div className="p-4 bg-green-50/50 dark:bg-green-950/20">
                                          <p className="text-xs font-semibold text-green-600 mb-1">💡 Soluzione</p>
                                          <p className="text-sm">{videoSoluzione}</p>
                                        </div>
                                      )}
                                      {videoCta && (
                                        <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20">
                                          <p className="text-xs font-semibold text-blue-600 mb-1">📢 CTA Video</p>
                                          <p className="text-sm">{videoCta}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          }
                          return (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                              <Video className="h-12 w-12 text-muted-foreground/50 mb-4" />
                              <p className="text-muted-foreground">Nessuno script video disponibile</p>
                              <p className="text-sm text-muted-foreground/70 mt-1">Genera uno script video per questo post</p>
                            </div>
                          );
                        })()}
                      </TabsContent>

                      {/* Visual Tab */}
                      <TabsContent value="visual" className="flex-1 p-6 space-y-4 m-0">
                        {(() => {
                          const imageDescription = viewStructured.imageDescription || viewingPost.imageDescription;
                          const imageOverlayText = viewStructured.imageOverlayText || viewingPost.imageOverlayText;
                          
                          if (imageDescription || imageOverlayText) {
                            return (
                              <>
                                {/* Copy Visual Button */}
                                <div className="flex justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const visualText = [imageDescription, imageOverlayText ? `Overlay: ${imageOverlayText}` : null].filter(Boolean).join("\n\n");
                                      navigator.clipboard.writeText(visualText);
                                      toast({ title: "Copiato!", description: "Descrizione visiva copiata" });
                                    }}
                                    className="gap-2"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    Copia Descrizione
                                  </Button>
                                </div>

                                <div className="rounded-xl border overflow-hidden">
                                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 flex items-center gap-2">
                                    <Image className="h-5 w-5 text-white" />
                                    <span className="text-sm font-semibold text-white">Descrizione Visiva</span>
                                  </div>
                                  <div className="bg-white dark:bg-zinc-900 p-4 space-y-4">
                                    {imageDescription && (
                                      <div>
                                        <p className="text-xs font-semibold text-emerald-600 mb-2">🖼️ Concept Immagine</p>
                                        <p className="text-sm leading-relaxed">{imageDescription}</p>
                                      </div>
                                    )}
                                    {imageOverlayText && (
                                      <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-zinc-800 dark:to-zinc-900 p-4 rounded-xl text-center border-2 border-dashed border-slate-300 dark:border-zinc-600">
                                        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Testo Overlay</p>
                                        <p className="text-lg font-bold">{imageOverlayText}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </>
                            );
                          }
                          return (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                              <Image className="h-12 w-12 text-muted-foreground/50 mb-4" />
                              <p className="text-muted-foreground">Nessuna descrizione visiva</p>
                              <p className="text-sm text-muted-foreground/70 mt-1">Aggiungi una descrizione dell'immagine per questo post</p>
                            </div>
                          );
                        })()}
                      </TabsContent>
                    </Tabs>
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-3 border-t bg-slate-50 dark:bg-zinc-900 flex-shrink-0">
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

      {isMobile && <FolderSidebar />}

      <Dialog open={createFolderDialogOpen} onOpenChange={setCreateFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {newFolderType === "project" ? (
                <>
                  <FolderOpen className="h-5 w-5 text-indigo-500" />
                  Nuovo Progetto
                </>
              ) : (
                <>
                  <FolderPlus className="h-5 w-5 text-gray-500" />
                  Nuova Cartella
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {newFolderType === "project" 
                ? "I progetti sono contenitori principali per organizzare i tuoi post."
                : "Le cartelle sono sottocartelle all'interno di un progetto."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Nome</Label>
              <Input
                id="folder-name"
                placeholder={newFolderType === "project" ? "es. Campagna Estiva 2026" : "es. Contenuti Instagram"}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            </div>
            {newFolderType === "folder" && folders.length > 0 && (
              <div className="space-y-2">
                <Label>Cartella padre (opzionale)</Label>
                <Select
                  value={newFolderParentId || "none"}
                  onValueChange={(val) => setNewFolderParentId(val === "none" ? null : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona cartella padre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuna (livello principale)</SelectItem>
                    {(() => {
                      const renderOptions = (items: ContentFolder[], depth: number = 0): React.ReactNode[] => {
                        return items.flatMap((folder) => [
                          <SelectItem key={folder.id} value={folder.id}>
                            <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 12}px` }}>
                              {folder.folderType === "project" ? (
                                <FolderOpen className="h-4 w-4" style={{ color: folder.color || "#6366f1" }} />
                              ) : (
                                <Folder className="h-4 w-4" style={{ color: folder.color || "#94a3b8" }} />
                              )}
                              {folder.name}
                            </div>
                          </SelectItem>,
                          ...(folder.children ? renderOptions(folder.children, depth + 1) : []),
                        ]);
                      };
                      return renderOptions(folderHierarchy);
                    })()}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateFolderDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={() => {
                if (!newFolderName.trim()) {
                  toast({ title: "Errore", description: "Inserisci un nome", variant: "destructive" });
                  return;
                }
                createFolderMutation.mutate({
                  name: newFolderName.trim(),
                  folderType: newFolderType,
                  parentId: newFolderParentId,
                });
              }}
              disabled={createFolderMutation.isPending}
            >
              {createFolderMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Crea
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={renameFolderId !== null} onOpenChange={(open) => { if (!open) { setRenameFolderId(null); setRenameFolderName(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-500" />
              Rinomina
            </DialogTitle>
            <DialogDescription>
              Inserisci il nuovo nome per la cartella o il progetto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-folder-name">Nome</Label>
              <Input
                id="rename-folder-name"
                placeholder="Nuovo nome"
                value={renameFolderName}
                onChange={(e) => setRenameFolderName(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setRenameFolderId(null); setRenameFolderName(""); }}>
              Annulla
            </Button>
            <Button
              onClick={() => {
                if (!renameFolderName.trim()) {
                  toast({ title: "Errore", description: "Inserisci un nome", variant: "destructive" });
                  return;
                }
                if (renameFolderId) {
                  renameFolderMutation.mutate({
                    folderId: renameFolderId,
                    name: renameFolderName.trim(),
                  });
                }
              }}
              disabled={renameFolderMutation.isPending}
            >
              {renameFolderMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Salva
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PublerPublishDialog
        open={publerDialogOpen}
        onOpenChange={setPublerDialogOpen}
        post={publerPost}
      />
      </div>
    </div>
  );
}
