import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { analyzeAdText, generateImageConcept } from './services/geminiService';
import { AdAnalysis, GeneratedImage, VisualConcept, AppSettings, PostInput, SocialPlatform } from './types';
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sun,
  Moon,
  Settings,
  Plus,
  Trash2,
  Download,
  Upload,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  CloudUpload,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Zap,
  X,
  Instagram,
  Linkedin,
  Facebook,
  Twitter,
  ChevronRight,
  AlertCircle,
  Layers,
  Calendar,
} from "lucide-react";

interface ContentPost {
  id: string;
  title?: string;
  hook?: string;
  body?: string;
  cta?: string;
  fullCopy?: string;
  platform?: string;
  status?: string;
  copyType?: string;
  mediaType?: string;
  createdAt?: string;
  scheduledDate?: string;
  publerMediaIds?: (string | { id: string; path?: string; thumbnail?: string })[];
  structuredContent?: {
    hook?: string;
    body?: string;
    cta?: string;
    chiCosaCome?: string;
    errore?: string;
    soluzione?: string;
    riprovaSociale?: string;
  };
}

const AdVisagePage: React.FC = () => {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [postInputs, setPostInputs] = useState<PostInput[]>(() => {
    const saved = localStorage.getItem('advisage_infinite_v3');
    return saved ? JSON.parse(saved) : [{ id: 'init-1', text: '', platform: 'instagram' }];
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('advisage_theme');
    return (saved as 'dark' | 'light') || 'dark';
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('advisage_settings_v3');
    return saved ? JSON.parse(saved) : {
      mood: 'professional',
      stylePreference: 'realistic',
      brandColor: '#6366f1',
      brandFont: 'Inter',
      manualApiKey: '',
      externalSourceUrl: ''
    };
  });
  
  const [batchResults, setBatchResults] = useState<AdAnalysis[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [isBatchRendering, setIsBatchRendering] = useState(false);
  const [isFetchingFromSource, setIsFetchingFromSource] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [variantToggle, setVariantToggle] = useState<Record<string, 'clean' | 'text'>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'factory' | 'pitch'>('factory');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showPublerDialog, setShowPublerDialog] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<{ url: string; conceptId: string; sourcePostId?: string; sourcePostTitle?: string } | null>(null);
  const [isUploadingToPubler, setIsUploadingToPubler] = useState(false);
  const [selectedPostForMedia, setSelectedPostForMedia] = useState<string | null>(null);
  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);

  const { data: postsData, isLoading: isLoadingPosts } = useQuery({
    queryKey: ['/api/content/posts'],
    queryFn: async () => {
      const response = await fetch('/api/content/posts', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch posts');
      return response.json();
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: async ({ postId, publerMediaIds }: { postId: string; publerMediaIds: Array<{ id: string; path?: string; thumbnail?: string }> }) => {
      const response = await fetch(`/api/content/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ publerMediaIds }),
      });
      if (!response.ok) throw new Error('Failed to update post');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/content/posts'] });
      toast({
        title: "Media associato",
        description: "L'immagine è stata associata al post con successo",
      });
    },
  });

  const existingPosts = postsData?.data || [];

  useEffect(() => {
    localStorage.setItem('advisage_infinite_v3', JSON.stringify(postInputs));
    localStorage.setItem('advisage_settings_v3', JSON.stringify(settings));
    localStorage.setItem('advisage_theme', theme);
  }, [postInputs, settings, theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const addPostInput = () => setPostInputs([...postInputs, { id: Math.random().toString(36).substr(2, 9), text: '', platform: 'instagram' }]);
  
  const updatePost = (id: string, updates: Partial<PostInput>) => setPostInputs(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

  const removePostInput = (id: string) => {
    if (postInputs.length > 1) {
      setPostInputs(prev => prev.filter(p => p.id !== id));
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'advisage-export.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPostFullCopy = (post: ContentPost): string => {
    // Prioritizza fullCopy se presente (è il testo completo del post)
    if (post.fullCopy) {
      return post.fullCopy;
    }
    // Fallback: componi dai campi strutturati
    const content = post.structuredContent || {};
    const parts = [
      content.hook || post.hook,
      content.chiCosaCome,
      content.errore,
      content.soluzione,
      content.riprovaSociale,
      content.body || post.body,
      content.cta || post.cta,
    ].filter(Boolean);
    return parts.join('\n\n');
  };

  const importFromPost = (post: ContentPost) => {
    const fullCopy = getPostFullCopy(post);
    const platform = (post.platform || 'instagram') as SocialPlatform;
    
    // AGGIUNGE alla lista esistente con COLLEGAMENTO al post originale
    setPostInputs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        text: fullCopy,
        platform,
        sourcePostId: post.id,  // Mantiene il collegamento
        sourcePostTitle: post.title || 'Post senza titolo',
        sourceScheduledDate: post.scheduledDate || post.scheduledAt || undefined,
        sourceStatus: post.status || 'draft',
        sourceMediaType: post.mediaType || undefined,
      }
    ]);
    // Non chiude il dialog - permette selezione multipla
  };

  const fetchFromExternalSource = async () => {
    if (!settings.externalSourceUrl) {
      setError("Inserisci l'URL del tuo generatore nelle impostazioni.");
      setShowSettings(true);
      return;
    }
    setIsFetchingFromSource(true);
    setError(null);
    try {
      const response = await fetch(settings.externalSourceUrl);
      if (!response.ok) throw new Error("Impossibile connettersi al generatore.");
      const data = await response.json();
      const newPosts: PostInput[] = data.map((item: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        text: typeof item === 'string' ? item : (item.text || item.copy || ""),
        platform: item.platform || 'instagram'
      }));
      if (newPosts.length > 0) setPostInputs(newPosts);
    } catch (err: any) {
      setError("Errore nel recupero dati: " + err.message);
    } finally {
      setIsFetchingFromSource(false);
    }
  };

  const handleStartBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = postInputs.filter(p => p.text.trim().length > 5);
    if (!valid.length) return setError("Inserisci dei testi validi nella coda.");
    
    setIsProcessingBatch(true);
    setError(null);
    try {
      const results: AdAnalysis[] = [];
      const newPrompts = { ...customPrompts };
      for (const post of valid) {
        const result = await analyzeAdText(post.text, post.platform, settings);
        // Mantiene il collegamento al post originale
        result.sourcePostId = post.sourcePostId;
        result.sourcePostTitle = post.sourcePostTitle;
        results.push(result);
        result.concepts.forEach(c => {
          newPrompts[`${c.id}_text`] = c.promptWithText;
          newPrompts[`${c.id}_clean`] = c.promptClean;
        });
      }
      setBatchResults(results);
      setCustomPrompts(newPrompts);
      setActivePostId(results[0].id);
    } catch (err: any) { 
      setError(err.message); 
    } finally { 
      setIsProcessingBatch(false); 
    }
  };

  const handleGenerateOne = async (concept: VisualConcept, variantOverride?: 'clean' | 'text') => {
    if (generatingIds.has(concept.id)) return;
    const variant = variantOverride || variantToggle[concept.id] || 'text';
    setGeneratingIds(prev => new Set(prev).add(concept.id));
    try {
      const ratioMap: any = { "1:1": "1:1", "4:5": "3:4", "9:16": "9:16" };
      const url = await generateImageConcept(customPrompts[`${concept.id}_${variant}`], ratioMap[concept.recommendedFormat], settings);
      setGeneratedImages(prev => [{ conceptId: concept.id, imageUrl: url, variant, timestamp: Date.now() }, ...prev]);
    } catch (err: any) { 
      setError(err.message); 
    } finally { 
      setGeneratingIds(prev => { const n = new Set(prev); n.delete(concept.id); return n; }); 
    }
  };

  const handleBatchGenerateFirstImages = async () => {
    if (isBatchRendering || !batchResults.length) return;
    setIsBatchRendering(true);
    try {
      // Filtra i concept che non hanno già un'immagine generata
      const conceptsToGenerate = batchResults
        .map(result => result.concepts[0])
        .filter(concept => !generatedImages.some(img => img.conceptId === concept.id));
      
      // Genera tutte le immagini in parallelo
      await Promise.all(
        conceptsToGenerate.map(concept => handleGenerateOne(concept, 'text'))
      );
    } catch (err: any) {
      setError("Errore durante il rendering batch: " + err.message);
    } finally {
      setIsBatchRendering(false);
    }
  };

  const base64ToBlob = (base64: string): Blob => {
    const parts = base64.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const handleUploadToPubler = async (imageUrl: string, conceptId: string) => {
    // Trova il post attivo per ottenere il sourcePostId
    const sourcePostId = activePost?.sourcePostId;
    const sourcePostTitle = activePost?.sourcePostTitle;
    
    setUploadingImage({ url: imageUrl, conceptId, sourcePostId, sourcePostTitle });
    
    // Se c'è un sourcePostId, pre-seleziona quel post
    if (sourcePostId) {
      setSelectedPostForMedia(sourcePostId);
    }
    
    setShowPublerDialog(true);
  };

  const executePublerUpload = async () => {
    if (!uploadingImage) return;
    
    setIsUploadingToPubler(true);
    try {
      const blob = base64ToBlob(uploadingImage.url);
      const formData = new FormData();
      formData.append('files', blob, `advisage-${uploadingImage.conceptId}-${Date.now()}.png`);

      const response = await fetch('/api/publer/upload-media', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore caricamento');
      }

      const result = await response.json();
      
      if (result.success && result.media && result.media.length > 0) {
        const uploadedMediaItem = result.media[0];
        const mediaObject = {
          id: uploadedMediaItem.id,
          path: uploadedMediaItem.path,
          thumbnail: uploadedMediaItem.thumbnail,
        };
        
        if (selectedPostForMedia) {
          const post = existingPosts.find((p: ContentPost) => p.id === selectedPostForMedia);
          const currentMediaIds = post?.publerMediaIds || [];
          
          // Per post non-carosello, limitare a 1 sola immagine
          const isCarousel = post?.mediaType === 'carosello' || post?.mediaType === 'carousel';
          
          let newMediaIds: Array<{ id: string; path?: string; thumbnail?: string }>;
          
          if (isCarousel) {
            // Carosello: aggiungi all'array esistente
            const existingMediaObjects = currentMediaIds.map((m: any) => 
              typeof m === 'string' ? { id: m } : { id: m.id, path: m.path, thumbnail: m.thumbnail }
            );
            newMediaIds = [...existingMediaObjects, mediaObject];
          } else {
            // Non-carosello: sostituisci con la nuova immagine
            newMediaIds = [mediaObject];
          }
          
          await updatePostMutation.mutateAsync({
            postId: selectedPostForMedia,
            publerMediaIds: newMediaIds,
          });
        }

        // Invalida la cache dei post per ricaricare i dati aggiornati
        queryClient.invalidateQueries({ queryKey: ['/api/content/posts'] });
        
        toast({
          title: "Caricato su Publer",
          description: selectedPostForMedia 
            ? `Immagine associata al post con successo` 
            : `Media ID: ${mediaObject.id}`,
        });
        
        setShowPublerDialog(false);
        setUploadingImage(null);
        setSelectedPostForMedia(null);
      }
    } catch (err: any) {
      toast({
        title: "Errore",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsUploadingToPubler(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCaption(id);
    setTimeout(() => setCopiedCaption(null), 2000);
  };

  const activePost = useMemo(() => batchResults.find(p => p.id === activePostId), [batchResults, activePostId]);
  const isDark = theme === 'dark';

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram': return <Instagram className="w-4 h-4" />;
      case 'linkedin': return <Linkedin className="w-4 h-4" />;
      case 'facebook': return <Facebook className="w-4 h-4" />;
      case 'twitter': return <Twitter className="w-4 h-4" />;
      case 'tiktok': return <span className="text-sm">🎵</span>;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        <div className="flex-1 overflow-y-auto">
          <div className={`min-h-full ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
            <div className="border-b sticky top-0 z-40 backdrop-blur-xl bg-background/80">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold tracking-tight">AdVisage <span className="text-indigo-500">PRO</span></h1>
                      <p className="text-xs text-muted-foreground">AI Creative Factory</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant={viewMode === 'pitch' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode(viewMode === 'factory' ? 'pitch' : 'factory')}
                    >
                      {viewMode === 'factory' ? 'Client Pitch Mode' : 'Back to Factory'}
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => setShowSettings(true)}>
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={toggleTheme}>
                      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
              {!batchResults.length ? (
                <div className="flex flex-col lg:flex-row gap-8">
                  <aside className="lg:w-80 shrink-0 space-y-6">
                    <Card className={isDark ? 'bg-slate-900/50 border-slate-800' : ''}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-indigo-500" />
                          Factory Styles
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-2 block">Mood</label>
                          <Select value={settings.mood} onValueChange={(v) => setSettings({...settings, mood: v as any})}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="luxury">Luxury / Elegant</SelectItem>
                              <SelectItem value="energetic">Vibrant / Energetic</SelectItem>
                              <SelectItem value="professional">Enterprise / Trusted</SelectItem>
                              <SelectItem value="minimalist">Minimalist / Zen</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-2 block">Art Style</label>
                          <Select value={settings.stylePreference} onValueChange={(v) => setSettings({...settings, stylePreference: v as any})}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="realistic">Photography</SelectItem>
                              <SelectItem value="3d-render">3D Product Render</SelectItem>
                              <SelectItem value="illustration">Flat Design</SelectItem>
                              <SelectItem value="cyberpunk">Cyber / Neon</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className={isDark ? 'bg-slate-900/50 border-slate-800' : ''}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-500" />
                          Importa Contenuti
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => setShowImportDialog(true)}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Importa da Post Esistenti
                          <Badge variant="secondary" className="ml-auto">{existingPosts.length}</Badge>
                        </Button>
                        
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={fetchFromExternalSource}
                          disabled={isFetchingFromSource}
                        >
                          {isFetchingFromSource ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                          )}
                          Importa da Generatore
                        </Button>
                      </CardContent>
                    </Card>
                  </aside>

                  <div className="flex-1 space-y-4">
                    {postInputs.map((post, idx) => {
                      const getStatusBadge = (status?: string) => {
                        switch (status) {
                          case 'scheduled': return <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">Programmato</Badge>;
                          case 'published': return <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">Pubblicato</Badge>;
                          case 'draft': return <Badge className="text-[10px] bg-gray-100 text-gray-700 border-gray-200">Bozza</Badge>;
                          default: return null;
                        }
                      };
                      
                      const formatDate = (dateStr?: string) => {
                        if (!dateStr) return null;
                        const date = new Date(dateStr);
                        return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
                      };
                      
                      return (
                        <Card key={post.id} className={`relative group ${isDark ? 'bg-slate-900/50 border-slate-800' : ''} ${post.sourcePostId ? 'ring-2 ring-emerald-500/50' : ''}`}>
                          {post.sourcePostId && (
                            <div className="absolute top-0 left-0 right-0 bg-emerald-500/10 border-b border-emerald-200 dark:border-emerald-800 px-4 py-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Collegato:</span>
                                  </div>
                                  <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300 truncate max-w-[200px]">{post.sourcePostTitle}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {post.sourceScheduledDate && (
                                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                      <Calendar className="w-3 h-3" />
                                      <span className="text-[10px] font-medium">{formatDate(post.sourceScheduledDate)}</span>
                                    </div>
                                  )}
                                  {getStatusBadge(post.sourceStatus)}
                                  {post.sourceMediaType && (
                                    <Badge variant="outline" className="text-[10px]">
                                      {post.sourceMediaType === 'carosello' ? 'Carousel' : post.sourceMediaType}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          <CardContent className={`p-6 ${post.sourcePostId ? 'pt-14' : ''}`}>
                            <div className="flex flex-col md:flex-row gap-4">
                              <div className="md:w-40 shrink-0 space-y-3">
                                <div>
                                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Piattaforma</label>
                                  <Select value={post.platform} onValueChange={(v) => updatePost(post.id, { platform: v as SocialPlatform })}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="instagram">Instagram</SelectItem>
                                      <SelectItem value="tiktok">TikTok</SelectItem>
                                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                                      <SelectItem value="facebook">Facebook</SelectItem>
                                      <SelectItem value="twitter">X (Twitter)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-medium">{post.text.length}</span> caratteri
                                </div>
                              </div>
                              <div className="flex-1">
                                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                                  Ad Copy #{idx + 1}
                                </label>
                                <Textarea
                                  value={post.text}
                                  onChange={(e) => updatePost(post.id, { text: e.target.value })}
                                  placeholder="Scrivi o importa il testo del post qui..."
                                  className="min-h-[120px] resize-none"
                                />
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`absolute ${post.sourcePostId ? 'top-12' : 'top-4'} right-4 opacity-0 group-hover:opacity-100 transition-opacity text-destructive`}
                              onClick={() => {
                                if (postInputs.length === 1) {
                                  // Se rimane solo 1 post, resetta invece di cancellare
                                  setPostInputs([{ id: Math.random().toString(36).substr(2, 9), text: '', platform: 'instagram' }]);
                                } else {
                                  removePostInput(post.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                    
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={addPostInput}>
                        <Plus className="w-4 h-4 mr-2" />
                        Aggiungi Post
                      </Button>
                      <Button 
                        className="flex-[2] bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                        onClick={handleStartBatch}
                        disabled={isProcessingBatch}
                      >
                        {isProcessingBatch ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Analisi in corso...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Inizia Produzione Batch
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-8">
                  <aside className="lg:w-72 shrink-0">
                    <Card className={`sticky top-28 ${isDark ? 'bg-slate-900/50 border-slate-800' : ''}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold">Coda Elaborata</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <ScrollArea className="max-h-[300px]">
                          {batchResults.map(p => {
                            const firstConceptId = p.concepts[0].id;
                            const hasImage = generatedImages.some(img => img.conceptId === firstConceptId);
                            const isGenerating = generatingIds.has(firstConceptId);
                            
                            return (
                              <button
                                key={p.id}
                                onClick={() => setActivePostId(p.id)}
                                className={`w-full text-left p-3 rounded-lg border mb-2 transition-all flex items-center gap-3 ${
                                  activePostId === p.id 
                                    ? 'bg-indigo-600 text-white border-indigo-500' 
                                    : isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 hover:bg-slate-200'
                                }`}
                              >
                                <div className="relative">
                                  {getPlatformIcon(p.socialNetwork)}
                                  {hasImage && <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />}
                                  {isGenerating && <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />}
                                </div>
                                <div className="truncate flex-1">
                                  <p className="text-xs font-semibold truncate">{p.context.sector}</p>
                                  <p className="text-[10px] opacity-60 truncate">{p.tone}</p>
                                </div>
                              </button>
                            );
                          })}
                        </ScrollArea>
                        
                        <Button
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                          onClick={handleBatchGenerateFirstImages}
                          disabled={isBatchRendering}
                        >
                          {isBatchRendering ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Rendering...
                            </>
                          ) : (
                            <>
                              <Layers className="w-4 h-4 mr-2" />
                              Renderizza Batch
                            </>
                          )}
                        </Button>

                        <Button
                          variant="ghost"
                          className="w-full text-destructive"
                          onClick={() => {
                            setBatchResults([]);
                            setPostInputs([{ id: 'reset', text: '', platform: 'instagram' }]);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Pulisci Tutto
                        </Button>
                      </CardContent>
                    </Card>
                  </aside>

                  <div className="flex-1 space-y-8">
                    {activePost && (
                      <>
                        <Card className={isDark ? 'bg-slate-900/50 border-slate-800' : ''}>
                          <CardContent className="p-8">
                            <h2 className="text-2xl font-bold mb-6">Brand Strategy <span className="text-indigo-500">Report</span></h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                              <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Obiettivo Campagna</p>
                                <p className="font-semibold">{activePost.objective}</p>
                              </div>
                              <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Assetto Emotivo</p>
                                <p className="font-semibold text-indigo-500">{activePost.emotion}</p>
                              </div>
                            </div>
                            <div className={`p-6 rounded-xl ${isDark ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-indigo-50 border border-indigo-100'}`}>
                              <p className="text-xs font-semibold text-indigo-500 mb-2">Competitive Edge</p>
                              <p className="text-sm italic opacity-80">"{activePost.competitiveEdge}"</p>
                            </div>
                          </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {activePost.socialCaptions.map((cap, i) => (
                            <Card key={i} className={isDark ? 'bg-slate-900/50 border-slate-800' : ''}>
                              <CardContent className="p-5">
                                <div className="flex justify-between items-center mb-4">
                                  <Badge variant="secondary">{cap.tone}</Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => copyToClipboard(cap.text, `cap-${i}`)}
                                  >
                                    {copiedCaption === `cap-${i}` ? (
                                      <Check className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                                <p className="text-xs leading-relaxed opacity-70 line-clamp-5 mb-4">{cap.text}</p>
                                <div className="flex flex-wrap gap-1">
                                  {cap.hashtags.slice(0, 5).map(h => (
                                    <span key={h} className="text-[10px] text-indigo-500 font-medium">#{h}</span>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {activePost.concepts.map(concept => {
                          const isGen = generatingIds.has(concept.id);
                          const variant = variantToggle[concept.id] || 'text';
                          const currentImg = generatedImages.find(i => i.conceptId === concept.id && i.variant === variant)?.imageUrl;
                          
                          return (
                            <Card key={concept.id} className={`overflow-hidden ${isDark ? 'bg-slate-900/50 border-slate-800' : ''}`}>
                              <div className="flex flex-col lg:flex-row">
                                <div className={`lg:w-[400px] shrink-0 relative flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'} ${
                                  activePost.socialNetwork === 'tiktok' ? 'aspect-[9/16]' : 'aspect-square'
                                }`}>
                                  {currentImg ? (
                                    <>
                                      <img src={currentImg} className="w-full h-full object-cover" alt={concept.title} />
                                      <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                        <Button
                                          size="icon"
                                          variant="secondary"
                                          onClick={() => downloadImage(currentImg, `advisage-${concept.title.replace(/\s+/g, '-').toLowerCase()}-${variant}.png`)}
                                        >
                                          <Download className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="default"
                                          className="bg-indigo-600 hover:bg-indigo-700"
                                          onClick={() => handleUploadToPubler(currentImg, concept.id)}
                                        >
                                          <CloudUpload className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex flex-col items-center opacity-30">
                                      <ImageIcon className="w-16 h-16 mb-4" />
                                      <p className="text-xs font-semibold uppercase tracking-wider">Ready for Render</p>
                                    </div>
                                  )}
                                  {isGen && (
                                    <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-10">
                                      <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                                      <p className="text-xs font-semibold uppercase tracking-wider">Synthesizing...</p>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex-1 p-8">
                                  <div className="flex flex-wrap justify-between items-start mb-6 gap-4">
                                    <div>
                                      <h3 className="text-xl font-bold mb-1">{concept.title}</h3>
                                      <Badge variant="outline" className="text-indigo-500">{concept.styleType}</Badge>
                                    </div>
                                    <Badge variant="secondary">Ratio {concept.recommendedFormat}</Badge>
                                  </div>

                                  <p className="text-sm opacity-70 italic mb-6">"{concept.description}"</p>
                                  
                                  <div className={`p-4 rounded-xl mb-6 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Strategy Reasoning</p>
                                    <p className="text-xs leading-relaxed opacity-80">{concept.reasoning}</p>
                                  </div>
                                  
                                  <Tabs value={variant} onValueChange={(v) => setVariantToggle({...variantToggle, [concept.id]: v as 'text' | 'clean'})}>
                                    <TabsList className="w-full mb-4">
                                      <TabsTrigger value="text" className="flex-1">Con Testo</TabsTrigger>
                                      <TabsTrigger value="clean" className="flex-1">Solo Visual</TabsTrigger>
                                    </TabsList>
                                  </Tabs>

                                  <Button
                                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                                    onClick={() => handleGenerateOne(concept)}
                                    disabled={isGen}
                                  >
                                    {isGen ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Generazione...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Renderizza Asset Pro
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              )}
            </main>

            {error && (
              <div className="fixed bottom-6 right-6 bg-destructive text-destructive-foreground p-4 rounded-xl shadow-2xl z-50 flex items-center gap-3 max-w-md">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-sm">{error}</span>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setError(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impostazioni Avanzate</DialogTitle>
            <DialogDescription>Configura le tue preferenze per AdVisage PRO</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">API Key di Google AI Studio</label>
              <Input
                type="password"
                value={settings.manualApiKey}
                onChange={e => setSettings({...settings, manualApiKey: e.target.value})}
                placeholder="Incolla qui la tua API Key..."
              />
              <p className="text-xs text-muted-foreground mt-1">Necessaria per la generazione immagini</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Endpoint Generatore Testi (JSON)</label>
              <Input
                type="text"
                value={settings.externalSourceUrl}
                onChange={e => setSettings({...settings, externalSourceUrl: e.target.value})}
                placeholder="https://progetto.replit.app/api/genera"
              />
            </div>
            <Button onClick={() => setShowSettings(false)} className="w-full">
              Salva e Chiudi
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              Importa da Post Esistenti
            </DialogTitle>
            <DialogDescription>
              Seleziona un post per generare visual creativi. Mostra solo post senza immagini e non ancora pubblicati.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[50vh] mt-4">
            {isLoadingPosts ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (() => {
              const platformColors: Record<string, string> = {
                instagram: 'bg-pink-500/10 text-pink-600 border-pink-200',
                tiktok: 'bg-slate-500/10 text-slate-600 border-slate-200',
                linkedin: 'bg-blue-500/10 text-blue-600 border-blue-200',
                facebook: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
                twitter: 'bg-sky-500/10 text-sky-600 border-sky-200',
              };
              
              const filteredPosts = existingPosts.filter((post: ContentPost) => {
                if (post.status === 'published' || post.publerStatus === 'published') return false;
                const hasMedia = post.publerMediaIds && Array.isArray(post.publerMediaIds) && post.publerMediaIds.length > 0;
                if (hasMedia) return false;
                return true;
              });
              
              if (filteredPosts.length === 0) {
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium mb-1">Nessun post disponibile</p>
                    <p className="text-xs">Tutti i post sono già pubblicati o hanno già delle immagini</p>
                  </div>
                );
              }
              
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mb-3">
                    <span>{filteredPosts.length} post disponibili per visual</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span> Programmato
                      <span className="w-2 h-2 rounded-full bg-gray-400 ml-2"></span> Bozza
                    </span>
                  </div>
                  
                  {filteredPosts.map((post: ContentPost) => {
                    const fullCopy = getPostFullCopy(post);
                    const createdDateStr = post.createdAt 
                      ? new Date(post.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
                      : null;
                    const scheduledDateStr = (post.scheduledDate || post.scheduledAt)
                      ? new Date(post.scheduledDate || post.scheduledAt || '').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
                      : null;
                    
                    const isAlreadyInQueue = postInputs.some(p => p.sourcePostId === post.id);
                    const isScheduled = post.status === 'scheduled';
                    const charCount = fullCopy.length;
                    
                    return (
                      <button
                        key={post.id}
                        onClick={() => !isAlreadyInQueue && importFromPost(post)}
                        disabled={isAlreadyInQueue}
                        className={`w-full text-left p-4 rounded-lg border transition-all flex items-start gap-3 ${
                          isAlreadyInQueue 
                            ? 'opacity-50 cursor-not-allowed bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800' 
                            : isScheduled
                              ? 'hover:bg-amber-50 dark:hover:bg-amber-950/20 hover:border-amber-300 border-amber-200 dark:border-amber-800'
                              : 'hover:bg-accent hover:border-indigo-300'
                        }`}
                      >
                        <div className="relative">
                          <div className={`p-2.5 rounded-lg ${platformColors[post.platform || 'instagram'] || 'bg-slate-100'}`}>
                            {getPlatformIcon(post.platform || 'instagram')}
                          </div>
                          {isScheduled && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white dark:border-slate-900" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <p className="font-semibold text-sm truncate flex-1">{post.title || 'Post senza titolo'}</p>
                            <div className="flex items-center gap-2 shrink-0">
                              {createdDateStr && (
                                <span className="text-[10px] text-muted-foreground">
                                  Creato: {createdDateStr}
                                </span>
                              )}
                              {scheduledDateStr && (
                                <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/30 border-amber-300 text-amber-700 dark:text-amber-400">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  Pubblica: {scheduledDateStr}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{fullCopy}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`text-[10px] ${platformColors[post.platform || 'instagram']}`}>
                              {post.platform?.toUpperCase() || 'INSTAGRAM'}
                            </Badge>
                            <Badge variant={isScheduled ? 'default' : 'secondary'} className={`text-[10px] ${isScheduled ? 'bg-amber-500 hover:bg-amber-500' : ''}`}>
                              {isScheduled ? '📅 Programmato' : '📝 Bozza'}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {charCount} caratteri
                            </span>
                            {isAlreadyInQueue && (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
                                <Check className="w-3 h-3 mr-1" />
                                In coda
                              </Badge>
                            )}
                          </div>
                        </div>
                        {isAlreadyInQueue ? (
                          <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-1" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </ScrollArea>
          
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {postInputs.filter(p => p.sourcePostId).length > 0 && (
                <Badge variant="secondary" className="mr-2">
                  {postInputs.filter(p => p.sourcePostId).length} selezionati
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                Annulla
              </Button>
              <Button 
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => {
                  setShowImportDialog(false);
                  if (postInputs.filter(p => p.sourcePostId).length > 0) {
                    toast({
                      title: "Post collegati",
                      description: `${postInputs.filter(p => p.sourcePostId).length} post aggiunti alla coda`,
                    });
                  }
                }}
              >
                <Check className="w-4 h-4 mr-2" />
                Conferma Selezione
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPublerDialog} onOpenChange={setShowPublerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carica su Publer</DialogTitle>
            <DialogDescription>
              {uploadingImage?.sourcePostId 
                ? `Immagine collegata a "${uploadingImage.sourcePostTitle}" - verrà associata automaticamente`
                : 'Carica l\'immagine su Publer e opzionalmente associala a un post'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {uploadingImage && (
              <div className="rounded-lg overflow-hidden border">
                <img src={uploadingImage.url} alt="Preview" className="w-full max-h-48 object-contain bg-slate-100" />
              </div>
            )}
            
            {uploadingImage?.sourcePostId && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-200 text-emerald-700">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">Post collegato: {uploadingImage.sourcePostTitle}</span>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium mb-2 block">
                {uploadingImage?.sourcePostId ? 'Post associato' : 'Associa a un post (opzionale)'}
              </label>
              <Select 
                value={selectedPostForMedia || '__none__'} 
                onValueChange={(v) => setSelectedPostForMedia(v === '__none__' ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un post..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nessuna associazione</SelectItem>
                  {existingPosts.map((post: ContentPost) => (
                    <SelectItem key={post.id} value={post.id}>
                      {post.title || 'Post senza titolo'} ({post.platform})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowPublerDialog(false)}>
                Annulla
              </Button>
              <Button 
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                onClick={executePublerUpload}
                disabled={isUploadingToPubler}
              >
                {isUploadingToPubler ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Caricamento...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Carica su Publer
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdVisagePage;
