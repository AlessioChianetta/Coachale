import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  Search,
  Clock,
  CheckCircle,
  FileText,
  Folder,
  Tag,
  ArrowRight,
  Download,
  Eye,
  PlusCircle,
  Send,
  GraduationCap,
  ChevronRight,
  Play,
  Video,
  Menu,
  HelpCircle
} from "lucide-react";
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
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<LibraryDocument | undefined>();
  const [documentSections, setDocumentSections] = useState<LibraryDocumentSection[]>([]);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestForm, setRequestForm] = useState({
    title: "",
    description: "",
    category: "",
    priority: "medium",
    suggestedLevel: "base"
  });
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const scrollPositionRef = useRef(0);
  const headerTimeoutRef = useRef<NodeJS.Timeout>();
  const [readingProgress, setReadingProgress] = useState(0);
  const [isTourActive, setIsTourActive] = useState(false);

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

  const [showPreview, setShowPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<LibraryDocument | undefined>();

  const handleViewDocument = (document: LibraryDocument) => {
    // Naviga alla pagina dedicata del documento
    setLocation(`/client/library/${document.id}`);
  };

  const handleStartReading = async (document: LibraryDocument) => {
    setShowPreview(false);
    // Navigate to dedicated document page
    window.location.href = `/client/library/${document.id}`;
  };

  const handleMarkAsRead = () => {
    if (selectedDocument) {
      markAsReadMutation.mutate({ 
        documentId: selectedDocument.id,
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

  // Auto-hide header logic and reading progress calculation
  const handleScroll = (scrollTop: number, scrollElement?: HTMLElement) => {
    const currentScrollY = scrollTop;
    const isScrollingDown = currentScrollY > scrollPositionRef.current;
    const isScrollingUp = currentScrollY < scrollPositionRef.current;

    // Calculate reading progress based on scroll position
    if (scrollElement) {
      const scrollHeight = scrollElement.scrollHeight;
      const clientHeight = scrollElement.clientHeight;
      const maxScrollTop = scrollHeight - clientHeight;

      if (maxScrollTop > 0) {
        const progress = Math.min(100, Math.max(0, (currentScrollY / maxScrollTop) * 100));
        setReadingProgress(progress);
      }
    }

    // Hide header when scrolling down (after 30px)
    if (isScrollingDown && currentScrollY > 30) {
      setIsHeaderVisible(false);
    }

    // Show header only when scrolling up significantly or at very top
    if ((isScrollingUp && scrollPositionRef.current - currentScrollY > 20) || currentScrollY < 10) {
      setIsHeaderVisible(true);
    }

    scrollPositionRef.current = currentScrollY;

    // Auto-hide after 2 seconds of no scroll when reading
    if (currentScrollY > 50 && isHeaderVisible) {
      headerTimeoutRef.current = setTimeout(() => {
        setIsHeaderVisible(false);
      }, 2000);
    }
  };

  useEffect(() => {
    return () => {
      if (headerTimeoutRef.current) {
        clearTimeout(headerTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
      if (showPreview) {
        setIsPreviewExpanded(false);
      }
  }, [showPreview]);


  const isDocumentRead = (documentId: string) => {
    return progress.some((p: ClientLibraryProgress) => p.documentId === documentId && p.isRead);
  };

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case "BookOpen": return <BookOpen size={20} />;
      case "FileText": return <FileText size={20} />;
      case "Folder": return <Folder size={20} />;
      default: return <BookOpen size={20} />;
    }
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case "base": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "intermedio": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "avanzato": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  const getSectionTypeIcon = (type: string) => {
    switch (type) {
      case "highlight": return "💡";
      case "example": return "📝";
      case "note": return "📌";
      case "warning": return "⚠️";
      default: return "";
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
              /* Category Content View */
              <Card className="mx-2 xs:mx-0 p-1 sm:p-3 bg-white shadow-sm">
                <div className="flex flex-col xl:flex-row gap-2 sm:gap-3 lg:gap-4 px-1 xs:px-0 min-h-0">
                  {/* Left Sidebar - Categories */}
                  <div className="w-full xl:w-80 2xl:w-96 flex-shrink-0">
                    <div className="bg-gradient-to-br from-white to-purple-50/30 border border-purple-100 rounded-2xl p-5 md:p-6 shadow-lg lg:sticky lg:top-6 backdrop-blur-sm">
                      {/* Removed Header "Filtri" */}

                      {/* Search */}
                      <div className="mb-6">
                        <div className="relative group">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-purple-500 transition-colors" size={16} />
                          <Input
                            placeholder="Cerca lezioni..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-white border-purple-200 text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 rounded-xl shadow-sm transition-all"
                            data-tour="library-search-lessons"
                          />
                        </div>
                      </div>

                      {/* Categories */}
                      <div className="space-y-2" data-tour="library-filters-category">
                        <div className="flex items-center gap-2 mb-3 px-1">
                          <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs">📁</span>
                          </div>
                          <h4 className="text-sm font-bold text-gray-700">Categorie</h4>
                        </div>

                        {/* Subcategories for selected course */}
                        {subcategories
                          .filter((sub: any) => sub.categoryId === selectedCategory)
                          .map((subcategory: any) => {
                            const subCategoryDocs = documents.filter((d: any) => d.subcategoryId === subcategory.id);

                            // Emoji mapping per le icone
                            const getEmojiIcon = (iconName: string) => {
                              switch (iconName) {
                                case "BookOpen": return "📖";
                                case "FileText": return "📄";
                                case "Folder": return "📁";
                                default: return "📚";
                              }
                            };

                            return (
                              <div
                                key={subcategory.id}
                                className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                                  selectedSubcategory === subcategory.id
                                    ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg scale-[1.02]"
                                    : "bg-white hover:bg-purple-50 text-gray-700 hover:shadow-md border border-gray-100"
                                }`}
                                onClick={() => setSelectedSubcategory(subcategory.id)}
                              >
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                                  selectedSubcategory === subcategory.id 
                                    ? "bg-white/20" 
                                    : `bg-gradient-to-br from-purple-400 to-indigo-500`
                                }`}>
                                  <span className="text-xl">{getEmojiIcon(subcategory.icon || "Folder")}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold truncate text-sm">{subcategory.name}</div>
                                  <div className={`text-xs font-medium ${selectedSubcategory === subcategory.id ? "text-purple-100" : "text-gray-500"}`}>
                                    {subCategoryDocs.length} lezioni
                                  </div>
                                </div>
                                {selectedSubcategory === subcategory.id && (
                                  <ChevronRight size={16} className="text-white animate-pulse" />
                                )}
                              </div>
                            );
                          })}
                      </div>

                      {/* Level Filter */}
                      <div className="mt-6 pt-6 border-t border-purple-100" data-tour="library-filter-level">
                        <div className="flex items-center gap-2 mb-3 px-1">
                          <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-white text-xs">📊</span>
                          </div>
                          <h4 className="text-sm font-bold text-gray-700">Livello</h4>
                        </div>
                        <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                          <SelectTrigger className="bg-white border-purple-200 text-gray-900 hover:bg-purple-50 focus:bg-white focus:ring-2 focus:ring-purple-200 rounded-xl shadow-sm transition-all">
                            <SelectValue placeholder="Tutti i livelli" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="all">Tutti i livelli</SelectItem>
                            <SelectItem value="base">🟢 Base</SelectItem>
                            <SelectItem value="intermedio">🟡 Intermedio</SelectItem>
                            <SelectItem value="avanzato">🔴 Avanzato</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Right Content Area - Lessons */}
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-1 mb-1 flex-wrap">
                          <span className="text-xs sm:text-sm font-semibold text-blue-600 truncate">
                            {categories.find((c: LibraryCategory) => c.id === selectedCategory)?.name}
                          </span>
                          {selectedSubcategory !== "all" && (
                            <>
                              <ChevronRight size={12} className="text-gray-400" />
                              <span className="text-xs sm:text-sm font-semibold text-purple-600 truncate">
                                {subcategories.find((sc: any) => sc.id === selectedSubcategory)?.name}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-gray-600 text-xs">
                          {filteredDocuments.length} lezioni disponibili
                        </p>
                      </div>
                    </div>

                    {/* Lessons Grid - Max 3 card per riga */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 w-full">
                      {filteredDocuments.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-16">
                          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <BookOpen size={32} className="text-gray-400" />
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessuna lezione trovata</h3>
                          <p className="text-gray-600 text-center">
                            {searchTerm || selectedSubcategory !== "all" || selectedLevel !== "all"
                              ? "Prova a modificare i filtri di ricerca."
                              : "Non ci sono ancora lezioni disponibili in questa categoria."}
                          </p>
                        </div>
                      ) : (
                        filteredDocuments.map((document: any, lessonIndex: number) => {
                          const category = categories.find((c: LibraryCategory) => c.id === document.categoryId);
                          const subcategory = subcategories.find((sc: any) => sc.id === document.subcategoryId);
                          const isRead = isDocumentRead(document.id);

                          const getCategoryIconEmoji = () => {
                            switch (category?.name) {
                              case "Metodo Hybrid - Costruisci la tua attività":
                                return "🚀";
                              case "Sistema di Vendita High-Ticket":
                                return "💼";
                              default:
                                return "📚";
                            }
                          };

                          const getVideoThumbnail = (videoUrl: string) => {
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
                                  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
                                }
                              }

                              // Vimeo - richiede una chiamata API, usiamo un placeholder
                              if (urlObj.hostname.includes('vimeo.com')) {
                                return null; // Useremo il gradiente
                              }

                              return null;
                            } catch (error) {
                              return null;
                            }
                          };

                          const videoThumbnail = (document as any).videoUrl ? getVideoThumbnail((document as any).videoUrl) : null;

                          return (
                            <Card
                              key={document.id}
                              className="bg-white border-gray-200 hover:border-purple-400 hover:shadow-xl transition-all duration-300 cursor-pointer group overflow-hidden transform hover:-translate-y-1"
                              onClick={() => handleViewDocument(document)}
                              data-tour={lessonIndex === 0 ? "library-lesson-card" : undefined}
                            >
                              {/* Video/Content Thumbnail Area - Più alto e con gradiente migliore */}
                              <div className="relative h-48 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 flex items-center justify-center overflow-hidden">
                                {/* Video Thumbnail se disponibile */}
                                {videoThumbnail ? (
                                  <>
                                    <img 
                                      src={videoThumbnail} 
                                      alt={document.title}
                                      className="absolute inset-0 w-full h-full object-cover scale-[1.02]"
                                      onError={(e) => {
                                        // Se l'immagine non carica, nascondi l'elemento
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                    {/* Overlay scuro per migliorare la leggibilità */}
                                    <div className="absolute inset-0 bg-black/30"></div>
                                  </>
                                ) : (
                                  <>
                                    {/* Decorative background pattern */}
                                    <div className="absolute inset-0 opacity-10">
                                      <div className="absolute top-4 left-4 w-12 h-12 border-2 border-white rounded-lg rotate-12"></div>
                                      <div className="absolute bottom-8 right-8 w-8 h-8 border border-white rounded-full"></div>
                                      <div className="absolute top-1/2 left-1/3 w-6 h-6 border border-white rotate-45"></div>
                                    </div>

                                    {/* Content Type Icon - Più grande con sfondo */}
                                    <div className="relative z-10">
                                      <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300 shadow-lg">
                                        <span className="text-4xl">{getCategoryIconEmoji()}</span>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {/* Play Button - Visibile solo all'hover */}
                                <div className="w-16 h-16 bg-black/60 rounded-full flex items-center justify-center group-hover:bg-purple-600 group-hover:scale-110 transition-all absolute z-20 backdrop-blur-sm opacity-0 group-hover:opacity-100">
                                  {(document as any).contentType === 'video' ? (
                                    <div className="w-0 h-0 border-l-[18px] border-l-white border-y-[12px] border-y-transparent ml-1"></div>
                                  ) : (
                                    <BookOpen size={24} className="text-white" />
                                  )}
                                </div>

                                {/* Duration Badge - Visibile solo all'hover */}
                                <div className="absolute top-4 right-4 bg-black/80 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Clock size={12} />
                                  {document.estimatedDuration || 5}min
                                </div>

                                {/* Level Badge - Visibile solo all'hover */}
                                <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Badge className={`${getLevelBadgeColor(document.level)} text-xs font-semibold px-3 py-1 shadow-lg`}>
                                    {document.level}
                                  </Badge>
                                </div>

                                {/* Completed Check - Più evidente */}
                                {isRead && (
                                  <div className="absolute bottom-4 right-4 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white" data-tour={lessonIndex === 0 ? "library-completion-badge" : undefined}>
                                    <CheckCircle size={18} className="text-white" />
                                  </div>
                                )}
                              </div>

                              {/* Content - Più spazio e migliore gerarchia */}
                              <CardContent className="p-5">
                                {/* Course/Category Path - Più leggibile */}
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                                  <span className="truncate font-medium">{category?.name}</span>
                                  {subcategory && (
                                    <>
                                      <ChevronRight size={12} className="flex-shrink-0" />
                                      <span className="truncate">{subcategory.name}</span>
                                    </>
                                  )}
                                </div>

                                {/* Titolo - Più prominente */}
                                <h3 className="font-bold text-gray-900 mb-3 line-clamp-2 text-lg leading-tight group-hover:text-purple-600 transition-colors">
                                  {document.title ? String(document.title) : 'Senza titolo'}
                                </h3>

                                {/* Descrizione - Più spazio */}
                                <p className="text-gray-600 text-sm mb-4 line-clamp-3 leading-relaxed">
                                  {document.description ? String(document.description) : 'Descrizione non disponibile'}
                                </p>

                                {/* Status - Layout migliore */}
                                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${isRead ? 'bg-green-500' : 'bg-purple-500'}`}></div>
                                    <span className={`text-sm font-semibold ${isRead ? 'text-green-600' : 'text-purple-600'}`}>
                                      {isRead ? 'Completata' : 'Disponibile'}
                                    </span>
                                  </div>

                                  {/* Indicatore visivo di hover */}
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ArrowRight size={18} className="text-purple-600" />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </Card>
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

      {/* Document Preview Dialog - Different for Video and Text */}
      <Dialog open={showPreview} onOpenChange={() => setShowPreview(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
          {previewDocument && (
            <div className="space-y-6">
              {/* Header - Different style for Video vs Text */}
              <div className="relative">
                {(previewDocument as any).contentType === 'video' ? (
                  /* Netflix-Style Video Preview Header */
                  <div className="bg-gradient-to-br from-red-600 via-red-700 to-red-800 rounded-2xl p-8 text-white text-center relative overflow-hidden">
                    {/* Netflix-style decorative elements */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-10">
                      <div className="absolute top-6 left-6 w-12 h-12 border-2 border-white rounded-lg rotate-12"></div>
                      <div className="absolute top-8 right-8 w-6 h-6 border-2 border-white rounded-full"></div>
                      <div className="absolute bottom-8 left-12 w-8 h-8 border border-white rotate-45"></div>
                      <div className="absolute bottom-6 right-6 w-16 h-2 bg-white rounded-full"></div>
                    </div>

                    <div className="relative z-10">
                      <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-4 backdrop-blur-sm">
                        <Play size={36} className="text-white" />
                      </div>
                      <h1 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">
                        {previewDocument.title}
                      </h1>
                      {previewDocument.subtitle && (
                        <p className="text-red-100 text-lg font-medium mb-4">
                          {previewDocument.subtitle}
                        </p>
                      )}

                      {/* Video-specific badges */}
                      <div className="flex justify-center gap-3 mt-6">
                        <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 flex items-center">
                          <Video size={14} className="mr-1" />
                          <span className="text-sm font-medium">Video Lezione</span>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 flex items-center">
                          <span className="text-sm font-medium">
                            📊 {previewDocument.level}
                          </span>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 flex items-center">
                          <Clock size={14} className="mr-1" />
                          <span className="text-sm font-medium">
                            {previewDocument.estimatedDuration || 5} min
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Book-Style Text Preview Header */
                  <div className="bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 rounded-2xl p-8 text-white text-center relative overflow-hidden">
                    {/* Decorative elements */}
                    <div className="absolute top-0 left-0 w-full h-full opacity-10">
                      <div className="absolute top-4 left-4 w-8 h-8 border-2 border-white rounded-full"></div>
                      <div className="absolute top-8 right-8 w-4 h-4 border border-white rotate-45"></div>
                      <div className="absolute bottom-6 left-8 w-6 h-6 border border-white rounded-full"></div>
                      <div className="absolute bottom-4 right-4 w-12 h-1 bg-white rounded"></div>
                    </div>

                    <div className="relative z-10">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
                        <BookOpen size={32} className="text-white" />
                      </div>
                      <h1 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">
                        {previewDocument.title}
                      </h1>
                      {previewDocument.subtitle && (
                        <p className="text-orange-100 text-lg font-medium mb-4">
                          {previewDocument.subtitle}
                        </p>
                      )}

                      {/* Level and duration badges */}
                      <div className="flex justify-center gap-3 mt-6">
                        <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 flex items-center">
                          <span className="text-sm font-medium">
                            📚 {previewDocument.level}
                          </span>
                        </div>
                        <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 flex items-center">
                          <Clock size={14} className="mr-1" />
                          <span className="text-sm font-medium">
                            {previewDocument.estimatedDuration || 5} min
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Close button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                  className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full w-8 h-8 p-0"
                >
                  ✕
                </Button>
              </div>

              {/* Document Info - Different for Video vs Text */}
              <div className="space-y-4 px-2">
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center">
                    {(previewDocument as any).contentType === 'video' ? (
                      <>🎬 Anteprima Video</>
                    ) : (
                      <>📖 Anteprima del contenuto</>
                    )}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {previewDocument.description || 
                      ((previewDocument as any).contentType === 'video' 
                        ? "Una video lezione che ti guiderà passo dopo passo attraverso i concetti." 
                        : "Un documento formativo che ti aiuterà a migliorare le tue competenze.")}
                  </p>
                </div>

                {/* Stats - Different for Video vs Text */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={`rounded-xl p-4 text-center ${
                    (previewDocument as any).contentType === 'video' 
                      ? 'bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20' 
                      : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20'
                  }`}>
                    <div className={`text-2xl font-bold ${
                      (previewDocument as any).contentType === 'video' 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {previewDocument.estimatedDuration || 5}
                    </div>
                    <div className={`text-sm ${
                      (previewDocument as any).contentType === 'video' 
                        ? 'text-red-800 dark:text-red-300' 
                        : 'text-blue-800 dark:text-blue-300'
                    }`}>
                      {(previewDocument as any).contentType === 'video' ? 'minuti di video' : 'minuti di lettura'}
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {previewDocument.level}
                    </div>
                    <div className="text-sm text-green-800 dark:text-green-300">livello di difficoltà</div>
                  </div>
                </div>

                {/* Category and tags */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Folder size={16} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {categories.find((c: LibraryCategory) => c.id === previewDocument.categoryId)?.name || 'Generale'}
                    </span>
                  </div>

                  {previewDocument.tags && previewDocument.tags.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Tag size={16} className="text-muted-foreground" />
                      <div className="flex flex-wrap gap-1">
                        {previewDocument.tags.slice(0, 5).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {String(tag)}
                          </Badge>
                        ))}
                        {previewDocument.tags.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{previewDocument.tags.length - 5}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Viewing status - Different for Video vs Text */}
                {isDocumentRead(previewDocument.id) ? (
                  <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle size={20} className="text-white" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-green-900 dark:text-green-100">
                          {(previewDocument as any).contentType === 'video' ? 'Video completato!' : 'Documento completato!'}
                        </h4>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          {(previewDocument as any).contentType === 'video' ? 'Puoi rivederlo quando vuoi' : 'Puoi rileggerlo quando vuoi'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`border rounded-xl p-4 ${
                    (previewDocument as any).contentType === 'video' 
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' 
                      : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        (previewDocument as any).contentType === 'video' 
                          ? 'bg-red-500' 
                          : 'bg-blue-500'
                      }`}>
                        {(previewDocument as any).contentType === 'video' ? (
                          <Play size={20} className="text-white" />
                        ) : (
                          <BookOpen size={20} className="text-white" />
                        )}
                      </div>
                      <div>
                        <h4 className={`font-semibold ${
                          (previewDocument as any).contentType === 'video' 
                            ? 'text-red-900 dark:text-red-100' 
                            : 'text-blue-900 dark:text-blue-100'
                        }`}>
                          {(previewDocument as any).contentType === 'video' ? 'Pronto per guardare?' : 'Pronto per iniziare?'}
                        </h4>
                        <p className={`text-sm ${
                          (previewDocument as any).contentType === 'video' 
                            ? 'text-red-700 dark:text-red-300' 
                            : 'text-blue-700 dark:text-blue-300'
                        }`}>
                          {(previewDocument as any).contentType === 'video' 
                            ? 'Questo video ti guiderà nel tuo percorso di apprendimento' 
                            : 'Questo contenuto ti aiuterà nel tuo percorso di crescita'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons - Different text for Video vs Text */}
              <div className="flex gap-3 px-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(false)}
                  className="flex-1"
                >
                  Torna indietro
                </Button>
                <Button
                  onClick={() => handleStartReading(previewDocument)}
                  className={`flex-1 text-white ${
                    (previewDocument as any).contentType === 'video'
                      ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
                      : (previewDocument as any).contentType === 'both'
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700'
                      : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                  }`}
                >
                  {(previewDocument as any).contentType === 'video' ? (
                    <>
                      <Play size={16} className="mr-2" />
                      {isDocumentRead(previewDocument.id) ? 'Rivedi Video' : 'Guarda Video'}
                    </>
                  ) : (previewDocument as any).contentType === 'both' ? (
                    <>
                      <Play size={16} className="mr-2" />
                      {isDocumentRead(previewDocument.id) ? 'Rivedi Video' : 'Inizia a vedere il video'}
                    </>
                  ) : (
                    <>
                      <Eye size={16} className="mr-2" />
                      {isDocumentRead(previewDocument.id) ? 'Rileggi' : 'Inizia a leggere'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Netflix-Style Video Player / Document Reader Dialog */}
      <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(undefined)}>
        <DialogContent className="w-full max-w-full h-screen max-h-screen m-0 p-0 rounded-none border-none bg-black flex flex-col z-[9999] fixed inset-0 translate-x-0 translate-y-0 top-0 left-0 overflow-hidden">
          {selectedDocument && (
            <div className="h-full flex flex-col">
              {(selectedDocument as any).contentType === 'video' || (selectedDocument as any).contentType === 'both' ? (
                /* Video Interface - Different layout for 'video' vs 'both' */
                <>
                  {/* Header */}
                  <div className="flex-shrink-0 bg-gradient-to-b from-black/80 to-transparent text-white px-6 py-4 shadow-lg relative z-10">
                    <div className="flex items-center justify-between">
                      <Button
                        onClick={() => setSelectedDocument(undefined)}
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-white/20 px-3 py-1.5 h-auto rounded-full"
                      >
                        ← Torna alla libreria
                      </Button>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-white font-semibold text-lg">
                            {selectedDocument.title}
                          </div>
                          <div className="text-white/70 text-sm">
                            {categories.find((c: LibraryCategory) => c.id === selectedDocument.categoryId)?.name}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(selectedDocument as any).contentType === 'video' ? (
                    /* Pure Video Mode - Full Screen */
                    <>
                      <div className="flex-1 bg-black flex items-center justify-center">
                        <div className="w-full h-full">
                          <VideoPlayer 
                            url={(selectedDocument as any).videoUrl} 
                            title={selectedDocument.title}
                            className="w-full h-full"
                          />
                        </div>
                      </div>

                      {/* Video Info Panel */}
                      <div className="flex-shrink-0 bg-gradient-to-t from-black/90 to-transparent text-white px-6 py-6">
                        <div className="max-w-4xl mx-auto">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Video Info */}
                            <div className="md:col-span-2">
                              <h2 className="text-2xl font-bold mb-2">{selectedDocument.title}</h2>
                              {selectedDocument.subtitle && (
                                <p className="text-white/80 text-lg mb-3">{selectedDocument.subtitle}</p>
                              )}
                              {selectedDocument.description && (
                                <p className="text-white/70 leading-relaxed mb-4">
                                  {selectedDocument.description}
                                </p>
                              )}
                            </div>

                            {/* Video Stats */}
                            <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
                              <Video size={20} className="text-white" />
                            </div>
                            <div>
                              <div className="text-white font-semibold">Video Lezione</div>
                              <div className="text-white/70 text-sm">{selectedDocument.estimatedDuration || 5} minuti</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                              <span className="text-white font-bold text-sm">
                                {selectedDocument.level === 'base' ? 'B' : selectedDocument.level === 'intermedio' ? 'I' : 'A'}
                              </span>
                            </div>
                            <div>
                              <div className="text-white font-semibold">Livello {selectedDocument.level}</div>
                              <div className="text-white/70 text-sm">
                                {selectedDocument.level === 'base' ? 'Per principianti' : 
                                 selectedDocument.level === 'intermedio' ? 'Esperienza media' : 'Per esperti'}
                              </div>
                            </div>
                          </div>

                          {/* Mark as Completed */}
                              {!isDocumentRead(selectedDocument.id) && (
                                <Button
                                  onClick={handleMarkAsRead}
                                  disabled={markAsReadMutation.isPending}
                                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 mt-4"
                                >
                                  <CheckCircle size={16} className="mr-2" />
                                  {markAsReadMutation.isPending ? 'Salvando...' : 'Segna come completato'}
                                </Button>
                              )}

                              {isDocumentRead(selectedDocument.id) && (
                                <div className="flex items-center gap-2 bg-green-600 rounded-lg p-3 mt-4">
                                  <CheckCircle size={16} className="text-white" />
                                  <span className="text-white font-semibold">Video Completato!</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Tags */}
                          {selectedDocument.tags && selectedDocument.tags.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-white/20">
                              <div className="flex flex-wrap gap-2">
                                {selectedDocument.tags.map((tag, index) => (
                                  <Badge key={index} variant="outline" className="bg-white/10 text-white border-white/30">
                                    {String(tag)}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Mixed Content Mode - Video + Text in scrollable area */
                    <div className="flex-1 overflow-hidden bg-gray-900">
                      <ScrollArea className="h-full w-full">
                        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6">

                          {/* Video Player - Fixed aspect ratio */}
                          <div className="mb-8">
                            <div className="aspect-video w-full bg-black rounded-xl overflow-hidden shadow-2xl">
                              <VideoPlayer 
                                url={(selectedDocument as any).videoUrl} 
                                title={selectedDocument.title}
                                className="w-full h-full"
                              />
                            </div>
                          </div>

                          {/* Description */}
                          {selectedDocument.description && String(selectedDocument.description).trim() && (
                            <div className="mb-6 p-6 bg-purple-900/30 rounded-2xl border border-purple-700/50">
                              <div className="flex items-center mb-3">
                                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                                  <span className="text-white text-sm">📋</span>
                                </div>
                                <h3 className="ml-3 text-lg font-semibold text-white">Sommario</h3>
                              </div>
                              <p className="text-purple-100 leading-relaxed">
                                {String(selectedDocument.description)}
                              </p>
                            </div>
                          )}

                          {/* Text Content */}
                          {selectedDocument.content && String(selectedDocument.content).trim() && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 mb-8">
                              <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                  <span className="text-3xl">📄</span>
                                  Contenuto Testuale
                                </h3>
                                <p className="text-gray-600 dark:text-gray-400">Approfondisci con il materiale scritto</p>
                              </div>

                              <div 
                                className="prose prose-lg max-w-none
                                  prose-headings:text-gray-900 dark:prose-headings:text-white
                                  prose-p:text-gray-800 dark:prose-p:text-gray-200
                                  prose-p:leading-relaxed prose-p:mb-4
                                  prose-strong:text-gray-900 dark:prose-strong:text-white
                                  prose-strong:font-semibold
                                  prose-ul:text-gray-800 dark:prose-ul:text-gray-200
                                  prose-ol:text-gray-800 dark:prose-ol:text-gray-200
                                  prose-li:my-2
                                  prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-4
                                  prose-h2:text-2xl prose-h2:font-bold prose-h2:mb-3 prose-h2:mt-8
                                  prose-h3:text-xl prose-h3:font-semibold prose-h3:mb-3 prose-h3:mt-6
                                  prose-h4:text-lg prose-h4:font-semibold prose-h4:mb-2 prose-h4:mt-4
                                  prose-a:text-purple-600 dark:prose-a:text-purple-400
                                  prose-blockquote:border-purple-500 dark:prose-blockquote:border-purple-400
                                  prose-blockquote:text-gray-700 dark:prose-blockquote:text-gray-300"
                                dangerouslySetInnerHTML={{
                                  __html: String(selectedDocument.content)
                                    .replace(/<script[^>]*>.*?<\/script>/gi, '')
                                    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
                                }}
                              />
                            </div>
                          )}

                          {/* Attachments */}
                          {selectedDocument.attachments && Array.isArray(selectedDocument.attachments) && selectedDocument.attachments.length > 0 && (
                            <div className="mb-8">
                              <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                                📎 Risorse Aggiuntive
                              </h4>
                              <div className="grid grid-cols-1 gap-3">
                                {selectedDocument.attachments.filter(attachment => attachment != null).map((attachment: any, index: number) => {
                                  const fileName = getFileName(attachment);

                                  return (
                                    <div key={index} className="flex items-center space-x-4 p-4 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-750 transition-all">
                                      <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-purple-400" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-base font-medium truncate block text-white">{fileName}</span>
                                      </div>
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
                                        className="text-purple-400 hover:text-purple-300"
                                      >
                                        <Download className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Mark as completed section */}
                          <div className="text-center py-8">
                            <div className="inline-block p-6 bg-purple-900/50 rounded-2xl border border-purple-700">
                              <div className="text-3xl mb-3">🎉</div>
                              <h4 className="text-xl font-semibold text-white mb-2">Fine del contenuto</h4>
                              <p className="text-purple-200 mb-4">
                                Hai completato video e testo!
                              </p>
                              {!isDocumentRead(selectedDocument.id) && (
                                <Button
                                  onClick={handleMarkAsRead}
                                  disabled={markAsReadMutation.isPending}
                                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2"
                                >
                                  <CheckCircle size={16} className="mr-2" />
                                  {markAsReadMutation.isPending ? 'Salvando...' : 'Segna come completato'}
                                </Button>
                              )}
                              {isDocumentRead(selectedDocument.id) && (
                                <div className="flex items-center justify-center gap-2 bg-green-600 rounded-lg p-3">
                                  <CheckCircle size={16} className="text-white" />
                                  <span className="text-white font-semibold">Completato!</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Bottom spacing */}
                          <div className="h-20"></div>
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </>
              ) : (
                /* Reading Interface - Same Netflix Style as Video */
                <>
                  {/* Header */}
                  <div className="flex-shrink-0 bg-gradient-to-b from-black/80 to-transparent text-white px-6 py-4 shadow-lg relative z-10">
                    <div className="flex items-center justify-between">
                      <Button
                        onClick={() => setSelectedDocument(undefined)}
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-white/20 px-3 py-1.5 h-auto rounded-full"
                      >
                        ← Torna alla libreria
                      </Button>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-white font-semibold text-lg">
                            {selectedDocument.title}
                          </div>
                          <div className="text-white/70 text-sm">
                            {categories.find((c: LibraryCategory) => c.id === selectedDocument.categoryId)?.name}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main Content Area */}
                  <div className="flex-1 overflow-hidden bg-gray-900">
                    <ScrollArea className="h-full w-full">
                      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-6">

                        {/* Description */}
                        {selectedDocument.description && String(selectedDocument.description).trim() && (
                          <div className="mb-6 p-6 bg-purple-900/30 rounded-2xl border border-purple-700/50">
                            <div className="flex items-center mb-3">
                              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                                <span className="text-white text-sm">📋</span>
                              </div>
                              <h3 className="ml-3 text-lg font-semibold text-white">Sommario</h3>
                            </div>
                            <p className="text-purple-100 leading-relaxed">
                              {String(selectedDocument.description)}
                            </p>
                          </div>
                        )}

                        {/* Text Content */}
                        {selectedDocument.content && String(selectedDocument.content).trim() && (
                          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 md:p-8 mb-8">
                            <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                                <span className="text-3xl">📄</span>
                                Contenuto Testuale
                              </h3>
                              <p className="text-gray-600 dark:text-gray-400">Approfondisci con il materiale scritto</p>
                            </div>

                            <div 
                              className="prose prose-lg max-w-none
                                prose-headings:text-gray-900 dark:prose-headings:text-white
                                prose-p:text-gray-800 dark:prose-p:text-gray-200
                                prose-p:leading-relaxed prose-p:mb-4
                                prose-strong:text-gray-900 dark:prose-strong:text-white
                                prose-strong:font-semibold
                                prose-ul:text-gray-800 dark:prose-ul:text-gray-200
                                prose-ol:text-gray-800 dark:prose-ol:text-gray-200
                                prose-li:my-2
                                prose-h1:text-3xl prose-h1:font-bold prose-h1:mb-4
                                prose-h2:text-2xl prose-h2:font-bold prose-h2:mb-3 prose-h2:mt-8
                                prose-h3:text-xl prose-h3:font-semibold prose-h3:mb-3 prose-h3:mt-6
                                prose-h4:text-lg prose-h4:font-semibold prose-h4:mb-2 prose-h4:mt-4
                                prose-a:text-purple-600 dark:prose-a:text-purple-400
                                prose-blockquote:border-purple-500 dark:prose-blockquote:border-purple-400
                                prose-blockquote:text-gray-700 dark:prose-blockquote:text-gray-300"
                              dangerouslySetInnerHTML={{
                                __html: String(selectedDocument.content)
                                  .replace(/<script[^>]*>.*?<\/script>/gi, '')
                                  .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
                              }}
                            />
                          </div>
                        )}

                        {/* Document Sections */}
                        {documentSections && documentSections.length > 0 && (
                          <div className="mb-8 space-y-6">
                            <h3 className="text-xl font-bold text-white mb-6">
                              ✨ Sezioni Speciali
                            </h3>
                            {documentSections.map((section: LibraryDocumentSection) => (
                              <div
                                key={section.id}
                                className={`p-4 md:p-6 rounded-2xl border-l-4 shadow-sm ${
                                  section.type === 'highlight' ? 'bg-yellow-900/30 border-yellow-500' :
                                  section.type === 'example' ? 'bg-blue-900/30 border-blue-500' :
                                  section.type === 'note' ? 'bg-green-900/30 border-green-500' :
                                  section.type === 'warning' ? 'bg-red-900/30 border-red-500' :
                                  'bg-gray-800 border-gray-600'
                                }`}
                              >
                                <div className="flex items-center space-x-3 mb-3">
                                  <div className="text-xl">{getSectionTypeIcon(section.type)}</div>
                                  <h4 className="text-lg font-semibold text-white">{String(section.title || 'Sezione')}</h4>
                                </div>
                                <div className="whitespace-pre-wrap text-base leading-7 text-gray-200">
                                  {String(section.content || '')}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Attachments */}
                        {selectedDocument.attachments && Array.isArray(selectedDocument.attachments) && selectedDocument.attachments.length > 0 && (
                          <div className="mb-8">
                            <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                              📎 Risorse Aggiuntive
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                              {selectedDocument.attachments.filter(attachment => attachment != null).map((attachment: any, index: number) => {
                                const fileName = getFileName(attachment);

                                return (
                                  <div key={index} className="flex items-center space-x-4 p-4 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-750 transition-all">
                                    <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                                      <FileText className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-base font-medium truncate block text-white">{fileName}</span>
                                    </div>
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
                                      className="text-purple-400 hover:text-purple-300"
                                    >
                                      <Download className="w-4 h-4" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Mark as completed section */}
                        <div className="text-center py-8">
                          <div className="inline-block p-6 bg-purple-900/50 rounded-2xl border border-purple-700">
                            <div className="text-3xl mb-3">🎉</div>
                            <h4 className="text-xl font-semibold text-white mb-2">Fine del contenuto</h4>
                            <p className="text-purple-200 mb-4">
                              Hai completato la lettura!
                            </p>
                            {!isDocumentRead(selectedDocument.id) && (
                              <Button
                                onClick={handleMarkAsRead}
                                disabled={markAsReadMutation.isPending}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2"
                              >
                                <CheckCircle size={16} className="mr-2" />
                                {markAsReadMutation.isPending ? 'Salvando...' : 'Segna come completato'}
                              </Button>
                            )}
                            {isDocumentRead(selectedDocument.id) && (
                              <div className="flex items-center justify-center gap-2 bg-green-600 rounded-lg p-3">
                                <CheckCircle size={16} className="text-white" />
                                <span className="text-white font-semibold">Completato!</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bottom spacing */}
                        <div className="h-20"></div>
                      </div>
                    </ScrollArea>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}