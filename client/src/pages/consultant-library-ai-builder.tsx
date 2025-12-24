import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Youtube, ListVideo, Settings, Sparkles, Check, Loader2, AlertCircle, Play, Clock, ChevronRight, Eye, FileText, Bookmark, Trash2, FolderOpen, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiRequest } from "@/lib/queryClient";

interface PlaylistVideo {
  videoId: string;
  videoUrl: string;
  title: string;
  thumbnailUrl: string;
  duration: number;
  position: number;
}

interface SavedVideo {
  id: string;
  videoId: string;
  videoUrl: string;
  title: string;
  thumbnailUrl: string;
  channelName: string;
  duration: number;
  transcript: string;
  transcriptStatus: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
}

interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
}

const steps = [
  { id: 1, title: "Link", icon: Youtube },
  { id: 2, title: "Selezione", icon: ListVideo },
  { id: 3, title: "Impostazioni", icon: Settings },
  { id: 4, title: "Genera", icon: Sparkles },
];

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default function ConsultantLibraryAIBuilder() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [inputType, setInputType] = useState<"video" | "playlist">("video");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [playlistVideos, setPlaylistVideos] = useState<PlaylistVideo[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [aiInstructions, setAiInstructions] = useState(
    "Mantieni il tono e lo stile del relatore nel video. Usa le sue espressioni e il suo modo di spiegare i concetti. Struttura il testo in sezioni chiare e leggibili."
  );
  const [contentType, setContentType] = useState<"text" | "video" | "both">("both");
  const [level, setLevel] = useState<"base" | "intermedio" | "avanzato">("base");
  const [saveSettings, setSaveSettings] = useState(true);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState<string[]>([]);
  const [generationLogs, setGenerationLogs] = useState<{ time: string; message: string }[]>([]);
  const [generatedLessons, setGeneratedLessons] = useState<any[]>([]);
  const [generationErrors, setGenerationErrors] = useState<string[]>([]);
  const [generatingVideos, setGeneratingVideos] = useState<Map<string, { status: 'pending' | 'generating' | 'completed' | 'error'; error?: string }>>(new Map());
  const [previewVideo, setPreviewVideo] = useState<SavedVideo | null>(null);
  const [previewTranscript, setPreviewTranscript] = useState<string>("");
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/library/categories"],
  });

  const { data: subcategories = [] } = useQuery<Subcategory[]>({
    queryKey: ["/api/library/subcategories"],
  });

  const { data: aiSettings } = useQuery({
    queryKey: ["/api/library/ai-settings"],
  });

  const { data: drafts = [], refetch: refetchDrafts } = useQuery<any[]>({
    queryKey: ["/api/library/ai-builder-drafts"],
  });

  useEffect(() => {
    if (aiSettings && aiSettings.writingInstructions) {
      setAiInstructions(aiSettings.writingInstructions);
      if (aiSettings.defaultContentType) setContentType(aiSettings.defaultContentType);
      if (aiSettings.defaultLevel) setLevel(aiSettings.defaultLevel);
    }
  }, [aiSettings]);

  const fetchVideoMutation = useMutation({
    mutationFn: async (url: string) => {
      return await apiRequest("POST", "/api/youtube/video", { url });
    },
    onSuccess: (video) => {
      setSavedVideos([video]);
      setSelectedVideoIds([video.id]);
      toast({ title: "Video caricato", description: video.title });
      setCurrentStep(3);
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const fetchPlaylistMutation = useMutation({
    mutationFn: async (url: string) => {
      return await apiRequest("POST", "/api/youtube/playlist", { url });
    },
    onSuccess: (data) => {
      setPlaylistVideos(data.videos);
      setSelectedVideoIds(data.videos.map((v: PlaylistVideo) => v.videoId));
      toast({ title: "Playlist caricata", description: `${data.videos.length} video trovati` });
      setCurrentStep(2);
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const savePlaylistVideosMutation = useMutation({
    mutationFn: async (videos: PlaylistVideo[]) => {
      return await apiRequest("POST", "/api/youtube/playlist/save", {
        videos,
        playlistId: youtubeUrl,
      });
    },
    onSuccess: (data) => {
      setSavedVideos(data.savedVideos);
      setSelectedVideoIds(data.savedVideos.map((v: SavedVideo) => v.id));
      if (data.errors.length > 0) {
        toast({ 
          title: "Alcuni video non sono stati salvati", 
          description: `${data.savedVideos.length} salvati, ${data.errors.length} errori`,
          variant: "destructive"
        });
      }
      setCurrentStep(3);
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const handleLoadContent = () => {
    if (!youtubeUrl) {
      toast({ title: "Inserisci un link YouTube", variant: "destructive" });
      return;
    }
    if (!selectedCategoryId) {
      toast({ title: "Seleziona un corso", variant: "destructive" });
      return;
    }

    if (inputType === "video") {
      fetchVideoMutation.mutate(youtubeUrl);
    } else {
      fetchPlaylistMutation.mutate(youtubeUrl);
    }
  };

  const handleSelectAllVideos = () => {
    setSelectedVideoIds(playlistVideos.map(v => v.videoId));
  };

  const handleDeselectAllVideos = () => {
    setSelectedVideoIds([]);
  };

  const handleToggleVideo = (videoId: string) => {
    setSelectedVideoIds(prev => 
      prev.includes(videoId) 
        ? prev.filter(id => id !== videoId)
        : [...prev, videoId]
    );
  };

  const handleSaveSelectedVideos = () => {
    const selected = playlistVideos.filter(v => selectedVideoIds.includes(v.videoId));
    if (selected.length === 0) {
      toast({ title: "Seleziona almeno un video", variant: "destructive" });
      return;
    }
    savePlaylistVideosMutation.mutate(selected);
  };

  const handlePreviewTranscript = async (video: SavedVideo) => {
    setPreviewVideo(video);
    setLoadingTranscript(true);
    try {
      const data = await apiRequest("GET", `/api/youtube/video/${video.id}/transcript`);
      setPreviewTranscript(data.transcript || "Trascrizione non disponibile");
    } catch (error) {
      setPreviewTranscript("Errore nel caricamento della trascrizione");
    }
    setLoadingTranscript(false);
  };

  const handleSaveDraft = async (name?: string) => {
    setSavingDraft(true);
    try {
      const draftData = {
        name: name || `Bozza ${new Date().toLocaleDateString('it-IT')} ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`,
        youtubeUrl,
        inputType,
        selectedCategoryId,
        selectedSubcategoryId,
        selectedVideoIds,
        playlistVideos,
        savedVideoIds: savedVideos.map(v => v.id),
        aiInstructions,
        contentType,
        level,
        currentStep,
      };

      if (currentDraftId) {
        await apiRequest("PUT", `/api/library/ai-builder-drafts/${currentDraftId}`, draftData);
        toast({ title: "Bozza aggiornata" });
      } else {
        const result = await apiRequest("POST", "/api/library/ai-builder-drafts", draftData);
        setCurrentDraftId(result.id);
        toast({ title: "Bozza salvata" });
      }
      refetchDrafts();
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
    setSavingDraft(false);
  };

  const handleLoadDraft = async (draft: any) => {
    setYoutubeUrl(draft.youtubeUrl || "");
    setInputType(draft.inputType || "video");
    setSelectedCategoryId(draft.selectedCategoryId || "");
    setSelectedSubcategoryId(draft.selectedSubcategoryId || "");
    setSelectedVideoIds(draft.selectedVideoIds || []);
    setPlaylistVideos(draft.playlistVideos || []);
    setAiInstructions(draft.aiInstructions || "");
    setContentType(draft.contentType || "both");
    setLevel(draft.level || "base");
    setCurrentStep(draft.currentStep || 1);
    setCurrentDraftId(draft.id);
    
    setShowDrafts(false);
    toast({ title: "Bozza caricata", description: draft.name });
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      await apiRequest("DELETE", `/api/library/ai-builder-drafts/${draftId}`);
      if (currentDraftId === draftId) setCurrentDraftId(null);
      refetchDrafts();
      toast({ title: "Bozza eliminata" });
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  };

  const handleStartGeneration = async () => {
    if (selectedVideoIds.length === 0) {
      toast({ title: "Nessun video selezionato", variant: "destructive" });
      return;
    }
    
    setCurrentStep(4);
    setGenerationProgress(0);
    setGeneratedLessons([]);
    setGenerationErrors([]);
    setGenerationLogs([]);
    setIsGenerating(true);
    
    const initialStatus = new Map<string, { status: 'pending' | 'generating' | 'completed' | 'error'; error?: string }>();
    savedVideos.filter(v => selectedVideoIds.includes(v.id)).forEach(v => {
      initialStatus.set(v.id, { status: 'pending' });
    });
    setGeneratingVideos(initialStatus);

    try {
      if (saveSettings) {
        await apiRequest("PUT", "/api/library/ai-settings", {
          writingInstructions: aiInstructions,
          defaultContentType: contentType,
          defaultLevel: level,
        });
      }

      const videoIds = savedVideos.filter(v => selectedVideoIds.includes(v.id)).map(v => v.id);
      
      const response = await fetch("/api/library/ai-generate-batch-stream", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        credentials: "include",
        body: JSON.stringify({
          videoIds,
          categoryId: selectedCategoryId,
          subcategoryId: selectedSubcategoryId || undefined,
          customInstructions: aiInstructions,
          level,
          contentType,
        }),
      });

      if (!response.ok) {
        throw new Error("Errore nella generazione");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(line => line.startsWith('data: '));
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            
            const addLog = (message: string) => {
              setGenerationLogs(prev => [...prev, {
                time: new Date().toLocaleTimeString('it-IT'),
                message
              }]);
            };

            if (data.type === 'progress') {
              setGenerationProgress(Math.round((data.current / data.total) * 100));
              setGenerationStatus(prev => [...prev, `Generando: ${data.videoTitle}`]);
              if (data.log) addLog(data.log);
              setGeneratingVideos(prev => {
                const next = new Map(prev);
                savedVideos.forEach(v => {
                  if (v.title === data.videoTitle) {
                    next.set(v.id, { status: 'generating' });
                  }
                });
                return next;
              });
            } else if (data.type === 'video_complete') {
              if (data.log) addLog(data.log);
              setGeneratingVideos(prev => {
                const next = new Map(prev);
                savedVideos.forEach(v => {
                  if (v.title === data.videoTitle) {
                    next.set(v.id, { status: 'completed' });
                  }
                });
                return next;
              });
            } else if (data.type === 'video_error') {
              if (data.log) addLog(data.log);
              setGeneratingVideos(prev => {
                const next = new Map(prev);
                savedVideos.forEach(v => {
                  if (v.title === data.videoTitle) {
                    next.set(v.id, { status: 'error', error: data.error });
                  }
                });
                return next;
              });
            } else if (data.type === 'complete') {
              setGeneratedLessons(data.lessons);
              setGenerationErrors(data.errors);
              setGenerationProgress(100);
              savedVideos.filter(v => selectedVideoIds.includes(v.id)).forEach(v => {
                setGeneratingVideos(prev => {
                  const next = new Map(prev);
                  const current = next.get(v.id);
                  if (current?.status === 'generating' || current?.status === 'pending') {
                    next.set(v.id, { status: 'completed' });
                  }
                  return next;
                });
              });
              queryClient.invalidateQueries({ queryKey: ["/api/library/documents"] });
              toast({ title: "Lezioni generate!", description: `${data.lessons.length} lezioni create` });
            } else if (data.type === 'error') {
              toast({ title: "Errore", description: data.message, variant: "destructive" });
            }
          } catch (e) {}
        }
      }
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredSubcategories = subcategories.filter(
    (sub) => sub.categoryId === selectedCategoryId
  );

  const isLoading = fetchVideoMutation.isPending || fetchPlaylistMutation.isPending || 
                    savePlaylistVideosMutation.isPending || isGenerating;

  return (
    <>
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setLocation("/consultant/library")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Torna alla Libreria
              </Button>
              <div className="flex items-center gap-2 ml-auto">
                {currentDraftId && (
                  <Badge variant="outline" className="text-xs">
                    <Bookmark className="w-3 h-3 mr-1" />
                    Bozza attiva
                  </Badge>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleSaveDraft()}
                  disabled={savingDraft || currentStep === 4}
                >
                  {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salva Bozza
                </Button>
                <Sheet open={showDrafts} onOpenChange={setShowDrafts}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FolderOpen className="w-4 h-4 mr-2" />
                      Bozze ({drafts.length})
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Bozze Salvate</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 space-y-3">
                      {drafts.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">Nessuna bozza salvata</p>
                      ) : (
                        drafts.map((draft: any) => (
                          <div 
                            key={draft.id} 
                            className={`p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                              currentDraftId === draft.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20' : ''
                            }`}
                            onClick={() => handleLoadDraft(draft)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{draft.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(draft.updatedAt).toLocaleDateString('it-IT')} - Step {draft.currentStep}
                                </p>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleDeleteDraft(draft.id); }}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                AI Course Builder
              </h1>
              <p className="text-muted-foreground">
                Crea lezioni automaticamente da video YouTube
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 md:gap-4 py-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div 
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                      currentStep === step.id 
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' 
                        : currentStep > step.id
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <step.icon className="w-4 h-4" />
                    )}
                    <span className="hidden md:inline text-sm font-medium">{step.title}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>

            {currentStep === 1 && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Inserisci Link YouTube</CardTitle>
                    <CardDescription>Video singolo o playlist</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex gap-2">
                      <Button
                        variant={inputType === "video" ? "default" : "outline"}
                        onClick={() => setInputType("video")}
                        className="flex-1"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Video Singolo
                      </Button>
                      <Button
                        variant={inputType === "playlist" ? "default" : "outline"}
                        onClick={() => setInputType("playlist")}
                        className="flex-1"
                      >
                        <ListVideo className="w-4 h-4 mr-2" />
                        Playlist
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Link YouTube</Label>
                      <Input
                        placeholder={inputType === "video" 
                          ? "https://youtube.com/watch?v=..." 
                          : "https://youtube.com/playlist?list=..."
                        }
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Corso di destinazione *</Label>
                      <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona un corso" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {filteredSubcategories.length > 0 && (
                      <div className="space-y-2">
                        <Label>Modulo (opzionale)</Label>
                        <Select value={selectedSubcategoryId} onValueChange={setSelectedSubcategoryId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona un modulo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Nessun modulo</SelectItem>
                            {filteredSubcategories.map((sub) => (
                              <SelectItem key={sub.id} value={sub.id}>
                                {sub.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <Button 
                      onClick={handleLoadContent}
                      disabled={isLoading || !youtubeUrl || !selectedCategoryId}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Youtube className="w-4 h-4 mr-2" />
                      )}
                      Carica Contenuto
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Youtube className="w-5 h-5 text-red-500" />
                      Anteprima
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center min-h-[200px]">
                    {youtubeUrl ? (
                      <div className="text-center space-y-2">
                        <div className="w-full aspect-video bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                          <Youtube className="w-12 h-12 text-gray-400" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Clicca "Carica Contenuto" per visualizzare i dettagli
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center">
                        Inserisci un link YouTube per vedere l'anteprima
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Seleziona Video dalla Playlist</CardTitle>
                      <CardDescription>{playlistVideos.length} video trovati</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleSelectAllVideos}>
                        Seleziona Tutti
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDeselectAllVideos}>
                        Deseleziona Tutti
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {playlistVideos.map((video) => (
                      <div 
                        key={video.videoId}
                        className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedVideoIds.includes(video.videoId)
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                            : 'border-muted hover:border-purple-300'
                        }`}
                        onClick={() => handleToggleVideo(video.videoId)}
                      >
                        <Checkbox 
                          checked={selectedVideoIds.includes(video.videoId)}
                          onCheckedChange={() => handleToggleVideo(video.videoId)}
                        />
                        <img 
                          src={video.thumbnailUrl} 
                          alt={video.title}
                          className="w-24 h-14 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{video.title}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatDuration(video.duration)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <Button variant="outline" onClick={() => setCurrentStep(1)}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Indietro
                    </Button>
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary">
                        {selectedVideoIds.length} video selezionati
                      </Badge>
                      <Button 
                        onClick={handleSaveSelectedVideos}
                        disabled={isLoading || selectedVideoIds.length === 0}
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4 mr-2" />
                        )}
                        Continua
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 3 && (
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Impostazioni AI
                    </CardTitle>
                    <CardDescription>Come deve scrivere l'AI?</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Istruzioni per l'AI</Label>
                      <Textarea
                        rows={6}
                        value={aiInstructions}
                        onChange={(e) => setAiInstructions(e.target.value)}
                        placeholder="Es: Mantieni il tono informale del relatore..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Formato lezione</Label>
                      <Select value={contentType} onValueChange={(v: any) => setContentType(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="both">Testo + Video embeddato</SelectItem>
                          <SelectItem value="text">Solo testo</SelectItem>
                          <SelectItem value="video">Solo video</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Livello</Label>
                      <Select value={level} onValueChange={(v: any) => setLevel(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="base">Base</SelectItem>
                          <SelectItem value="intermedio">Intermedio</SelectItem>
                          <SelectItem value="avanzato">Avanzato</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Salva come impostazioni predefinite</Label>
                      <Switch checked={saveSettings} onCheckedChange={setSaveSettings} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
                  <CardHeader>
                    <CardTitle>Video Selezionati</CardTitle>
                    <CardDescription>{savedVideos.length} video pronti per la generazione</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {savedVideos.map((video) => (
                        <div key={video.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/50 dark:bg-gray-800/50">
                          <img 
                            src={video.thumbnailUrl} 
                            alt={video.title}
                            className="w-16 h-10 object-cover rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{video.title}</p>
                            <Badge 
                              variant={video.transcriptStatus === 'completed' ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {video.transcriptStatus === 'completed' ? 'Trascrizione OK' : 'No trascrizione'}
                            </Badge>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handlePreviewTranscript(video); }}
                            title="Anteprima trascrizione"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                      <Button variant="outline" onClick={() => setCurrentStep(inputType === "playlist" ? 2 : 1)}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Indietro
                      </Button>
                      <Button 
                        onClick={handleStartGeneration}
                        disabled={isLoading || savedVideos.filter(v => v.transcriptStatus === 'completed').length === 0}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Genera {savedVideos.filter(v => v.transcriptStatus === 'completed').length} Lezioni
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {currentStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {generationProgress < 100 ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                        Generazione in Corso...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5 text-green-500" />
                        Lezioni Generate!
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Progress value={generationProgress} className="h-3" />
                  
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground">Stato video:</h3>
                    {savedVideos.filter(v => selectedVideoIds.includes(v.id)).map((video) => {
                      const status = generatingVideos.get(video.id);
                      return (
                        <div key={video.id} className="flex items-center gap-3 p-3 rounded-lg border">
                          <img src={video.thumbnailUrl} alt={video.title} className="w-16 h-10 object-cover rounded" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{video.title}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {status?.status === 'pending' && <Clock className="w-4 h-4 text-muted-foreground" />}
                            {status?.status === 'generating' && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
                            {status?.status === 'completed' && <Check className="w-4 h-4 text-green-500" />}
                            {status?.status === 'error' && (
                              <div className="flex items-center gap-1 text-red-500">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-xs">{status.error}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {generationLogs.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Log in tempo reale:
                      </h3>
                      <div className="bg-muted/50 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
                        {generationLogs.map((log, idx) => (
                          <div key={idx} className="flex gap-2">
                            <span className="text-muted-foreground">[{log.time}]</span>
                            <span>{log.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isGenerating && generationLogs.length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">
                        L'AI sta analizzando le trascrizioni e creando le lezioni...
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Mantenendo lo stile originale dei video
                      </p>
                    </div>
                  )}

                  {generatedLessons.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-green-600">
                        {generatedLessons.length} lezioni create con successo
                      </h3>
                      {generatedLessons.map((lesson, idx) => (
                        <div key={lesson.id || idx} className="flex items-center gap-3 p-3 rounded-lg border bg-green-50 dark:bg-green-950/20">
                          <Check className="w-5 h-5 text-green-500" />
                          <span className="font-medium">{lesson.title}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {generationErrors.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-red-600 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {generationErrors.length} errori
                      </h3>
                      {generationErrors.map((error, idx) => (
                        <div key={idx} className="p-3 rounded-lg border bg-red-50 dark:bg-red-950/20 text-sm text-red-600">
                          {error}
                        </div>
                      ))}
                    </div>
                  )}

                  {generationProgress >= 100 && (
                    <div className="flex items-center justify-center gap-4 pt-4">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setCurrentStep(1);
                          setYoutubeUrl("");
                          setSavedVideos([]);
                          setPlaylistVideos([]);
                          setSelectedVideoIds([]);
                          setGeneratedLessons([]);
                          setGenerationErrors([]);
                          setGenerationProgress(0);
                          setGenerationLogs([]);
                          setGeneratingVideos(new Map());
                        }}
                      >
                        Crea Altre Lezioni
                      </Button>
                      <Button onClick={() => setLocation("/consultant/library")}>
                        Vai al Corso
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      <Dialog open={!!previewVideo} onOpenChange={(open) => !open && setPreviewVideo(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Trascrizione: {previewVideo?.title}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            {loadingTranscript ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg">
                {previewTranscript}
              </pre>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
