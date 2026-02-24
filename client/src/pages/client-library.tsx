import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  Search,
  Clock,
  CheckCircle,
  CheckCircle2,
  FileText,
  ArrowRight,
  ArrowLeft,
  Download,
  PlusCircle,
  Send,
  GraduationCap,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Play,
  PlayCircle,
  Menu,
  HelpCircle,
  ClipboardList,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { driverConfig } from '@/lib/tour/driver-config';
import { libraryCategoriesTourSteps } from '@/components/interactive-tour/library-categories-tour-steps';
import { libraryLessonsTourSteps } from '@/components/interactive-tour/library-lessons-tour-steps';

// Video Player Component
interface VideoPlayerProps {
  url: string;
  title: string;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, title, className = "" }) => {
  const getEmbedUrl = (videoUrl: string) => {
    try {
      const urlObj = new URL(videoUrl);

      // YouTube
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
        let videoId = '';

        if (urlObj.hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.slice(1);
        } else if (urlObj.searchParams.get('v')) {
          videoId = urlObj.searchParams.get('v')!;
        }

        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&showinfo=0`;
        }
      }

      // Vimeo
      if (urlObj.hostname.includes('vimeo.com')) {
        const videoId = urlObj.pathname.split('/').pop();
        if (videoId) {
          return `https://player.vimeo.com/video/${videoId}?byline=0&portrait=0`;
        }
      }

      // Wistia
      if (urlObj.hostname.includes('wistia.com')) {
        const videoId = urlObj.pathname.split('/').pop();
        if (videoId) {
          return `https://fast.wistia.net/embed/iframe/${videoId}`;
        }
      }

      // If it's already an embed URL, return as is
      if (videoUrl.includes('embed') || videoUrl.includes('player')) {
        return videoUrl;
      }

      return videoUrl;
    } catch (error) {
      console.error('Error parsing video URL:', error);
      return videoUrl;
    }
  };

  const embedUrl = getEmbedUrl(url);

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      <iframe
        src={embedUrl}
        title={title}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="w-full h-full"
        style={{ minHeight: '200px' }}
        loading="lazy"
      />

      {/* Fallback for unsupported videos */}
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
        <div className="text-center p-4">
          <Play size={48} className="mx-auto mb-2 opacity-70" />
          <p className="text-sm opacity-70">Video Player</p>
        </div>
      </div>
    </div>
  );
};
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { getAuthHeaders, getAuthUser } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";

import { type LibraryCategory, type LibraryDocument, type LibraryDocumentSection, type ClientLibraryProgress, type LibrarySubcategory } from "@shared/schema";

function ModuleAccordionItem({
  subcategory,
  documents,
  completedCount,
  activeDocumentId,
  isDocumentRead,
  onSelectDocument,
  defaultOpen,
}: {
  subcategory: any;
  documents: any[];
  completedCount: number;
  activeDocumentId: string | null;
  isDocumentRead: (id: string) => boolean;
  onSelectDocument: (doc: any) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (documents.some(d => d.id === activeDocumentId)) setOpen(true);
  }, [activeDocumentId, documents]);

  const getEmojiIcon = (iconName: string) => {
    switch (iconName) {
      case "BookOpen": return "📖";
      case "FileText": return "📄";
      case "Folder": return "📁";
      default: return "📚";
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-border/60 bg-card/50 shadow-sm">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors"
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base bg-gradient-to-br from-purple-500 to-indigo-600 flex-shrink-0 shadow-sm">
          {getEmojiIcon(subcategory.icon || "Folder")}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight truncate">{subcategory.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {completedCount}/{documents.length} completate
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {completedCount === documents.length && documents.length > 0 && (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 space-y-0.5">
              {documents.map((doc: any) => {
                const isActive = doc.id === activeDocumentId;
                const isRead = isDocumentRead(doc.id);

                return (
                  <button
                    key={doc.id}
                    onClick={() => onSelectDocument(doc)}
                    className={cn(
                      "w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all group",
                      isActive
                        ? "bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700"
                        : "hover:bg-muted/60"
                    )}
                  >
                    <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      {isRead ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 transition-colors",
                          isActive
                            ? "border-indigo-500"
                            : "border-muted-foreground/30 group-hover:border-indigo-400"
                        )} />
                      )}
                    </div>
                    <span className={cn(
                      "text-sm flex-1 leading-tight truncate",
                      isActive ? "font-semibold text-indigo-700 dark:text-indigo-300" : "text-foreground",
                      isRead && !isActive && "text-muted-foreground"
                    )}>
                      {doc.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {doc.estimatedDuration || 5}m
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ClientLibrary() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const user = getAuthUser();
  const [, setLocation] = useLocation();

  // Check URL params for category
  const urlParams = new URLSearchParams(window.location.search);
  const categoryFromUrl = urlParams.get('category');

  const [selectedCategory, setSelectedCategory] = useState<string>(categoryFromUrl || "all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({
    title: "",
    description: "",
    category: "",
    priority: "medium",
    suggestedLevel: "base"
  });
  const [isTourActive, setIsTourActive] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch categories (only visible ones for client)
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/library/categories/client/visible"],
    queryFn: async () => {
      const response = await fetch("/api/library/categories/client/visible", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  // Fetch subcategories
  const { data: subcategories = [] } = useQuery({
    queryKey: ["/api/library/subcategories"],
    queryFn: async () => {
      const response = await fetch("/api/library/subcategories", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch subcategories");
      return response.json();
    },
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ["/api/library/documents", {
      categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
      subcategoryId: selectedSubcategory !== "all" ? selectedSubcategory : undefined,
      level: selectedLevel !== "all" ? selectedLevel : undefined,
      search: searchTerm
    }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("categoryId", selectedCategory);
      if (selectedSubcategory !== "all") params.append("subcategoryId", selectedSubcategory);
      if (selectedLevel !== "all") params.append("level", selectedLevel);
      if (searchTerm && !["quick", "new", "popular"].includes(searchTerm)) {
        params.append("search", searchTerm);
      }

      const response = await fetch(`/api/library/documents?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    },
  });


  // Auto-select first subcategory when category changes
  useEffect(() => {
    if (selectedCategory !== "all" && subcategories.length > 0) {
      const categorySubcategories = subcategories.filter((sub: any) => sub.categoryId === selectedCategory);
      if (categorySubcategories.length > 0 && selectedSubcategory === "all") {
        setSelectedSubcategory(categorySubcategories[0].id);
      }
    }
  }, [selectedCategory, subcategories]);

  // Filter documents based on search term shortcuts
  const filteredDocuments = documents.filter((doc: any) => {
    if (searchTerm === "quick") {
      return doc.estimatedDuration && doc.estimatedDuration <= 10;
    }
    if (searchTerm === "new") {
      const docDate = new Date(doc.createdAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return docDate > weekAgo;
    }
    if (searchTerm === "popular") {
      return doc.level === "base"; // Assuming base level docs are more popular
    }
    return true;
  });

  // Fetch client progress
  const { data: progress = [] } = useQuery({
    queryKey: ["/api/library/progress"],
    queryFn: async () => {
      const response = await fetch("/api/library/progress", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch progress");
      return response.json();
    },
  });

  // Content request mutation
  const requestContentMutation = useMutation({
    mutationFn: async (requestData: any) => {
      const response = await fetch("/api/library/content-requests", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });
      if (!response.ok) throw new Error("Failed to submit content request");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Richiesta inviata!",
        description: "La tua richiesta di contenuto è stata inviata al consulente",
      });
      setShowRequestDialog(false);
      setRequestForm({
        title: "",
        description: "",
        category: "",
        priority: "medium",
        suggestedLevel: "base"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'invio della richiesta",
        variant: "destructive",
      });
    },
  });

  // Mark document as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (data: { documentId: string; isRead: boolean; readAt: string; timeSpent: number }) => {
      const response = await fetch("/api/library/progress", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to mark as read");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library/progress"] });
      toast({
        title: "Documento segnato come letto",
        description: "Il tuo progresso è stato salvato",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nel salvare il progresso",
        variant: "destructive",
      });
    },
  });

  const handleViewDocument = (document: LibraryDocument) => {
    setActiveDocumentId(document.id);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleMarkAsRead = (docId?: string) => {
    const id = docId || activeDocumentId;
    if (id) {
      markAsReadMutation.mutate({ 
        documentId: id,
        isRead: true,
        readAt: new Date().toISOString(),
        timeSpent: 0
      });
    }
  };

  const handleSubmitContentRequest = () => {
    if (!requestForm.title.trim() || !requestForm.description.trim()) {
      toast({
        title: "Campi obbligatori",
        description: "Titolo e descrizione sono obbligatori",
        variant: "destructive",
      });
      return;
    }

    requestContentMutation.mutate({
      ...requestForm,
      requestedAt: new Date().toISOString(),
    });
  };

  const activeDocument = activeDocumentId ? documents.find((d: any) => d.id === activeDocumentId) : null;

  const { data: activeDocExercises = [] } = useQuery({
    queryKey: ["/api/library/documents", activeDocumentId, "exercises"],
    queryFn: async () => {
      const response = await fetch(`/api/library/documents/${activeDocumentId}/exercises`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!activeDocumentId,
    staleTime: 30_000,
  });

  const { data: activeDocSections = [] } = useQuery({
    queryKey: ["/api/library/documents", activeDocumentId, "sections"],
    queryFn: async () => {
      const response = await fetch(`/api/library/documents/${activeDocumentId}/sections`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!activeDocumentId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (selectedCategory !== "all" && !activeDocumentId && filteredDocuments.length > 0) {
      setActiveDocumentId(filteredDocuments[0].id);
    }
  }, [selectedCategory, filteredDocuments, activeDocumentId]);

  useEffect(() => {
    if (selectedCategory === "all") {
      setActiveDocumentId(null);
    }
  }, [selectedCategory]);

  const currentDocIndex = filteredDocuments.findIndex((d: any) => d.id === activeDocumentId);
  const prevDoc = currentDocIndex > 0 ? filteredDocuments[currentDocIndex - 1] : null;
  const nextDoc = currentDocIndex < filteredDocuments.length - 1 ? filteredDocuments[currentDocIndex + 1] : null;

  const isDocumentRead = (documentId: string) => {
    return progress.some((p: ClientLibraryProgress) => p.documentId === documentId && p.isRead);
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case "base": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "intermedio": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "avanzato": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const getTotalReadDocuments = () => {
    return progress.filter((p: ClientLibraryProgress) => p.isRead).length;
  };

  const getCategoryProgress = (categoryId: string) => {
    const categoryDocuments = documents.filter((d: LibraryDocument) => d.categoryId === categoryId);
    const readDocuments = categoryDocuments.filter((d: LibraryDocument) => isDocumentRead(d.id));
    return { total: categoryDocuments.length, read: readDocuments.length };
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedSubcategory("all"); // Reset subcategory when changing category
  };

  const startCategoriesTour = () => {
    setIsTourActive(true);
    const driverObj = driver({
      ...driverConfig,
      onDestroyed: () => {
        setIsTourActive(false);
      },
    });
    driverObj.setSteps(libraryCategoriesTourSteps);
    driverObj.drive();
  };

  const startLessonsTour = () => {
    setIsTourActive(true);
    const driverObj = driver({
      ...driverConfig,
      onDestroyed: () => {
        setIsTourActive(false);
      },
    });
    driverObj.setSteps(libraryLessonsTourSteps);
    driverObj.drive();
  };

  const getFileName = (att: any) => {
    // If it's an object with originalName, use that
    if (typeof att === 'object' && att.originalName) {
      return att.originalName;
    }

    // If it's an object with filename but no originalName, try to make it readable
    if (typeof att === 'object' && att.filename) {
      if (att.filename.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\..+$/i)) {
        const extension = att.filename.split('.').pop();
        return `Documento.${extension}`;
      }
      return att.filename;
    }

    // If it's a string with UUID pattern, make it readable
    if (typeof att === 'string' && att.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\..+$/i)) {
      const extension = att.split('.').pop();
      return `Documento.${extension}`;
    }

    // Otherwise return the string or fallback
    return typeof att === 'string' ? att : 'File sconosciuto';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto">
          {/* Integrated Header with Menu Button */}
          <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
            <div className="px-4 md:px-8 py-3 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="h-11 w-11 min-h-[44px] min-w-[44px] md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2 flex-1" data-tour="library-header">
                <div className="p-2 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-lg">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
                  Corsi
                </h1>
              </div>
              {!isTourActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectedCategory === "all" ? startCategoriesTour : startLessonsTour}
                  className="gap-2 border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  <HelpCircle size={16} />
                  <span className="hidden sm:inline">Guida Interattiva</span>
                </Button>
              )}
            </div>
          </div>
          <div className="w-full space-y-6 md:space-8 pb-8 px-3 xs:px-4 sm:px-4 md:p-6 lg:p-8">


            {/* Professional Academy Interface */}
            <div className="w-full">
              {/* Main Academy Section - Compact Design */}
              <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden mb-4">
                {/* Decorative Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full blur-3xl"></div>
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-indigo-600 to-blue-600 rounded-full blur-3xl"></div>
                </div>

                <div className="relative z-10 p-4 md:p-5">
                  <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
                    {/* Left Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header with Icon */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                          <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                            Accademia degli Investimenti
                          </h1>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            Formazione professionale per la tua libertà finanziaria
                          </p>
                        </div>
                      </div>

                      {/* Progress Card */}
                      <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20 rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-3" data-tour="library-progress-card">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Progresso Formativo</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                              {documents.length > 0 ? Math.round((getTotalReadDocuments() / documents.length) * 100) : 0}%
                            </span>
                          </div>
                        </div>

                        <div className="relative w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 mb-2 overflow-hidden">
                          <div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 rounded-full transition-all duration-700 shadow-sm"
                            style={{
                              width: `${documents.length > 0 ? (getTotalReadDocuments() / documents.length) * 100 : 0}%`
                            }}
                          ></div>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400 font-medium">
                            {getTotalReadDocuments()} di {documents.length} lezioni completate
                          </span>
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">
                            Livello {Math.floor(getTotalReadDocuments() / 5) + 1}
                          </span>
                        </div>
                      </div>

                      {/* CTA Button */}
                      <Button 
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-md hover:shadow-lg transition-all px-4 py-2 text-sm"
                        onClick={() => setSelectedCategory("all")}
                      >
                        <BookOpen className="mr-2 h-4 w-4" />
                        Esplora i Corsi
                      </Button>
                    </div>

                    {/* Right Stats Grid - Compact Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 lg:w-52 flex-shrink-0">
                      {/* Courses Available */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 shadow-sm hover:shadow-md transition-shadow" data-tour="library-courses-available">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="text-xl font-bold text-gray-900 dark:text-white">{documents.length}</div>
                        </div>
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Corsi Disponibili</div>
                      </div>

                      {/* Documents Read */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 shadow-sm hover:shadow-md transition-shadow" data-tour="library-lessons-completed">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="text-xl font-bold text-gray-900 dark:text-white">{getTotalReadDocuments()}</div>
                        </div>
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Lezioni Completate</div>
                      </div>

                      {/* Streak Achievement */}
                      {getTotalReadDocuments() > 0 && (
                        <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg border border-orange-200 dark:border-orange-800 p-3 shadow-sm lg:col-span-1 col-span-2">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                              <span className="text-lg">🔥</span>
                            </div>
                            <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                              {Math.min(getTotalReadDocuments(), 7)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-medium text-orange-700 dark:text-orange-300">Giorni di Streak</div>
                            {getTotalReadDocuments() >= 5 && (
                              <Badge className="bg-orange-500 text-white text-xs px-1.5 py-0.5 border-0">
                                ⭐
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Course Selection or Category View */}
            {selectedCategory === "all" ? (
              /* Course Selection View - Enhanced with Visual Previews */
              <div className="w-full">

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-tour="library-categories-grid">
                  {categories.map((category: LibraryCategory, index: number) => {
                    const categoryDocs = documents.filter((d: LibraryDocument) => d.categoryId === category.id);
                    const categoryProgress = getCategoryProgress(category.id);

                    // Course preview images based on category name
                    const getCoursePreview = () => {
                      if (category.name.toLowerCase().includes('hybrid')) {
                        return 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop';
                      } else if (category.name.toLowerCase().includes('turbo') || category.name.toLowerCase().includes('vender')) {
                        return 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=800&h=600&fit=crop';
                      } else if (category.name.toLowerCase().includes('invest') || category.name.toLowerCase().includes('finan')) {
                        return 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&h=600&fit=crop';
                      }
                      return 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&h=600&fit=crop';
                    };

                    return (
                      <Card
                        key={category.id}
                        className="bg-white border-0 hover:shadow-2xl transition-all duration-500 cursor-pointer group overflow-hidden transform hover:-translate-y-2"
                        onClick={() => handleCategoryChange(category.id)}
                        data-tour={index === 0 ? "library-category-card" : undefined}
                      >
                        {/* Course Preview Image */}
                        <div className="relative h-48 overflow-hidden">
                          <img 
                            src={getCoursePreview()} 
                            alt={category.name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />

                          {/* Gradient Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>

                          {/* Progress Badge - Top Right */}
                          {categoryProgress.read > 0 && (
                            <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur-sm">
                              {categoryProgress.read}/{categoryProgress.total} ✓
                            </div>
                          )}

                          {/* Course Icon - Bottom Left */}
                          <div className="absolute bottom-4 left-4 w-14 h-14 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-xl">
                            <span className="text-3xl">
                              {category.icon === "BookOpen" ? "📚" : category.icon === "FileText" ? "📄" : category.icon === "Folder" ? "📁" : "📖"}
                            </span>
                          </div>

                          {/* Difficulty/Level Badge - Bottom Right */}
                          <div className="absolute bottom-4 right-4">
                            <Badge className="bg-white/20 backdrop-blur-md text-white border-white/30 text-xs font-semibold px-3 py-1">
                              {categoryDocs.length} Lezioni
                            </Badge>
                          </div>
                        </div>

                        <CardContent className="p-5">
                          <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors leading-tight line-clamp-2 min-h-[3.5rem]">
                            {category.name}
                          </h3>

                          <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[2.5rem]">
                            {category.description || "Corso completo con materiali formativi e esercizi pratici"}
                          </p>

                          {/* Stats Row */}
                          <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1.5">
                              <BookOpen size={14} className="text-blue-500" />
                              <span className="font-medium">{categoryDocs.length} lezioni</span>
                            </div>
                            {categoryProgress.read > 0 && (
                              <div className="flex items-center gap-1.5">
                                <CheckCircle size={14} className="text-green-500" />
                                <span className="text-green-600 font-semibold">{categoryProgress.read} completate</span>
                              </div>
                            )}
                          </div>

                          {/* Progress Bar */}
                          {categoryProgress.total > 0 && (
                            <div className="space-y-2 mb-4" data-tour={index === 0 ? "library-category-progress" : undefined}>
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-gray-600">Progresso</span>
                                <span className="font-bold text-gray-900">{Math.round((categoryProgress.read / categoryProgress.total) * 100)}%</span>
                              </div>
                              <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500 shadow-sm"
                                  style={{
                                    width: `${(categoryProgress.read / categoryProgress.total) * 100}%`
                                  }}
                                ></div>
                              </div>
                            </div>
                          )}

                          {/* CTA Button */}
                          <Button 
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                            onClick={() => handleCategoryChange(category.id)}
                            data-tour={index === 0 ? "library-category-button" : undefined}
                          >
                            {categoryProgress.read === 0 ? (
                              <>
                                <Play size={16} className="mr-2" />
                                Inizia il corso
                              </>
                            ) : (
                              <>
                                <ChevronRight size={16} className="mr-2" />
                                Continua il corso
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Academy-Style 2-Column Layout */
              <div className="w-full">
                {/* Course Header with Progress */}
                <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-4 md:p-5 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSelectedCategory("all"); setSelectedSubcategory("all"); setActiveDocumentId(null); }}
                        className="gap-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Corsi
                      </Button>
                      <div className="h-5 w-px bg-border" />
                      <h2 className="text-base md:text-lg font-bold text-foreground truncate">
                        {categories.find((c: LibraryCategory) => c.id === selectedCategory)?.name}
                      </h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {documents.filter((d: any) => isDocumentRead(d.id)).length}/{documents.length}
                        </span>
                        lezioni
                      </div>
                      <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${documents.length > 0 ? (documents.filter((d: any) => isDocumentRead(d.id)).length / documents.length) * 100 : 0}%` }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile: Toggle sidebar button */}
                <div className="lg:hidden mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMobileSidebarOpen(p => !p)}
                    className="w-full gap-2 justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      {activeDocument ? String(activeDocument.title) : "Seleziona lezione"}
                    </span>
                    {mobileSidebarOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Left Sidebar - Module Accordion */}
                  <div className={cn(
                    "w-full lg:w-72 xl:w-80 flex-shrink-0",
                    mobileSidebarOpen ? "block" : "hidden lg:block"
                  )}>
                    <div className="lg:sticky lg:top-20 space-y-3">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                        <Input
                          placeholder="Cerca lezioni..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 h-9 text-sm rounded-xl"
                          data-tour="library-search-lessons"
                        />
                      </div>

                      {/* Module Accordions */}
                      <div className="space-y-2" data-tour="library-filters-category">
                        {subcategories
                          .filter((sub: any) => sub.categoryId === selectedCategory)
                          .map((subcategory: any) => {
                            const subDocs = filteredDocuments.filter((d: any) => d.subcategoryId === subcategory.id);
                            const completedInModule = subDocs.filter((d: any) => isDocumentRead(d.id)).length;
                            const isAnyActive = subDocs.some((d: any) => d.id === activeDocumentId);

                            return (
                              <ModuleAccordionItem
                                key={subcategory.id}
                                subcategory={subcategory}
                                documents={subDocs}
                                completedCount={completedInModule}
                                activeDocumentId={activeDocumentId}
                                isDocumentRead={isDocumentRead}
                                onSelectDocument={handleViewDocument}
                                defaultOpen={isAnyActive}
                              />
                            );
                          })}
                      </div>

                      {/* Level Filter */}
                      <div className="pt-3 border-t border-border/60" data-tour="library-filter-level">
                        <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                          <SelectTrigger className="h-9 text-sm rounded-xl">
                            <SelectValue placeholder="Tutti i livelli" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tutti i livelli</SelectItem>
                            <SelectItem value="base">🟢 Base</SelectItem>
                            <SelectItem value="intermedio">🟡 Intermedio</SelectItem>
                            <SelectItem value="avanzato">🔴 Avanzato</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Right Content Area - Lesson Detail */}
                  <div className="flex-1 min-w-0">
                    {activeDocument ? (
                      <div className="flex flex-col gap-5">
                        {/* Video Player */}
                        {(activeDocument as any).videoUrl && (
                          <div className="rounded-2xl overflow-hidden bg-black shadow-lg">
                            <div className="aspect-video">
                              <VideoPlayer
                                url={(activeDocument as any).videoUrl}
                                title={String(activeDocument.title)}
                                className="w-full h-full"
                              />
                            </div>
                          </div>
                        )}

                        {/* Lesson Info Card */}
                        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                          <div className="h-1 bg-gradient-to-r from-indigo-500 to-purple-600" />
                          <div className="p-5 md:p-6 space-y-4">
                            <div className="flex flex-wrap items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <Badge className={cn("text-xs font-semibold", getLevelBadgeColor(activeDocument.level))}>
                                    {activeDocument.level}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {activeDocument.estimatedDuration || 5} min
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    Lezione {currentDocIndex + 1}/{filteredDocuments.length}
                                  </span>
                                </div>
                                <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight">
                                  {String(activeDocument.title)}
                                </h1>
                              </div>

                              {isDocumentRead(activeDocument.id) && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex-shrink-0">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                    Completata
                                  </span>
                                </div>
                              )}
                            </div>

                            {activeDocument.description && (
                              <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
                                {String(activeDocument.description)}
                              </p>
                            )}

                            {/* Text Content */}
                            {activeDocument.content && String(activeDocument.content).trim() && (
                              <div className="pt-4 border-t border-border/60">
                                <div
                                  className="prose prose-sm md:prose-base max-w-none dark:prose-invert
                                    prose-headings:text-foreground
                                    prose-p:text-muted-foreground prose-p:leading-relaxed
                                    prose-strong:text-foreground
                                    prose-a:text-indigo-600 dark:prose-a:text-indigo-400
                                    prose-blockquote:border-indigo-500"
                                  dangerouslySetInnerHTML={{
                                    __html: String(activeDocument.content)
                                      .replace(/<script[^>]*>.*?<\/script>/gi, '')
                                      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
                                  }}
                                />
                              </div>
                            )}

                            {/* Document Sections */}
                            {activeDocSections.length > 0 && (
                              <div className="pt-4 border-t border-border/60 space-y-3">
                                {activeDocSections.map((section: LibraryDocumentSection) => (
                                  <div
                                    key={section.id}
                                    className={cn(
                                      "p-4 rounded-xl border-l-4",
                                      section.type === 'highlight' ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-500' :
                                      section.type === 'example' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-500' :
                                      section.type === 'note' ? 'bg-green-50 dark:bg-green-900/10 border-green-500' :
                                      section.type === 'warning' ? 'bg-red-50 dark:bg-red-900/10 border-red-500' :
                                      'bg-muted border-muted-foreground/30'
                                    )}
                                  >
                                    <h4 className="text-sm font-semibold text-foreground mb-1">{String(section.title || 'Sezione')}</h4>
                                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">{String(section.content || '')}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Attachments */}
                            {activeDocument.attachments && Array.isArray(activeDocument.attachments) && activeDocument.attachments.length > 0 && (
                              <div className="pt-4 border-t border-border/60">
                                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                  <Download className="w-4 h-4" /> Risorse Aggiuntive
                                </h4>
                                <div className="space-y-2">
                                  {activeDocument.attachments.filter(a => a != null).map((attachment: any, index: number) => {
                                    const fileName = getFileName(attachment);
                                    return (
                                      <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                        <span className="text-sm flex-1 truncate">{fileName}</span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const downloadFileName = typeof attachment === 'object' ? attachment.filename : attachment;
                                            const link = document.createElement('a');
                                            link.href = `/uploads/${downloadFileName}`;
                                            link.download = fileName;
                                            link.target = '_blank';
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                          }}
                                          className="h-8 w-8 p-0"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Mark as Complete */}
                            <div className="pt-3">
                              {!isDocumentRead(activeDocument.id) && (
                                <Button
                                  size="sm"
                                  onClick={() => handleMarkAsRead(activeDocument.id)}
                                  disabled={markAsReadMutation.isPending}
                                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  {markAsReadMutation.isPending ? 'Salvataggio...' : 'Segna come completata'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Linked Exercises Section */}
                        {activeDocExercises.length > 0 && (
                          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                            <div className="h-1 bg-gradient-to-r from-orange-500 to-amber-500" />
                            <div className="p-5 md:p-6">
                              <div className="flex items-center gap-2 mb-4">
                                <ClipboardList className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                <h3 className="text-lg font-bold text-foreground">Esercizi Pratici</h3>
                                <Badge variant="outline" className="text-xs ml-auto">
                                  {activeDocExercises.filter((e: any) => e.assignment?.status === 'completed').length}/{activeDocExercises.length}
                                </Badge>
                              </div>
                              <div className="space-y-3">
                                {activeDocExercises.map((item: any) => {
                                  const exercise = item.exercise;
                                  const assignment = item.assignment;
                                  const status = assignment?.status || 'not_assigned';

                                  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
                                    not_assigned: { label: 'Non assegnato', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: <BookOpen className="w-3.5 h-3.5" /> },
                                    pending: { label: 'Da iniziare', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', icon: <PlayCircle className="w-3.5 h-3.5" /> },
                                    in_progress: { label: 'In corso', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: <PlayCircle className="w-3.5 h-3.5" /> },
                                    submitted: { label: 'In revisione', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: <Clock className="w-3.5 h-3.5" /> },
                                    completed: { label: 'Completato', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
                                    rejected: { label: 'Da rifare', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: <ArrowRight className="w-3.5 h-3.5" /> },
                                    returned: { label: 'Restituito', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', icon: <ArrowRight className="w-3.5 h-3.5" /> },
                                  };

                                  const cfg = statusConfig[status] || statusConfig.not_assigned;

                                  return (
                                    <div
                                      key={exercise.id}
                                      className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors group"
                                    >
                                      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                                        <ClipboardList className="w-4 h-4 text-white" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground truncate">{exercise.title}</p>
                                        {exercise.estimatedDuration && (
                                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-2.5 h-2.5" /> {exercise.estimatedDuration} min
                                          </p>
                                        )}
                                      </div>
                                      <Badge className={cn("text-[10px] font-semibold gap-1", cfg.color)}>
                                        {cfg.icon} {cfg.label}
                                      </Badge>
                                      {assignment && ['pending', 'in_progress', 'returned', 'rejected'].includes(status) && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setLocation(`/exercise/${assignment.id}`)}
                                          className="h-8 text-xs gap-1 flex-shrink-0"
                                        >
                                          {status === 'pending' ? 'Inizia' : 'Continua'}
                                          <ExternalLink className="w-3 h-3" />
                                        </Button>
                                      )}
                                      {assignment && status === 'completed' && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setLocation(`/exercise/${assignment.id}`)}
                                          className="h-8 text-xs gap-1 flex-shrink-0 text-muted-foreground"
                                        >
                                          Rivedi
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Prev/Next Navigation */}
                        <div className="flex items-center justify-between gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => prevDoc && handleViewDocument(prevDoc)}
                            disabled={!prevDoc}
                            className="gap-2"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline">Precedente</span>
                          </Button>

                          <div className="text-xs text-muted-foreground text-center">
                            Lezione {currentDocIndex + 1} di {filteredDocuments.length}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => nextDoc && handleViewDocument(nextDoc)}
                            disabled={!nextDoc}
                            className="gap-2"
                          >
                            <span className="hidden sm:inline">Successiva</span>
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                          <BookOpen className="w-7 h-7 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Seleziona una lezione</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          Scegli una lezione dal menu a sinistra per iniziare il tuo percorso formativo.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Content Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <PlusCircle size={20} className="text-white" />
              </div>
              Richiedi Nuovo Contenuto
            </DialogTitle>
            <DialogDescription>
              Suggerisci nuovi contenuti formativi che vorresti vedere nella libreria
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="request-title">Titolo del contenuto richiesto *</Label>
              <Input
                id="request-title"
                placeholder="Es. Guida alla gestione del budget personale"
                value={requestForm.title}
                onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
                className="border-muted/60 focus:border-green-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-description">Descrizione dettagliata *</Label>
              <Textarea
                id="request-description"
                placeholder="Descrivi nel dettaglio cosa vorresti imparare, quali argomenti dovrebbe coprire, perché ritieni importante questo contenuto..."
                value={requestForm.description}
                onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                className="min-h-[120px] border-muted/60 focus:border-green-500"
                rows={5}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="request-category">Categoria suggerita</Label>
                <Select
                  value={requestForm.category}
                  onValueChange={(value) => setRequestForm({ ...requestForm, category: value })}
                >
                  <SelectTrigger className="border-muted/60">
                    <SelectValue placeholder="Seleziona categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nessuna preferenza</SelectItem>
                    {categories.map((category: LibraryCategory) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="request-level">Livello suggerito</Label>
                <Select
                  value={requestForm.suggestedLevel}
                  onValueChange={(value) => setRequestForm({ ...requestForm, suggestedLevel: value })}
                >
                  <SelectTrigger className="border-muted/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base">Base</SelectItem>
                    <SelectItem value="intermedio">Intermedio</SelectItem>
                    <SelectItem value="avanzato">Avanzato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-priority">Priorità</Label>
              <Select
                value={requestForm.priority}
                onValueChange={(value) => setRequestForm({ ...requestForm, priority: value })}
              >
                <SelectTrigger className="border-muted/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">🔵 Bassa - Quando possibile</SelectItem>
                  <SelectItem value="medium">🟡 Media - Importante per me</SelectItem>
                  <SelectItem value="high">🔴 Alta - Molto urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center">
                💡 Suggerimento
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                Più dettagli fornisci, più facile sarà per il consulente creare contenuti mirati alle tue esigenze. 
                Includi esempi specifici, situazioni pratiche o domande concrete che vorresti vedere affrontate.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowRequestDialog(false)}
              disabled={requestContentMutation.isPending}
            >
              Annulla
            </Button>
            <Button
              onClick={handleSubmitContentRequest}
              disabled={requestContentMutation.isPending}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
            >
              {requestContentMutation.isPending ? (
                "Invio in corso..."
              ) : (
                <>
                  <Send size={16} className="mr-2" />
                  Invia Richiesta
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Old preview/fullscreen dialogs removed - content now inline in Academy layout */}
    </div>
  );
}