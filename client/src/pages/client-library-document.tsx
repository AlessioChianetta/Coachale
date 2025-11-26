import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Clock,
  Star,
  Download,
  FileText,
  Video,
  Play,
  BookOpen
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { usePageContext } from "@/hooks/use-page-context";

interface VideoPlayerProps {
  url: string;
  title: string;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, title, className = "" }) => {
  const getEmbedUrl = (videoUrl: string) => {
    try {
      const urlObj = new URL(videoUrl);

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

      if (urlObj.hostname.includes('vimeo.com')) {
        const videoId = urlObj.pathname.split('/').pop();
        if (videoId) {
          return `https://player.vimeo.com/video/${videoId}?byline=0&portrait=0`;
        }
      }

      if (urlObj.hostname.includes('wistia.com')) {
        const videoId = urlObj.pathname.split('/').pop();
        if (videoId) {
          return `https://fast.wistia.net/embed/iframe/${videoId}`;
        }
      }

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
        style={{ minHeight: '240px' }}
        loading="lazy"
      />
    </div>
  );
};

export default function ClientLibraryDocument() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, params] = useRoute("/client/library/:documentId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const documentId = params?.documentId;

  // Fetch document details
  const { data: document, isLoading } = useQuery({
    queryKey: [`/api/library/documents/${documentId}`],
    queryFn: async () => {
      const response = await fetch(`/api/library/documents/${documentId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch document");
      return response.json();
    },
    enabled: !!documentId,
  });

  // Fetch categories for display
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/library/categories/client/visible"],
  });

  // Fetch all documents for navigation
  const { data: allDocuments = [] } = useQuery({
    queryKey: ["/api/library/documents"],
    queryFn: async () => {
      const response = await fetch("/api/library/documents", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/library/progress", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          isRead: true,
          readAt: new Date().toISOString(),
          timeSpent: 0,
        }),
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library/progress"] });
      toast({
        title: "Documento segnato come letto",
        description: "Il tuo progresso è stato salvato",
      });
    },
  });

  const getFileName = (att: any) => {
    if (typeof att === 'object' && att.originalName) {
      return att.originalName;
    }
    if (typeof att === 'object' && att.filename) {
      if (att.filename.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\..+$/i)) {
        const extension = att.filename.split('.').pop();
        return `Documento.${extension}`;
      }
      return att.filename;
    }
    if (typeof att === 'string' && att.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\..+$/i)) {
      const extension = att.split('.').pop();
      return `Documento.${extension}`;
    }
    return typeof att === 'string' ? att : 'File sconosciuto';
  };

  // Page context for AI assistant - MUST be called before any conditional returns
  const pageContext = usePageContext(document ? {
    documentId: document.id,
    documentTitle: document.title,
    documentContent: document.content || document.description,
    documentData: {
      categoryName: categories.find((c: any) => c.id === document.categoryId)?.name,
      level: document.level,
      estimatedDuration: document.estimatedDuration
    }
  } : {});

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Documento non trovato</h2>
          <Button onClick={() => setLocation("/client/library")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Torna alla libreria
          </Button>
        </div>
      </div>
    );
  }

  const contentType = (document as any).contentType || "text";
  const category = categories.find((c: any) => c.id === document.categoryId);

  // Calcola lezione precedente e successiva nello stesso modulo
  const currentDocuments = allDocuments.filter((doc: any) =>
    doc.categoryId === document?.categoryId &&
    doc.subcategoryId === document?.subcategoryId
  ).sort((a: any, b: any) => a.sortOrder - b.sortOrder);

  const currentIndex = currentDocuments.findIndex((doc: any) => doc.id === documentId);
  const previousLesson = currentIndex > 0 ? currentDocuments[currentIndex - 1] : null;
  const nextLesson = currentIndex < currentDocuments.length - 1 ? currentDocuments[currentIndex + 1] : null;

  // Modifica il pulsante Indietro per tornare all'esercizio se proveniente da lì
  const handleBack = () => {
    // Controlla se ci sono parametri per il ritorno
    const urlParams = new URLSearchParams(window.location.search);
    const returnTo = urlParams.get('returnTo');
    const exerciseId = urlParams.get('exerciseId');
    const assignmentId = urlParams.get('assignmentId');

    if (returnTo === 'exercise' && exerciseId && assignmentId) {
      // Torna all'esercizio nella tab panoramica
      setLocation(`/exercise/${exerciseId}?assignment=${assignmentId}`);
    } else if (document?.categoryId) {
      // Torna alla categoria/corso del documento
      setLocation(`/client/library?category=${document.categoryId}`);
    } else {
      setLocation('/client/library');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Navbar senza menu durante la lettura */}
      <div className={`flex ${isMobile ? 'h-screen' : 'h-screen'}`}>
        {/* Sidebar nascosta durante la lettura per un'esperienza immersiva */}

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header - Solo pulsante indietro */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
            <div className="max-w-7xl mx-auto">
              <Button
                variant="ghost"
                onClick={handleBack}
                className="gap-1 md:gap-2 h-8 px-2 md:px-3 text-sm"
              >
                <ArrowLeft className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Torna alla libreria</span>
                <span className="sm:hidden">Indietro</span>
              </Button>
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1 bg-gray-50 dark:bg-gray-800">
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-4">
              {/* Document Header - Always visible */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm text-muted-foreground">
                    {category?.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {document.estimatedDuration || 5} min
                    </Badge>
                    <Badge>
                      {document.level}
                    </Badge>
                  </div>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold leading-tight">{document.title}</h1>
                {document.subtitle && (
                  <p className="text-lg text-muted-foreground">{document.subtitle}</p>
                )}
              </div>
              {/* Video (if present) */}
              {(contentType === 'video' || contentType === 'both') && (document as any).videoUrl && (
                <div className="w-full">
                  <div className="relative w-full bg-black rounded-xl overflow-hidden shadow-2xl" style={{ paddingBottom: '56.25%' }}>
                    <div className="absolute inset-0">
                      <VideoPlayer
                        url={(document as any).videoUrl}
                        title={document.title}
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              {document.description && (
                <div className="bg-purple-50 dark:bg-purple-950/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                      <FileText className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold">Sommario</h3>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{document.description}</p>
                </div>
              )}

              {/* Text Content */}
              {document.content && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 md:p-8 shadow-lg border border-gray-200 dark:border-gray-700">
                  <div className="mb-6 pb-4 border-b">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Contenuto
                    </h3>
                  </div>
                  <div
                    className="prose prose-lg max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: String(document.content) }}
                  />
                </div>
              )}

              {/* Document Sections */}
              {document.sections && document.sections.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold">Sezioni Speciali</h3>
                  {document.sections.map((section: any) => (
                    <div
                      key={section.id}
                      className={`p-6 rounded-xl border-l-4 ${
                        section.type === 'highlight' ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500' :
                        section.type === 'example' ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-500' :
                        section.type === 'note' ? 'bg-green-50 dark:bg-green-950/20 border-green-500' :
                        section.type === 'warning' ? 'bg-red-50 dark:bg-red-950/20 border-red-500' :
                        'bg-gray-50 dark:bg-gray-800 border-gray-500'
                      }`}
                    >
                      <h4 className="font-semibold mb-2">{section.title}</h4>
                      <p className="whitespace-pre-wrap">{section.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Attachments */}
              {document.attachments && document.attachments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Risorse Aggiuntive
                  </h3>
                  {document.attachments.map((attachment: any, index: number) => {
                    const fileName = getFileName(attachment);
                    return (
                      <div key={index} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{fileName}</span>
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
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Navigation between lessons */}
              {(previousLesson || nextLesson) && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:justify-between">
                    {previousLesson ? (
                      <Button
                        variant="outline"
                        onClick={() => setLocation(`/client/library/${previousLesson.id}`)}
                        className="justify-start gap-1.5 sm:gap-2 h-auto py-2 sm:py-3 px-2.5 sm:px-4 flex-shrink min-w-0"
                      >
                        <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                        <div className="text-left min-w-0 max-w-[120px] sm:max-w-none overflow-hidden">
                          <div className="text-[9px] sm:text-xs text-muted-foreground mb-0.5 truncate">
                            <span className="hidden sm:inline">Lezione precedente</span>
                            <span className="sm:hidden">Prec.</span>
                          </div>
                          <div className="font-medium text-[10px] sm:text-sm line-clamp-1">{previousLesson.title}</div>
                        </div>
                      </Button>
                    ) : null}

                    {nextLesson ? (
                      <Button
                        onClick={() => setLocation(`/client/library/${nextLesson.id}`)}
                        className="justify-end gap-1.5 sm:gap-2 h-auto py-2 sm:py-3 px-2.5 sm:px-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 flex-shrink min-w-0 sm:ml-auto"
                      >
                        <div className="text-left sm:text-right min-w-0 max-w-[120px] sm:max-w-none overflow-hidden">
                          <div className="text-[9px] sm:text-xs text-white/80 mb-0.5 truncate">
                            <span className="hidden sm:inline">Prossima lezione</span>
                            <span className="sm:hidden">Prox.</span>
                          </div>
                          <div className="font-medium text-[10px] sm:text-sm line-clamp-1">{nextLesson.title}</div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                      </Button>
                    ) : null}
                  </div>

                  {/* Progress indicator */}
                  <div className="mt-4 text-center max-w-full overflow-hidden px-2">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      Lezione {currentIndex + 1} di {currentDocuments.length}
                    </p>
                    <div className="mt-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${((currentIndex + 1) / currentDocuments.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Mark as completed */}
              <div className="text-center py-8">
                <div className="inline-block p-6 bg-purple-50 dark:bg-purple-950/20 rounded-2xl border border-purple-200 dark:border-purple-800">
                  <div className="text-3xl mb-3">🎉</div>
                  <h4 className="text-xl font-semibold mb-2">Hai completato la lettura?</h4>
                  <p className="text-muted-foreground mb-4">
                    Segna questo documento come completato per tracciare il tuo progresso
                  </p>
                  <Button
                    onClick={() => markAsReadMutation.mutate()}
                    disabled={markAsReadMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {markAsReadMutation.isPending ? 'Salvando...' : 'Segna come completato'}
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </main>
      </div>
      
      {/* AI Assistant con page context */}
      <AIAssistant pageContext={pageContext} />
    </div>
  );
}