import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Youtube, ListVideo, Settings, Sparkles, Check, Loader2, AlertCircle, Play, Clock, ChevronRight, ChevronDown, Eye, FileText, Bookmark, Trash2, FolderOpen, Save, Edit, Plus, Download, Music, CheckCircle2, RefreshCw, XCircle, Layers, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  { id: 4.5, title: "Moduli", icon: Layers },
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

// Rileva automaticamente il tipo di link YouTube
function detectYouTubeType(url: string): { type: 'video' | 'playlist' | 'video_in_playlist' | 'invalid'; videoId?: string; playlistId?: string } {
  if (!url.trim()) return { type: 'invalid' };
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    
    // Supporta youtube.com e youtu.be
    if (!['youtube.com', 'youtu.be', 'm.youtube.com'].includes(hostname)) {
      return { type: 'invalid' };
    }
    
    const params = urlObj.searchParams;
    const videoId = params.get('v') || (hostname === 'youtu.be' ? urlObj.pathname.slice(1) : null);
    const playlistId = params.get('list');
    
    // Playlist pura (senza video specifico)
    if (urlObj.pathname === '/playlist' && playlistId) {
      return { type: 'playlist', playlistId };
    }
    
    // Video singolo in una playlist
    if (videoId && playlistId) {
      return { type: 'video_in_playlist', videoId, playlistId };
    }
    
    // Video singolo
    if (videoId) {
      return { type: 'video', videoId };
    }
    
    return { type: 'invalid' };
  } catch {
    return { type: 'invalid' };
  }
}

// 10 stili di scrittura AI selezionabili
const AI_WRITING_STYLES = [
  {
    id: "speaker-style",
    label: "Stile del Relatore",
    emoji: "🎤",
    shortDescription: "Mantiene tono ed espressioni originali",
    description: "L'AI mantiene il tono, le espressioni e lo stile comunicativo originale del relatore nel video. La lezione suonerà come se fosse scritta direttamente da chi parla.",
    instruction: `STILE E TONO:
- Mantieni ESATTAMENTE il tono, le espressioni e il modo di parlare del relatore
- Preserva il suo linguaggio autentico, i suoi modi di dire e le sue metafore
- Non parafrasare eccessivamente: la "voce" del relatore deve rimanere riconoscibile
- Se il relatore usa un linguaggio informale o colloquiale, mantienilo`
  },
  {
    id: "formal-academic",
    label: "Formale Accademico",
    emoji: "🎓",
    shortDescription: "Linguaggio formale e strutturato",
    description: "Usa un linguaggio formale, accademico e professionale. Ideale per contenuti che richiedono autorevolezza e precisione scientifica.",
    instruction: `STILE E TONO:
- Usa un linguaggio formale, preciso e professionale
- Evita espressioni colloquiali o informali
- Mantieni un tono autorevole e accademico
- Cita concetti in modo strutturato e rigoroso
- Usa terminologia tecnica appropriata quando necessario`
  },
  {
    id: "conversational",
    label: "Conversazionale",
    emoji: "💬",
    shortDescription: "Tono amichevole e accessibile",
    description: "Un tono caldo e amichevole, come se stessi parlando con un amico. Rende i contenuti più accessibili e meno intimidatori.",
    instruction: `STILE E TONO:
- Usa un tono caldo, amichevole e accessibile
- Parla direttamente al lettore usando il "tu"
- Inserisci frasi che creano connessione ("Lo so, anche io ci sono passato...")
- Evita il gergo tecnico quando possibile
- Rendi i concetti semplici e facili da comprendere`
  },
  {
    id: "storytelling",
    label: "Narrativo",
    emoji: "📖",
    shortDescription: "Racconta come una storia",
    description: "Trasforma il contenuto in una narrazione coinvolgente con personaggi, situazioni ed emozioni. Perfetto per catturare l'attenzione.",
    instruction: `STILE E TONO:
- Racconta il contenuto come una storia coinvolgente
- Crea un filo narrativo che guida il lettore
- Usa descrizioni vivide e dettagli evocativi
- Inserisci elementi di suspense e curiosità
- Concludi con una "morale" o insegnamento chiaro`
  },
  {
    id: "practical-how-to",
    label: "Guida Pratica",
    emoji: "🛠️",
    shortDescription: "Focus su azioni concrete step-by-step",
    description: "Una guida pratica orientata all'azione. Ogni sezione spiega cosa fare, come farlo e perché, con istruzioni chiare e immediate.",
    instruction: `STILE E TONO:
- Concentrati su azioni concrete e applicabili
- Ogni sezione deve rispondere a "Come faccio a..."
- Numera i passaggi in ordine logico
- Includi avvertenze, consigli e best practices
- Evita teoria eccessiva: vai dritto al punto pratico`
  },
  {
    id: "bullet-points",
    label: "Sintesi a Punti",
    emoji: "📋",
    shortDescription: "Elenchi puntati e concisione",
    description: "Contenuto essenziale organizzato in punti elenco. Massima chiarezza e facilità di lettura veloce.",
    instruction: `STILE E TONO:
- Usa principalmente elenchi puntati e numerati
- Ogni punto deve essere una frase concisa e autonoma
- Elimina parole superflue: vai all'essenziale
- Raggruppa i punti per categoria o tema
- Ideale per chi vuole ripassare rapidamente`
  },
  {
    id: "motivational",
    label: "Motivazionale",
    emoji: "🔥",
    shortDescription: "Ispira e motiva all'azione",
    description: "Un tono energico e ispirante che spinge il lettore all'azione. Ideale per contenuti di crescita personale e sviluppo.",
    instruction: `STILE E TONO:
- Usa un linguaggio energico, positivo e ispirante
- Inserisci frasi motivazionali e call-to-action forti
- Fai sentire il lettore capace di raggiungere i suoi obiettivi
- Sfida le credenze limitanti con domande potenti
- Concludi sempre con un invito all'azione immediata`
  },
  {
    id: "technical",
    label: "Tecnico Dettagliato",
    emoji: "⚙️",
    shortDescription: "Precisione tecnica e approfondimento",
    description: "Linguaggio tecnico preciso con definizioni, specifiche e dettagli approfonditi. Per un pubblico esperto del settore.",
    instruction: `STILE E TONO:
- Usa terminologia tecnica precisa e appropriata
- Definisci ogni termine specialistico alla prima occorrenza
- Includi dettagli, specifiche e approfondimenti
- Cita fonti o riferimenti quando pertinente
- Struttura il contenuto in modo logico e gerarchico`
  },
  {
    id: "minimalist",
    label: "Minimalista",
    emoji: "✨",
    shortDescription: "Solo l'essenziale, zero fronzoli",
    description: "Il minimo indispensabile. Ogni parola conta. Perfetto per chi preferisce contenuti diretti senza distrazioni.",
    instruction: `STILE E TONO:
- Riduci tutto all'essenziale assoluto
- Una frase = un concetto
- Elimina aggettivi, avverbi e parole di riempimento
- Nessuna ripetizione: ogni idea appare una sola volta
- Il silenzio (spazio bianco) è parte del messaggio`
  },
  {
    id: "interactive",
    label: "Interattivo",
    emoji: "🎯",
    shortDescription: "Coinvolge con domande e esercizi",
    description: "Coinvolge attivamente il lettore con domande, esercizi e momenti di riflessione. Trasforma la lettura in un'esperienza attiva.",
    instruction: `STILE E TONO:
- Inserisci domande dirette al lettore ogni 2-3 paragrafi
- Crea mini-esercizi o sfide da completare
- Aggiungi spazi di riflessione: "Fermati e pensa..."
- Usa il formato domanda-risposta dove appropriato
- Invita il lettore a prendere appunti o fare azioni`
  }
];

// Istruzioni base per la struttura della lezione
const BASE_STRUCTURE_INSTRUCTIONS = `
STRUTTURA DELLA LEZIONE:
- Organizza il contenuto in sezioni logiche con titoli chiari
- Inizia con un'introduzione che contestualizza l'argomento
- Sviluppa ogni concetto chiave in modo approfondito
- Concludi con un riepilogo dei punti principali

FORMATTAZIONE:
- Usa titoli e sottotitoli per strutturare il testo (## per sezioni, ### per sottosezioni)
- Evidenzia in grassetto i concetti chiave e le parole importanti
- Utilizza elenchi puntati per liste di elementi o passaggi`;

// Funzione per generare le istruzioni complete basate sullo stile selezionato
function buildAiInstructions(styleId: string, enhancements: string[]): string {
  const style = AI_WRITING_STYLES.find(s => s.id === styleId) || AI_WRITING_STYLES[0];
  let instructions = `Trasforma la trascrizione del video in una lezione formativa completa e coinvolgente.

${style.instruction}
${BASE_STRUCTURE_INSTRUCTIONS}`;

  // Aggiungi le enhancement selezionate
  enhancements.forEach(enhId => {
    const enh = AI_ENHANCEMENT_OPTIONS.find(e => e.id === enhId);
    if (enh) {
      instructions += enh.instruction;
    }
  });

  return instructions;
}

// Per retrocompatibilità
const BASE_AI_INSTRUCTIONS = buildAiInstructions('speaker-style', []);

// Aggiunte opzionali per migliorare le istruzioni AI
const AI_ENHANCEMENT_OPTIONS = [
  {
    id: "add-examples",
    label: "Aggiungi esempi pratici",
    description: "Crea esempi concreti usando il linguaggio del relatore",
    instruction: `
ESEMPI PRATICI:
- Aggiungi esempi pratici e concreti per ogni concetto importante
- Crea scenari realistici che il lettore può immaginare facilmente
- Usa lo stesso linguaggio e stile del relatore negli esempi
- Gli esempi devono essere applicabili nella vita quotidiana`
  },
  {
    id: "expand-concepts",
    label: "Espandi i concetti",
    description: "Approfondisce le idee chiave con più dettagli",
    instruction: `
ESPANSIONE DEI CONCETTI:
- Approfondisci ogni concetto chiave con spiegazioni dettagliate
- Aggiungi contesto e background dove necessario
- Spiega il "perché" dietro ogni idea, non solo il "cosa"
- Collega i concetti tra loro mostrando le relazioni`
  },
  {
    id: "lengthen-content",
    label: "Allunga il contenuto",
    description: "Rende la lezione più lunga e dettagliata",
    instruction: `
CONTENUTO ESTESO:
- Sviluppa ogni sezione in modo più completo e dettagliato
- Aggiungi introduzioni e transizioni tra le sezioni
- Includi riflessioni e approfondimenti aggiuntivi
- La lezione deve essere completa e approfondita`
  },
  {
    id: "key-points",
    label: "Box punti chiave",
    description: "Aggiunge riquadri con i concetti essenziali",
    instruction: `
PUNTI CHIAVE:
- Alla fine di ogni sezione, aggiungi un riquadro "Punti Chiave" con 3-5 bullet points
- I punti chiave devono essere concisi e memorizzabili
- Usa icone o emoji per rendere i punti più visivi
- Esempio: "📌 Punto chiave: [concetto in una frase]"`
  },
  {
    id: "action-steps",
    label: "Passi d'azione",
    description: "Aggiunge esercizi e azioni concrete da fare",
    instruction: `
PASSI D'AZIONE:
- Aggiungi una sezione "Cosa fare adesso" con azioni concrete
- Numera i passi in ordine di esecuzione
- Ogni passo deve essere specifico e realizzabile
- Includi suggerimenti su come iniziare subito`
  },
  {
    id: "reflection-questions",
    label: "Domande di riflessione",
    description: "Aggiunge domande per far riflettere il lettore",
    instruction: `
DOMANDE DI RIFLESSIONE:
- Inserisci domande stimolanti per far riflettere il lettore
- Le domande devono essere personali e applicabili alla vita del lettore
- Esempio: "Fermati un momento a pensare: quando ti è successo qualcosa di simile?"
- Aggiungi spazi di pausa per la riflessione personale`
  },
  {
    id: "summary-box",
    label: "Riepilogo finale",
    description: "Aggiunge un riassunto strutturato a fine lezione",
    instruction: `
RIEPILOGO FINALE:
- Alla fine della lezione, crea un riepilogo strutturato
- Elenca i 5-7 concetti più importanti appresi
- Aggiungi una frase motivazionale finale nello stile del relatore
- Il riepilogo deve permettere una rapida revisione della lezione`
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
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [detectedType, setDetectedType] = useState<ReturnType<typeof detectYouTubeType>>({ type: 'invalid' });
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [playlistVideos, setPlaylistVideos] = useState<PlaylistVideo[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [aiInstructions, setAiInstructions] = useState(BASE_AI_INSTRUCTIONS);
  const [selectedEnhancements, setSelectedEnhancements] = useState<string[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<string>("speaker-style");
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [hasUserEditedInstructions, setHasUserEditedInstructions] = useState(false);
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
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Step 4.5: Module organization states
  const [moduleAssignments, setModuleAssignments] = useState<Map<string, string>>(new Map());
  const [moduleCreationMode, setModuleCreationMode] = useState<'single' | 'multiple' | null>(null);
  const [newModulesCount, setNewModulesCount] = useState(2);
  const [newModuleNames, setNewModuleNames] = useState<string[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [isCreatingModules, setIsCreatingModules] = useState(false);
  const [newModuleName, setNewModuleName] = useState("");
  const [assignmentMode, setAssignmentMode] = useState<'single' | 'distribute'>('single');
  const [isSuggestingModules, setIsSuggestingModules] = useState(false);
  
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

  // Query per lezioni AI non pubblicate (bozze generate)
  const { data: unpublishedLessons = [], refetch: refetchUnpublishedLessons } = useQuery<any[]>({
    queryKey: ["/api/library/ai-unpublished-lessons"],
  });

  // Carica le lezioni non pubblicate quando si accede allo Step 5 o all'avvio
  useEffect(() => {
    if (unpublishedLessons.length > 0 && generatedLessons.length === 0) {
      setGeneratedLessons(unpublishedLessons);
      setLessonOrder(unpublishedLessons.map((l: any) => l.id));
    }
  }, [unpublishedLessons, generatedLessons.length]);

  useEffect(() => {
    if (aiSettings) {
      if (aiSettings.defaultContentType) setContentType(aiSettings.defaultContentType);
      if (aiSettings.defaultLevel) setLevel(aiSettings.defaultLevel);
      if (aiSettings.defaultStyle) setSelectedStyle(aiSettings.defaultStyle);
    }
  }, [aiSettings]);

  // Combina stile selezionato + aggiunte selezionate (solo se l'utente non ha modificato manualmente)
  useEffect(() => {
    if (!hasUserEditedInstructions) {
      const combinedInstructions = buildAiInstructions(selectedStyle, selectedEnhancements);
      setAiInstructions(combinedInstructions);
    }
  }, [selectedStyle, selectedEnhancements, hasUserEditedInstructions]);

  // Handler per ripristinare le istruzioni allo stile selezionato
  const handleResetInstructions = () => {
    const combinedInstructions = buildAiInstructions(selectedStyle, selectedEnhancements);
    setAiInstructions(combinedInstructions);
    setHasUserEditedInstructions(false);
  };

  // Handler per toggle enhancement
  const handleEnhancementToggle = (enhancementId: string, checked: boolean) => {
    setSelectedEnhancements(prev => {
      if (checked) {
        return [...prev, enhancementId];
      } else {
        return prev.filter(id => id !== enhancementId);
      }
    });
  };

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
    
    // Usa il tipo rilevato automaticamente
    if (detectedType.type === 'video') {
      fetchVideoMutation.mutate(youtubeUrl);
    } else if (detectedType.type === 'playlist' || detectedType.type === 'video_in_playlist') {
      fetchPlaylistMutation.mutate(youtubeUrl);
    } else {
      toast({ title: "Link non valido", description: "Inserisci un link YouTube valido", variant: "destructive" });
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
    
    addLog(`Sto preparando ${selected.length} video...`, 'info');
    
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
              addLog(`Sto scaricando: "${data.title}"`, 'info');
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
              addLog(`Sto analizzando l'audio: "${data.title}"`, 'info');
              setSavingVideoStatuses(prev => {
                const next = new Map(prev);
                next.set(data.videoId, { status: 'transcribing', message: data.message || 'Estraendo trascrizione...' });
                return next;
              });
            } else if (data.type === 'reused') {
              addLog(`♻️ Già analizzato in precedenza: "${data.title}"`, 'success');
              setSavingVideoStatuses(prev => {
                const next = new Map(prev);
                next.set(data.videoId, { status: 'reused', message: 'Trascrizione riutilizzata' });
                return next;
              });
            } else if (data.type === 'completed') {
              addLog(`✅ Pronto: "${data.title}"`, 'success');
              setSavingVideoStatuses(prev => {
                const next = new Map(prev);
                next.set(data.videoId, { status: 'completed', message: data.transcriptLength ? `${data.transcriptLength} caratteri` : 'Completato' });
                return next;
              });
            } else if (data.type === 'error') {
              addLog(`❌ Problema con "${data.title}": ${data.error}`, 'error');
              setSavingVideoStatuses(prev => {
                const next = new Map(prev);
                next.set(data.videoId, { status: 'error', message: data.error });
                return next;
              });
            } else if (data.type === 'progress') {
              setSavingVideoProgress(Math.round((data.current / data.total) * 100));
            } else if (data.type === 'done') {
              savedVideosList = data.savedVideos || [];
              addLog(`🎉 Fatto! ${savedVideosList.length} video pronti per la lezione`, 'success');
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
        inputType: detectedType.type === 'playlist' || detectedType.type === 'video_in_playlist' ? 'playlist' : 'video',
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
    const url = draft.youtubeUrl || "";
    setYoutubeUrl(url);
    setDetectedType(detectYouTubeType(url));
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
    setGenerationLogs([{
      time: new Date().toLocaleTimeString('it-IT'),
      message: "🚀 Sto iniziando a creare le lezioni..."
    }]);
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
          defaultStyle: selectedStyle,
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
              toast({ title: "Lezioni generate!", description: `${data.lessons.length} lezioni create - Clicca per procedere al riepilogo` });
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

  const handlePublishLessons = async () => {
    if (generatedLessons.length === 0) {
      toast({ title: "Nessuna lezione da pubblicare", variant: "destructive" });
      return;
    }

    setIsPublishing(true);
    try {
      const lessonIds = generatedLessons.map((l: any) => l.id);
      
      // Convert Map to object for API
      const moduleAssignmentsObj: Record<string, string> = {};
      moduleAssignments.forEach((subcategoryId, lessonId) => {
        moduleAssignmentsObj[lessonId] = subcategoryId;
      });
      
      await apiRequest("POST", "/api/library/ai-publish-lessons", { 
        lessonIds,
        moduleAssignments: Object.keys(moduleAssignmentsObj).length > 0 ? moduleAssignmentsObj : undefined
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/library/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/library/ai-unpublished-lessons"] });
      
      // Reset stato locale
      setGeneratedLessons([]);
      setLessonOrder([]);
      setModuleAssignments(new Map());
      setModuleCreationMode(null);
      setNewModuleNames([]);
      setSelectedModuleId("");
      
      toast({ 
        title: "Lezioni pubblicate!", 
        description: `${lessonIds.length} lezioni sono state aggiunte al corso` 
      });
      
      // Naviga alla libreria
      setLocation("/consultant/library");
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setIsPublishing(false);
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
                    <CardTitle className="flex items-center gap-2">
                      <Youtube className="w-5 h-5 text-red-500" />
                      Inserisci Link YouTube
                    </CardTitle>
                    <CardDescription>Incolla un link e verrà rilevato automaticamente</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Link YouTube</Label>
                      <div className="relative">
                        <Input
                          placeholder="https://youtube.com/watch?v=... o playlist?list=..."
                          value={youtubeUrl}
                          onChange={(e) => {
                            setYoutubeUrl(e.target.value);
                            setDetectedType(detectYouTubeType(e.target.value));
                          }}
                          className={`pr-24 ${
                            youtubeUrl && detectedType.type === 'invalid' 
                              ? 'border-red-300 focus:border-red-500' 
                              : youtubeUrl && detectedType.type !== 'invalid'
                              ? 'border-green-300 focus:border-green-500'
                              : ''
                          }`}
                        />
                        {youtubeUrl && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            {detectedType.type === 'video' && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                <Play className="w-3 h-3 mr-1" />
                                Video
                              </Badge>
                            )}
                            {(detectedType.type === 'playlist' || detectedType.type === 'video_in_playlist') && (
                              <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                                <ListVideo className="w-3 h-3 mr-1" />
                                Playlist
                              </Badge>
                            )}
                            {detectedType.type === 'invalid' && (
                              <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Non valido
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      {detectedType.type === 'video_in_playlist' && (
                        <p className="text-xs text-purple-600 dark:text-purple-400">
                          Rilevato video in playlist - verranno caricati tutti i video della playlist
                        </p>
                      )}
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
                      disabled={isLoading || !youtubeUrl || !selectedCategoryId || detectedType.type === 'invalid'}
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
                      {detectedType.type === 'video' && <Play className="w-5 h-5 text-blue-500" />}
                      {(detectedType.type === 'playlist' || detectedType.type === 'video_in_playlist') && <ListVideo className="w-5 h-5 text-purple-500" />}
                      {(detectedType.type === 'invalid' || !youtubeUrl) && <Youtube className="w-5 h-5 text-red-500" />}
                      {detectedType.type === 'video' ? 'Video Singolo' : 
                       detectedType.type === 'playlist' ? 'Playlist' :
                       detectedType.type === 'video_in_playlist' ? 'Video in Playlist' : 'Anteprima'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center min-h-[200px] gap-4">
                    {!youtubeUrl ? (
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto">
                          <Youtube className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-muted-foreground">
                          Inserisci un link YouTube per iniziare
                        </p>
                      </div>
                    ) : detectedType.type === 'invalid' ? (
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                          <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <div>
                          <p className="font-medium text-red-600 dark:text-red-400">Link non valido</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Inserisci un link YouTube valido come:<br/>
                            youtube.com/watch?v=... o youtube.com/playlist?list=...
                          </p>
                        </div>
                      </div>
                    ) : detectedType.type === 'video' ? (
                      <div className="text-center space-y-4 w-full">
                        <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto">
                          <Play className="w-8 h-8 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-blue-600 dark:text-blue-400">Video singolo rilevato</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Verrà creata una lezione da questo video
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-4 w-full">
                        <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto">
                          <ListVideo className="w-8 h-8 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium text-purple-600 dark:text-purple-400">Playlist rilevata</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Potrai selezionare i video da trasformare in lezioni
                          </p>
                        </div>
                      </div>
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
                    <CardDescription>Configura come l'AI trasformerà il video in lezione</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Stile di scrittura</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowAllStyles(!showAllStyles)}
                          className="text-xs"
                        >
                          {showAllStyles ? "Mostra meno" : "Mostra tutti"}
                          <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${showAllStyles ? 'rotate-180' : ''}`} />
                        </Button>
                      </div>
                      
                      <div className={`grid gap-2 ${showAllStyles ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-5'}`}>
                        {(showAllStyles ? AI_WRITING_STYLES : AI_WRITING_STYLES.slice(0, 5)).map((style) => (
                          <div
                            key={style.id}
                            onClick={() => setSelectedStyle(style.id)}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                              selectedStyle === style.id
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 shadow-sm'
                                : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                            }`}
                          >
                            <div className="text-center">
                              <span className="text-2xl">{style.emoji}</span>
                              <p className="text-sm font-medium mt-1">{style.label}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {selectedStyle && (
                        <div className="p-4 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-800 mt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">{AI_WRITING_STYLES.find(s => s.id === selectedStyle)?.emoji}</span>
                            <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                              {AI_WRITING_STYLES.find(s => s.id === selectedStyle)?.label}
                            </h3>
                          </div>
                          <p className="text-sm text-purple-700 dark:text-purple-300">
                            {AI_WRITING_STYLES.find(s => s.id === selectedStyle)?.description}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label className="text-base font-semibold">Aggiunte opzionali</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Seleziona gli elementi extra che vuoi aggiungere alla lezione
                      </p>
                      <div className="grid gap-3">
                        {AI_ENHANCEMENT_OPTIONS.map((enhancement) => (
                          <div 
                            key={enhancement.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                              selectedEnhancements.includes(enhancement.id) 
                                ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700' 
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                            }`}
                            onClick={() => handleEnhancementToggle(enhancement.id, !selectedEnhancements.includes(enhancement.id))}
                          >
                            <Checkbox 
                              id={enhancement.id}
                              checked={selectedEnhancements.includes(enhancement.id)}
                              onClick={(e) => e.stopPropagation()}
                              onCheckedChange={(checked) => handleEnhancementToggle(enhancement.id, !!checked)}
                              className="mt-0.5"
                            />
                            <div className="flex-1" onClick={(e) => e.stopPropagation()}>
                              <label htmlFor={enhancement.id} className="font-medium cursor-pointer">
                                {enhancement.label}
                              </label>
                              <p className="text-sm text-muted-foreground">{enhancement.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <Label>Istruzioni AI (anteprima)</Label>
                        <div className="flex items-center gap-2">
                          {hasUserEditedInstructions && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={handleResetInstructions}
                              className="text-xs h-6"
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Ripristina
                            </Button>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {selectedEnhancements.length} aggiunte attive
                          </Badge>
                        </div>
                      </div>
                      <Textarea
                        rows={12}
                        value={aiInstructions}
                        onChange={(e) => {
                          setAiInstructions(e.target.value);
                          setHasUserEditedInstructions(true);
                        }}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        {hasUserEditedInstructions 
                          ? "Hai modificato le istruzioni. Clicca 'Ripristina' per tornare allo stile selezionato."
                          : "Le istruzioni si aggiornano automaticamente. Puoi modificarle manualmente se necessario."}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Formato lezione</Label>
                        <Select value={contentType} onValueChange={(v: any) => setContentType(v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="both">Testo + Video</SelectItem>
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
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <Label className="text-sm">Salva come predefinite</Label>
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
                      <Button variant="outline" onClick={() => setCurrentStep(savedVideos.length > 1 ? 2 : 1)}>
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

                  {generationProgress >= 100 && !isGenerating && (
                    <div className="flex flex-col items-center gap-4 pt-4 border-t">
                      <div className="text-center">
                        <p className="text-green-600 font-medium">
                          Generazione completata!
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedSubcategoryId 
                            ? "Le lezioni sono pronte per la revisione. Clicca per proseguire al riepilogo."
                            : "Ora organizza le lezioni nei moduli del corso."}
                        </p>
                      </div>
                      <Button 
                        onClick={() => {
                          if (selectedSubcategoryId) {
                            // Skip module organization if subcategory already selected
                            const assignments = new Map<string, string>();
                            generatedLessons.forEach((lesson: any) => {
                              assignments.set(lesson.id, selectedSubcategoryId);
                            });
                            setModuleAssignments(assignments);
                            setCurrentStep(5);
                          } else {
                            // Go to module organization step
                            setCurrentStep(4.5);
                          }
                        }}
                        className="bg-gradient-to-r from-green-600 to-emerald-600"
                        size="lg"
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        {selectedSubcategoryId ? "Vai al Riepilogo" : "Organizza Moduli"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {currentStep === 4.5 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-purple-500" />
                    Organizza Moduli
                  </CardTitle>
                  <CardDescription>
                    Assegna le {generatedLessons.length} lezioni generate ai moduli del corso "{categories.find(c => c.id === selectedCategoryId)?.name}"
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Generated lessons preview */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Lezioni Generate</Label>
                    <div className="grid gap-2 max-h-[200px] overflow-y-auto">
                      {generatedLessons.map((lesson: any, idx: number) => {
                        const sourceVideo = savedVideos.find(v => v.id === lesson.youtubeVideoId || v.videoId === lesson.youtubeVideoId);
                        return (
                          <div key={lesson.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold text-xs">
                              {idx + 1}
                            </div>
                            {sourceVideo?.thumbnailUrl && (
                              <img src={sourceVideo.thumbnailUrl} alt={lesson.title} className="w-12 h-7 object-cover rounded" />
                            )}
                            <span className="text-sm font-medium truncate flex-1">{lesson.title}</span>
                            {assignmentMode === 'distribute' && moduleAssignments.get(lesson.id) && (
                              <Badge variant="secondary" className="text-xs">
                                {filteredSubcategories.find(s => s.id === moduleAssignments.get(lesson.id))?.name || 'Assegnato'}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Scenario A: No existing modules */}
                  {filteredSubcategories.length === 0 && (
                    <div className="space-y-6 p-4 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        <h3 className="font-semibold text-purple-900 dark:text-purple-100">Crea Nuovi Moduli</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Non ci sono moduli per questo corso. Crea uno o più moduli per organizzare le lezioni.
                      </p>
                      
                      <RadioGroup 
                        value={moduleCreationMode || ''} 
                        onValueChange={(v) => {
                          setModuleCreationMode(v as 'single' | 'multiple');
                          if (v === 'single') {
                            setNewModuleNames(['Modulo 1']);
                            setNewModulesCount(1);
                          } else {
                            const names = Array.from({ length: newModulesCount }, (_, i) => `Modulo ${i + 1}`);
                            setNewModuleNames(names);
                          }
                        }}
                        className="space-y-3"
                      >
                        <div className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${moduleCreationMode === 'single' ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                          <RadioGroupItem value="single" id="single" />
                          <Label htmlFor="single" className="cursor-pointer flex-1">
                            <span className="font-medium">Un singolo modulo</span>
                            <p className="text-sm text-muted-foreground">Tutte le lezioni saranno in un unico modulo</p>
                          </Label>
                        </div>
                        <div className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${moduleCreationMode === 'multiple' ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                          <RadioGroupItem value="multiple" id="multiple" />
                          <Label htmlFor="multiple" className="cursor-pointer flex-1">
                            <span className="font-medium">Più moduli</span>
                            <p className="text-sm text-muted-foreground">Crea più moduli per organizzare meglio le lezioni</p>
                          </Label>
                        </div>
                      </RadioGroup>

                      {moduleCreationMode === 'multiple' && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Label>Numero di moduli:</Label>
                            <Input 
                              type="number" 
                              min={2} 
                              max={10} 
                              value={newModulesCount}
                              onChange={(e) => {
                                const count = Math.min(10, Math.max(2, parseInt(e.target.value) || 2));
                                setNewModulesCount(count);
                                const names = Array.from({ length: count }, (_, i) => newModuleNames[i] || `Modulo ${i + 1}`);
                                setNewModuleNames(names);
                              }}
                              className="w-20"
                            />
                          </div>
                        </div>
                      )}

                      {moduleCreationMode && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-base font-semibold">Nomi dei moduli</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isSuggestingModules}
                              onClick={async () => {
                                if (isSuggestingModules) return;
                                setIsSuggestingModules(true);
                                try {
                                  const videoTitles = savedVideos.map(v => v.title);
                                  const courseName = categories.find((c: Category) => c.id === selectedCategoryId)?.name;
                                  const result = await apiRequest("POST", "/api/library/ai-suggest-modules", {
                                    videoTitles,
                                    moduleCount: newModuleNames.length,
                                    courseName,
                                  });
                                  if (result.names && result.names.length > 0) {
                                    setNewModuleNames(result.names);
                                    toast({ 
                                      title: result.aiGenerated ? "Nomi suggeriti dall'AI" : "Nomi generati",
                                      description: result.aiGenerated ? "Puoi modificarli se vuoi" : "Suggerimenti generici",
                                    });
                                  }
                                } catch (error: any) {
                                  toast({ title: "Errore", description: error.message, variant: "destructive" });
                                } finally {
                                  setIsSuggestingModules(false);
                                }
                              }}
                              className="flex items-center gap-1"
                            >
                              {isSuggestingModules ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Sparkles className="w-4 h-4" />
                              )}
                              {isSuggestingModules ? "Sto pensando..." : "Suggerisci con AI"}
                            </Button>
                          </div>
                          <div className="grid gap-2">
                            {newModuleNames.map((name, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground w-8">#{idx + 1}</span>
                                <Input 
                                  value={name}
                                  onChange={(e) => {
                                    const updated = [...newModuleNames];
                                    updated[idx] = e.target.value;
                                    setNewModuleNames(updated);
                                  }}
                                  placeholder={`Nome modulo ${idx + 1}`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {moduleCreationMode && (
                        <Button 
                          onClick={async () => {
                            if (newModuleNames.length === 0 || newModuleNames.some(n => !n.trim())) {
                              toast({ title: "Inserisci i nomi dei moduli", variant: "destructive" });
                              return;
                            }
                            setIsCreatingModules(true);
                            try {
                              const createdModules: Subcategory[] = [];
                              for (const moduleName of newModuleNames) {
                                const result = await apiRequest("POST", "/api/library/subcategories", {
                                  categoryId: selectedCategoryId,
                                  name: moduleName.trim()
                                });
                                createdModules.push(result);
                              }
                              queryClient.invalidateQueries({ queryKey: ["/api/library/subcategories"] });
                              
                              // Assign all lessons to first module if single, or let user choose if multiple
                              if (createdModules.length === 1) {
                                const assignments = new Map<string, string>();
                                generatedLessons.forEach((lesson: any) => {
                                  assignments.set(lesson.id, createdModules[0].id);
                                });
                                setModuleAssignments(assignments);
                                toast({ title: "Modulo creato!", description: `"${createdModules[0].name}" creato con successo` });
                                setCurrentStep(5);
                              } else {
                                toast({ title: "Moduli creati!", description: `${createdModules.length} moduli creati. Ora assegna le lezioni.` });
                                setAssignmentMode('distribute');
                              }
                            } catch (error: any) {
                              toast({ title: "Errore", description: error.message, variant: "destructive" });
                            }
                            setIsCreatingModules(false);
                          }}
                          disabled={isCreatingModules || !moduleCreationMode}
                          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600"
                        >
                          {isCreatingModules ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4 mr-2" />
                          )}
                          Crea {moduleCreationMode === 'single' ? 'Modulo' : `${newModulesCount} Moduli`}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Scenario B: Existing modules */}
                  {filteredSubcategories.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-base font-semibold">Moduli Esistenti</Label>
                        <Badge variant="secondary">{filteredSubcategories.length} moduli</Badge>
                      </div>

                      {/* Assignment mode selection */}
                      <RadioGroup 
                        value={assignmentMode} 
                        onValueChange={(v) => {
                          setAssignmentMode(v as 'single' | 'distribute');
                          if (v === 'single') {
                            setModuleAssignments(new Map());
                          }
                        }}
                        className="space-y-2"
                      >
                        <div className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${assignmentMode === 'single' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                          <RadioGroupItem value="single" id="mode-single" />
                          <Label htmlFor="mode-single" className="cursor-pointer">
                            <span className="font-medium">Tutte in un modulo</span>
                            <span className="text-sm text-muted-foreground ml-2">— Inserisci tutte le lezioni nello stesso modulo</span>
                          </Label>
                        </div>
                        <div className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${assignmentMode === 'distribute' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                          <RadioGroupItem value="distribute" id="mode-distribute" />
                          <Label htmlFor="mode-distribute" className="cursor-pointer">
                            <span className="font-medium">Distribuisci tra moduli</span>
                            <span className="text-sm text-muted-foreground ml-2">— Assegna ogni lezione a un modulo specifico</span>
                          </Label>
                        </div>
                      </RadioGroup>

                      {/* Single module selection */}
                      {assignmentMode === 'single' && (
                        <div className="space-y-3">
                          {moduleAssignments.size === 0 ? (
                            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium flex items-center gap-2">
                              <AlertCircle className="w-4 h-4" />
                              Seleziona un modulo per continuare
                            </p>
                          ) : (
                            <p className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
                              <Check className="w-4 h-4" />
                              Modulo selezionato
                            </p>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {filteredSubcategories.map((sub) => (
                            <Card 
                              key={sub.id}
                              className={`cursor-pointer transition-all hover:shadow-md ${
                                selectedModuleId === sub.id 
                                  ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-950/20' 
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                              }`}
                              onClick={() => {
                                setSelectedModuleId(sub.id);
                                const assignments = new Map<string, string>();
                                generatedLessons.forEach((lesson: any) => {
                                  assignments.set(lesson.id, sub.id);
                                });
                                setModuleAssignments(assignments);
                              }}
                            >
                              <CardContent className="p-4 flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  selectedModuleId === sub.id 
                                    ? 'bg-purple-500 text-white' 
                                    : 'bg-gray-100 dark:bg-gray-800'
                                }`}>
                                  <Layers className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{sub.name}</p>
                                </div>
                                {selectedModuleId === sub.id && (
                                  <Check className="w-5 h-5 text-purple-500" />
                                )}
                              </CardContent>
                            </Card>
                          ))}
                          </div>
                        </div>
                      )}

                      {/* Distribute lessons among modules */}
                      {assignmentMode === 'distribute' && (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Seleziona un modulo per ogni lezione:
                          </p>
                          <div className="space-y-2">
                            {generatedLessons.map((lesson: any, idx: number) => (
                              <div key={lesson.id} className="flex items-center gap-3 p-3 rounded-lg border">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold text-xs">
                                  {idx + 1}
                                </div>
                                <span className="text-sm font-medium flex-1 truncate">{lesson.title}</span>
                                <Select 
                                  value={moduleAssignments.get(lesson.id) || ''} 
                                  onValueChange={(v) => {
                                    setModuleAssignments(prev => {
                                      const next = new Map(prev);
                                      next.set(lesson.id, v);
                                      return next;
                                    });
                                  }}
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Seleziona modulo" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {filteredSubcategories.map((sub) => (
                                      <SelectItem key={sub.id} value={sub.id}>
                                        {sub.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add new module inline */}
                      <div className="p-4 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                          <Plus className="w-5 h-5 text-muted-foreground" />
                          <Input 
                            value={newModuleName}
                            onChange={(e) => setNewModuleName(e.target.value)}
                            placeholder="Aggiungi nuovo modulo..."
                            className="flex-1"
                          />
                          <Button 
                            variant="outline"
                            onClick={async () => {
                              if (!newModuleName.trim()) {
                                toast({ title: "Inserisci un nome per il modulo", variant: "destructive" });
                                return;
                              }
                              setIsCreatingModules(true);
                              try {
                                await apiRequest("POST", "/api/library/subcategories", {
                                  categoryId: selectedCategoryId,
                                  name: newModuleName.trim()
                                });
                                queryClient.invalidateQueries({ queryKey: ["/api/library/subcategories"] });
                                setNewModuleName("");
                                toast({ title: "Modulo creato!", description: `"${newModuleName}" aggiunto` });
                              } catch (error: any) {
                                toast({ title: "Errore", description: error.message, variant: "destructive" });
                              }
                              setIsCreatingModules(false);
                            }}
                            disabled={isCreatingModules || !newModuleName.trim()}
                          >
                            {isCreatingModules ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aggiungi"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Navigation buttons */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <Button variant="outline" onClick={() => setCurrentStep(4)}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Indietro
                    </Button>
                    <Button 
                      onClick={() => {
                        // Validate assignments
                        if (moduleAssignments.size === 0) {
                          toast({ title: "Seleziona un modulo", description: "Devi assegnare le lezioni a un modulo", variant: "destructive" });
                          return;
                        }
                        if (assignmentMode === 'distribute') {
                          const allAssigned = generatedLessons.every((lesson: any) => moduleAssignments.has(lesson.id));
                          if (!allAssigned) {
                            toast({ title: "Assegnazioni incomplete", description: "Assegna tutte le lezioni a un modulo", variant: "destructive" });
                            return;
                          }
                        }
                        setCurrentStep(5);
                      }}
                      disabled={moduleAssignments.size === 0}
                      className="bg-gradient-to-r from-purple-600 to-indigo-600"
                    >
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Continua al Riepilogo
                    </Button>
                  </div>
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
                      {generatedLessons.length} lezioni pronte per l'inserimento. Clicca su una lezione per vedere l'anteprima, poi conferma per aggiungerle al corso.
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
                        onClick={handlePublishLessons}
                        disabled={isPublishing || generatedLessons.length === 0}
                        className="bg-gradient-to-r from-green-600 to-emerald-600"
                      >
                        {isPublishing ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        {isPublishing ? 'Pubblicazione...' : `Conferma e Inserisci ${generatedLessons.length} Lezioni`}
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
