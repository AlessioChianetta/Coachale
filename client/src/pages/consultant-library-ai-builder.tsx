import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Youtube, ListVideo, Settings, Sparkles, Check, Loader2, AlertCircle, Play, Clock, ChevronRight, Eye, FileText, Bookmark, Trash2, FolderOpen, Save, Edit, Plus, Download, Music, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
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
  transcript?: string;
  transcriptStatus: string;
  transcriptLength?: number;
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
  { id: 5, title: "Riepilogo", icon: FileText },
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

// Template istruzioni AI predefiniti
const AI_INSTRUCTION_TEMPLATES = [
  {
    id: "speaker-style",
    name: "Stile del Relatore",
    description: "Mantiene tono e stile originale",
    instructions: "Mantieni il tono e lo stile del relatore nel video. Usa le sue espressioni e il suo modo di spiegare i concetti. Struttura il testo in sezioni chiare e leggibili."
  },
  {
    id: "formal",
    name: "Stile Formale",
    description: "Tono professionale e accademico",
    instructions: "Riscrivi il contenuto con un tono formale e professionale. Usa un linguaggio preciso e tecnico. Evita espressioni colloquiali e mantieni un registro accademico."
  },
  {
    id: "conversational",
    name: "Stile Colloquiale",
    description: "Amichevole e accessibile",
    instructions: "Riscrivi il contenuto con un tono amichevole e colloquiale. Usa un linguaggio semplice e accessibile. Mantieni un ritmo scorrevole come se stessi parlando con un amico."
  },
  {
    id: "bullet-points",
    name: "Lista Puntata",
    description: "Punti chiave in formato lista",
    instructions: "Estrai i concetti chiave e presentali in formato lista puntata. Ogni punto deve essere chiaro e conciso. Usa sottotitoli per organizzare le sezioni."
  },
  {
    id: "step-by-step",
    name: "Passo per Passo",
    description: "Tutorial con passi numerati",
    instructions: "Struttura il contenuto come un tutorial passo per passo. Numera ogni passaggio e spiega chiaramente cosa fare. Includi esempi pratici dove possibile."
  },
  {
    id: "summary",
    name: "Riassunto Conciso",
    description: "Sintesi breve e essenziale",
    instructions: "Crea un riassunto conciso del contenuto. Mantieni solo i punti essenziali. La lezione deve essere breve ma completa."
  }
];

// Verifica se una trascrizione è valida (non vuota e con contenuto minimo)
function hasValidTranscript(video: SavedVideo): boolean {
  // Usa transcriptLength se disponibile (dal backend ottimizzato), altrimenti controlla transcript
  const length = video.transcriptLength ?? (video.transcript?.trim().length ?? 0);
  return video.transcriptStatus === 'completed' && length >= 50;
}

// Valuta qualità trascrizione basata su lunghezza e durata video
// Accetta transcript (stringa) o transcriptLength (numero di caratteri)
function evaluateTranscriptQuality(
  transcriptOrLength: string | number | undefined | null, 
  videoDuration: number
): { level: 'excellent' | 'good' | 'poor' | 'empty'; label: string; color: string } {
  // Determina la lunghezza in caratteri
  let charLength: number;
  let wordCount: number;
  
  if (typeof transcriptOrLength === 'number') {
    // Se è un numero, è transcriptLength (caratteri)
    charLength = transcriptOrLength;
    // Stima parole: ~5 caratteri per parola in italiano
    wordCount = Math.round(charLength / 5);
  } else if (typeof transcriptOrLength === 'string' && transcriptOrLength.trim().length > 0) {
    charLength = transcriptOrLength.trim().length;
    wordCount = transcriptOrLength.split(/\s+/).length;
  } else {
    return { level: 'empty', label: 'Vuota', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
  }
  
  if (charLength === 0) {
    return { level: 'empty', label: 'Vuota', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
  }
  
  const expectedWordsPerMinute = 120; // Parlato normale ~120-150 parole/min
  const videoMinutes = Math.max(1, videoDuration / 60);
  const expectedWords = videoMinutes * expectedWordsPerMinute;
  const ratio = wordCount / expectedWords;
  
  if (ratio >= 0.7) {
    return { level: 'excellent', label: 'Ottima', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
  } else if (ratio >= 0.4) {
    return { level: 'good', label: 'Buona', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
  } else {
    return { level: 'poor', label: 'Incompleta', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' };
  }
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
  const [transcriptMode, setTranscriptMode] = useState<"auto" | "gemini" | "subtitles">("auto");
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
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState<string>("");
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [previewLesson, setPreviewLesson] = useState<any>(null);
  const [lessonOrder, setLessonOrder] = useState<string[]>([]);
  
  // Step 2: Stato caricamento video con UI dettagliata
  const [isSavingVideos, setIsSavingVideos] = useState(false);
  const [savingVideoProgress, setSavingVideoProgress] = useState(0);
  const [savingVideoStatuses, setSavingVideoStatuses] = useState<Map<string, {
    status: 'waiting' | 'downloading' | 'transcribing' | 'completed' | 'error' | 'reused';
    message?: string;
  }>>(new Map());
  const [savingLogs, setSavingLogs] = useState<{ time: string; message: string; type?: 'info' | 'success' | 'error' | 'warning' }[]>([]);

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
      return await apiRequest("POST", "/api/youtube/video", { url, transcriptMode });
    },
    onSuccess: (video) => {
      setSavedVideos([video]);
      setSelectedVideoIds([video.id]);
      if (video.reused) {
        toast({ 
          title: "Video già elaborato", 
          description: `"${video.title}" - Trascrizione esistente riutilizzata`,
        });
      } else {
        toast({ title: "Video caricato", description: video.title });
      }
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
        transcriptMode,
      });
    },
    onSuccess: (data) => {
      setSavedVideos(data.savedVideos);
      setSelectedVideoIds(data.savedVideos.map((v: SavedVideo) => v.id));
      
      const messages = [];
      if (data.reusedCount > 0) {
        messages.push(`${data.reusedCount} già elaborati`);
      }
      if (data.errors.length > 0) {
        messages.push(`${data.errors.length} errori`);
      }
      
      if (messages.length > 0) {
        toast({ 
          title: `${data.savedVideos.length} video pronti`, 
          description: messages.join(', '),
          variant: data.errors.length > 0 ? "destructive" : "default"
        });
      } else {
        toast({ title: "Video caricati", description: `${data.savedVideos.length} video pronti` });
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

  const handleSaveSelectedVideos = async () => {
    const selected = playlistVideos.filter(v => selectedVideoIds.includes(v.videoId));
    if (selected.length === 0) {
      toast({ title: "Seleziona almeno un video", variant: "destructive" });
      return;
    }
    
    setIsSavingVideos(true);
    setSavingVideoProgress(0);
    setSavingLogs([]);
    
    // Inizializza tutti i video come 'waiting'
    const initialStatuses = new Map<string, { status: 'waiting' | 'downloading' | 'transcribing' | 'completed' | 'error' | 'reused'; message?: string }>();
    selected.forEach(v => initialStatuses.set(v.videoId, { status: 'waiting' }));
    setSavingVideoStatuses(initialStatuses);
    
    const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
      setSavingLogs(prev => [...prev, {
        time: new Date().toLocaleTimeString('it-IT'),
        message,
        type
      }]);
    };
    
    addLog(`Avvio elaborazione di ${selected.length} video...`, 'info');
    
    try {
      const response = await fetch("/api/youtube/playlist/save-stream", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        credentials: "include",
        body: JSON.stringify({
          videos: selected,
          playlistId: youtubeUrl,
          transcriptMode,
        }),
      });

      if (!response.ok) {
        throw new Error("Errore nel salvataggio video");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let savedVideosList: SavedVideo[] = [];
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(line => line.startsWith('data: '));
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'start') {
              addLog(`Elaborazione video: "${data.title}"`, 'info');
              setSavingVideoStatuses(prev => {
                const next = new Map(prev);
                next.set(data.videoId, { status: 'downloading', message: 'Scaricando...' });
                return next;
              });
            } else if (data.type === 'downloading') {
              setSavingVideoStatuses(prev => {
                const next = new Map(prev);
                next.set(data.videoId, { status: 'downloading', message: data.message || 'Scaricando audio...' });
                return next;
              });
            } else if (data.type === 'transcribing') {
              addLog(`Estraendo trascrizione: "${data.title}"`, 'info');
              setSavingVideoStatuses(prev => {
                const next = new Map(prev);
                next.set(data.videoId, { status: 'transcribing', message: data.message || 'Estraendo trascrizione...' });
                return next;
              });
            } else if (data.type === 'reused') {
              addLog(`♻️ Riutilizzata trascrizione esistente: "${data.title}"`, 'success');
              setSavingVideoStatuses(prev => {
                const next = new Map(prev);
                next.set(data.videoId, { status: 'reused', message: 'Trascrizione riutilizzata' });
                return next;
              });
            } else if (data.type === 'completed') {
              addLog(`✅ Completato: "${data.title}"`, 'success');
              setSavingVideoStatuses(prev => {
                const next = new Map(prev);
                next.set(data.videoId, { status: 'completed', message: data.transcriptLength ? `${data.transcriptLength} caratteri` : 'Completato' });
                return next;
              });
            } else if (data.type === 'error') {
              addLog(`❌ Errore: "${data.title}" - ${data.error}`, 'error');
              setSavingVideoStatuses(prev => {
                const next = new Map(prev);
                next.set(data.videoId, { status: 'error', message: data.error });
                return next;
              });
            } else if (data.type === 'progress') {
              setSavingVideoProgress(Math.round((data.current / data.total) * 100));
            } else if (data.type === 'done') {
              savedVideosList = data.savedVideos || [];
              addLog(`🎉 Completato! ${savedVideosList.length} video pronti`, 'success');
            }
          } catch (e) {
            // Ignora errori di parsing
          }
        }
      }
      
      // Completamento
      setSavedVideos(savedVideosList);
      setSelectedVideoIds(savedVideosList.map((v: SavedVideo) => v.id));
      
      setTimeout(() => {
        setIsSavingVideos(false);
        setCurrentStep(3);
        toast({ title: "Video caricati", description: `${savedVideosList.length} video pronti per la generazione` });
      }, 1000);
      
    } catch (error: any) {
      addLog(`Errore: ${error.message}`, 'error');
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      setIsSavingVideos(false);
    }
  };

  const handlePreviewTranscript = async (video: SavedVideo) => {
    setPreviewVideo(video);
    setLoadingTranscript(true);
    setIsEditingTranscript(false);
    setEditedTranscript("");
    try {
      const data = await apiRequest("GET", `/api/youtube/video/${video.id}/transcript`);
      const transcript = data.transcript || "";
      setPreviewTranscript(transcript);
      if (!transcript || data.transcriptStatus !== 'completed') {
        setIsEditingTranscript(true);
        setEditedTranscript(transcript);
      }
    } catch (error) {
      setPreviewTranscript("");
      setIsEditingTranscript(true);
    }
    setLoadingTranscript(false);
  };

  const handleSaveTranscript = async () => {
    if (!previewVideo || editedTranscript.trim().length < 10) {
      toast({ title: "Errore", description: "La trascrizione deve contenere almeno 10 caratteri", variant: "destructive" });
      return;
    }
    setSavingTranscript(true);
    try {
      await apiRequest("PUT", `/api/youtube/video/${previewVideo.id}/transcript`, { transcript: editedTranscript });
      setPreviewTranscript(editedTranscript);
      setIsEditingTranscript(false);
      setSavedVideos(prev => prev.map(v => 
        v.id === previewVideo.id ? { ...v, transcript: editedTranscript, transcriptStatus: 'completed' } : v
      ));
      toast({ title: "Salvato", description: "Trascrizione salvata con successo" });
    } catch (error: any) {
      toast({ title: "Errore", description: error.message || "Errore nel salvataggio", variant: "destructive" });
    }
    setSavingTranscript(false);
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
              setLessonOrder(data.lessons.map((l: any) => l.id));
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
              setTimeout(() => setCurrentStep(5), 1500);
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

                    <div className="space-y-2">
                      <Label>Modalità Trascrizione</Label>
                      <Select value={transcriptMode} onValueChange={(v: any) => setTranscriptMode(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">🤖 Automatico (Gemini → Sottotitoli)</SelectItem>
                          <SelectItem value="gemini">🎵 Solo Gemini AI (qualità premium)</SelectItem>
                          <SelectItem value="subtitles">📝 Solo Sottotitoli (più veloce)</SelectItem>
                          <SelectItem value="manual">✍️ Inserisci Manualmente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

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
                  {/* Overlay di caricamento con stato per ogni video */}
                  {isSavingVideos && (
                    <div className="mb-6 p-6 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border-2 border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white animate-pulse" />
                          </div>
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-ping" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">Elaborazione in corso...</h3>
                          <p className="text-sm text-muted-foreground">
                            {savingVideoProgress}% completato
                          </p>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500 ease-out"
                          style={{ width: `${savingVideoProgress}%` }}
                        />
                      </div>
                      
                      {/* Lista video con stato */}
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {playlistVideos
                          .filter(v => selectedVideoIds.includes(v.videoId))
                          .map((video) => {
                            const status = savingVideoStatuses.get(video.videoId);
                            return (
                              <div 
                                key={video.videoId}
                                className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
                                  status?.status === 'completed' || status?.status === 'reused'
                                    ? 'bg-green-100 dark:bg-green-900/30'
                                    : status?.status === 'error'
                                    ? 'bg-red-100 dark:bg-red-900/30'
                                    : status?.status === 'downloading' || status?.status === 'transcribing'
                                    ? 'bg-blue-100 dark:bg-blue-900/30'
                                    : 'bg-white/50 dark:bg-gray-800/50'
                                }`}
                              >
                                {/* Status icon */}
                                <div className="w-6 h-6 flex items-center justify-center">
                                  {status?.status === 'waiting' && (
                                    <Clock className="w-4 h-4 text-gray-400" />
                                  )}
                                  {status?.status === 'downloading' && (
                                    <Download className="w-4 h-4 text-blue-500 animate-bounce" />
                                  )}
                                  {status?.status === 'transcribing' && (
                                    <Music className="w-4 h-4 text-purple-500 animate-pulse" />
                                  )}
                                  {(status?.status === 'completed' || status?.status === 'reused') && (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  )}
                                  {status?.status === 'error' && (
                                    <XCircle className="w-4 h-4 text-red-500" />
                                  )}
                                </div>
                                
                                {/* Video info */}
                                <img 
                                  src={video.thumbnailUrl} 
                                  alt={video.title}
                                  className="w-12 h-7 object-cover rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{video.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {status?.status === 'waiting' && 'In attesa...'}
                                    {status?.status === 'downloading' && (status.message || 'Scaricando...')}
                                    {status?.status === 'transcribing' && (status.message || 'Estraendo trascrizione...')}
                                    {status?.status === 'reused' && '♻️ Trascrizione riutilizzata'}
                                    {status?.status === 'completed' && (status.message || 'Completato')}
                                    {status?.status === 'error' && (status.message || 'Errore')}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      
                      {/* Log attività */}
                      {savingLogs.length > 0 && (
                        <div className="mt-4 p-3 bg-gray-900 rounded-lg max-h-[120px] overflow-y-auto">
                          <div className="space-y-1 font-mono text-xs">
                            {savingLogs.slice(-10).map((log, idx) => (
                              <div 
                                key={idx} 
                                className={`flex gap-2 ${
                                  log.type === 'success' ? 'text-green-400' :
                                  log.type === 'error' ? 'text-red-400' :
                                  log.type === 'warning' ? 'text-yellow-400' :
                                  'text-gray-300'
                                }`}
                              >
                                <span className="text-gray-500">[{log.time}]</span>
                                <span>{log.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {playlistVideos.map((video) => (
                      <div 
                        key={video.videoId}
                        className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedVideoIds.includes(video.videoId)
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                            : 'border-muted hover:border-purple-300'
                        } ${isSavingVideos ? 'opacity-50 pointer-events-none' : ''}`}
                        onClick={() => handleToggleVideo(video.videoId)}
                      >
                        <Checkbox 
                          checked={selectedVideoIds.includes(video.videoId)}
                          onCheckedChange={() => handleToggleVideo(video.videoId)}
                          disabled={isSavingVideos}
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
                    <Button variant="outline" onClick={() => setCurrentStep(1)} disabled={isSavingVideos}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Indietro
                    </Button>
                    <div className="flex items-center gap-4">
                      <Badge variant="secondary">
                        {selectedVideoIds.length} video selezionati
                      </Badge>
                      <Button 
                        onClick={handleSaveSelectedVideos}
                        disabled={isLoading || isSavingVideos || selectedVideoIds.length === 0}
                      >
                        {isSavingVideos ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <ArrowRight className="w-4 h-4 mr-2" />
                        )}
                        {isSavingVideos ? 'Elaborazione...' : 'Continua'}
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
                      <Label>Stile di scrittura</Label>
                      <Select onValueChange={(templateId) => {
                        const template = AI_INSTRUCTION_TEMPLATES.find(t => t.id === templateId);
                        if (template) setAiInstructions(template.instructions);
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Scegli un template..." />
                        </SelectTrigger>
                        <SelectContent>
                          {AI_INSTRUCTION_TEMPLATES.map(template => (
                            <SelectItem key={template.id} value={template.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{template.name}</span>
                                <span className="text-xs text-muted-foreground">{template.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Istruzioni per l'AI</Label>
                      <Textarea
                        rows={5}
                        value={aiInstructions}
                        onChange={(e) => setAiInstructions(e.target.value)}
                        placeholder="Es: Mantieni il tono informale del relatore..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Seleziona un template sopra o scrivi le tue istruzioni personalizzate
                      </p>
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
                    {savedVideos.some(v => !hasValidTranscript(v)) && (
                      <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          <strong>Inserisci le trascrizioni mancanti</strong> cliccando sull'icona ✏️ accanto a ogni video prima di generare le lezioni.
                        </p>
                      </div>
                    )}
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
                            <div className="flex gap-1.5 flex-wrap">
                              {(() => {
                                const isValid = hasValidTranscript(video);
                                const quality = evaluateTranscriptQuality(video.transcriptLength ?? video.transcript, video.duration);
                                return (
                                  <>
                                    <Badge 
                                      variant={isValid ? 'default' : 'secondary'}
                                      className={`text-xs ${!isValid ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' : ''}`}
                                    >
                                      {isValid ? 'Trascrizione OK' : 'Da inserire'}
                                    </Badge>
                                    <Badge variant="outline" className={`text-xs ${quality.color}`}>
                                      Qualità: {quality.label}
                                    </Badge>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          <Button 
                            variant={hasValidTranscript(video) ? 'ghost' : 'outline'}
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handlePreviewTranscript(video); }}
                            title={hasValidTranscript(video) ? 'Anteprima trascrizione' : 'Inserisci trascrizione'}
                            className={!hasValidTranscript(video) ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : ''}
                          >
                            {hasValidTranscript(video) ? <Eye className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
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
                        disabled={isLoading || savedVideos.filter(v => hasValidTranscript(v)).length === 0}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Genera {savedVideos.filter(v => hasValidTranscript(v)).length} Lezioni
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
                      <p className="text-sm text-muted-foreground animate-pulse">
                        Preparazione riepilogo lezioni...
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {currentStep === 5 && (
              <div className="space-y-6">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500" />
                      Riepilogo Lezioni Generate
                    </CardTitle>
                    <CardDescription>
                      {generatedLessons.length} lezioni create con successo. Clicca su una lezione per vedere l'anteprima.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {generatedLessons.length > 0 && (
                      <div className="space-y-3">
                        {lessonOrder.map((lessonId, index) => {
                          const lesson = generatedLessons.find((l: any) => l.id === lessonId);
                          if (!lesson) return null;
                          const sourceVideo = savedVideos.find(v => v.id === lesson.youtubeVideoId || v.videoId === lesson.youtubeVideoId);
                          const transcriptQuality = sourceVideo 
                            ? evaluateTranscriptQuality(sourceVideo.transcriptLength ?? sourceVideo.transcript, sourceVideo.duration)
                            : null;
                          return (
                            <div 
                              key={lesson.id} 
                              className="flex items-center gap-3 p-4 rounded-lg border bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                              onClick={() => setPreviewLesson(lesson)}
                            >
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold text-sm">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{lesson.title}</p>
                                {lesson.subtitle && (
                                  <p className="text-sm text-muted-foreground truncate">{lesson.subtitle}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {transcriptQuality && (
                                  <Badge variant="outline" className={`text-xs ${transcriptQuality.color}`}>
                                    Fonte: {transcriptQuality.label}
                                  </Badge>
                                )}
                                {lesson.level && (
                                  <Badge variant="outline" className="text-xs">
                                    {lesson.level}
                                  </Badge>
                                )}
                                <Button variant="ghost" size="sm">
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <div className="flex flex-col gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 px-2"
                                    disabled={index === 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLessonOrder(prev => {
                                        const newOrder = [...prev];
                                        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                                        return newOrder;
                                      });
                                    }}
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 px-2"
                                    disabled={index === lessonOrder.length - 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLessonOrder(prev => {
                                        const newOrder = [...prev];
                                        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                                        return newOrder;
                                      });
                                    }}
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {generationErrors.length > 0 && (
                      <div className="mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200">
                        <h4 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {generationErrors.length} errori durante la generazione
                        </h4>
                        <ul className="text-sm text-red-600 space-y-1">
                          {generationErrors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
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
                          setLessonOrder([]);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Crea Altre Lezioni
                      </Button>
                      <Button 
                        onClick={() => setLocation("/consultant/library")}
                        className="bg-gradient-to-r from-green-600 to-emerald-600"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Vai alla Libreria
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>

      <Dialog open={!!previewLesson} onOpenChange={(open) => { if (!open) setPreviewLesson(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Anteprima Lezione
            </DialogTitle>
          </DialogHeader>
          {previewLesson && (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">{previewLesson.title}</h2>
                  {previewLesson.subtitle && (
                    <p className="text-lg text-muted-foreground mt-1">{previewLesson.subtitle}</p>
                  )}
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  {previewLesson.level && <Badge variant="outline">{previewLesson.level}</Badge>}
                  {previewLesson.contentType && <Badge variant="secondary">{previewLesson.contentType}</Badge>}
                  {previewLesson.estimatedDuration && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {previewLesson.estimatedDuration} min
                    </Badge>
                  )}
                </div>

                {previewLesson.videoUrl && (
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <iframe 
                      src={`https://www.youtube.com/embed/${previewLesson.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1] || ''}`}
                      className="w-full h-full"
                      allowFullScreen
                    />
                  </div>
                )}

                <div className="prose dark:prose-invert max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: previewLesson.content?.replace(/\n/g, '<br/>') || '' }} />
                </div>

                {previewLesson.tags && previewLesson.tags.length > 0 && (
                  <div className="flex gap-2 flex-wrap pt-4 border-t">
                    {previewLesson.tags.map((tag: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-xs">#{tag}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewVideo} onOpenChange={(open) => { if (!open) { setPreviewVideo(null); setIsEditingTranscript(false); } }}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {isEditingTranscript ? "Inserisci Trascrizione" : "Trascrizione"}: {previewVideo?.title}
            </DialogTitle>
          </DialogHeader>
          
          {loadingTranscript ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : isEditingTranscript ? (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Trascrizione non disponibile.</strong> YouTube ha bloccato l'estrazione automatica. 
                  Puoi copiare la trascrizione da YouTube (sottotitoli) e incollarla qui.
                </p>
              </div>
              <Textarea
                value={editedTranscript}
                onChange={(e) => setEditedTranscript(e.target.value)}
                placeholder="Incolla qui la trascrizione del video..."
                className="min-h-[300px] font-mono text-sm"
              />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {editedTranscript.length} caratteri (minimo 10)
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setIsEditingTranscript(false); setEditedTranscript(""); }}>
                    Annulla
                  </Button>
                  <Button 
                    onClick={handleSaveTranscript} 
                    disabled={savingTranscript || editedTranscript.trim().length < 10}
                  >
                    {savingTranscript ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Salva Trascrizione
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <ScrollArea className="h-[50vh] pr-4">
                <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg">
                  {previewTranscript}
                </pre>
              </ScrollArea>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => { setIsEditingTranscript(true); setEditedTranscript(previewTranscript); }}>
                  Modifica
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
