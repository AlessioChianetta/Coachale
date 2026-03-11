import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { analyzeAdText, generateImageConcept, buildPromptPreview } from './services/geminiService';
import { AdAnalysis, GeneratedImage, VisualConcept, AppSettings, PostInput, SocialPlatform, CONCEPT_TYPES } from './types';
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
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  History,
  RotateCcw,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Link2,
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

const AdVisagePage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
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
      imageFormat: '1:1' as const,
      brandColor: '#6366f1',
      brandFont: 'Inter',
      externalSourceUrl: ''
    };
  });
  
  const [stylesMode, setStylesMode] = useState<'manual' | 'auto'>(() => {
    return (localStorage.getItem('advisage_styles_mode') as 'manual' | 'auto') || 'auto';
  });
  const [cachedManualSettings, setCachedManualSettings] = useState<AppSettings | null>(null);
  
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
  
  const [selectedConceptTypes, setSelectedConceptTypes] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'factory' | 'pitch'>('factory');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showPublerDialog, setShowPublerDialog] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<{ url: string; conceptId: string; sourcePostId?: string; sourcePostTitle?: string } | null>(null);
  const [isUploadingToPubler, setIsUploadingToPubler] = useState(false);
  const [selectedPostForMedia, setSelectedPostForMedia] = useState<string | null>(null);
  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);
  const [promptPreviewOpen, setPromptPreviewOpen] = useState<Record<string, boolean>>({});
  const [originalTextExpanded, setOriginalTextExpanded] = useState<Record<string, boolean>>({});
  const [conceptOverrides, setConceptOverrides] = useState<Record<string, Partial<AppSettings>>>({});
  const [conceptControlsOpen, setConceptControlsOpen] = useState<Record<string, boolean>>({});
  const [selectedHistoryImage, setSelectedHistoryImage] = useState<Record<string, number>>({});
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);

  const { data: sessionsData, refetch: refetchSessions } = useQuery({
    queryKey: ['/api/content/advisage/sessions'],
    queryFn: async () => {
      const response = await fetch('/api/content/advisage/sessions', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch sessions');
      return response.json();
    },
  });

  const saveSessionToServer = async (batchData: AdAnalysis[], postData: PostInput[], sessionId?: string | null): Promise<string | null> => {
    try {
      const firstPost = batchData[0];
      const sessionName = firstPost ? `${firstPost.context?.sector || 'Produzione'} — ${new Date().toLocaleDateString('it-IT')}` : `Produzione ${new Date().toLocaleDateString('it-IT')}`;
      
      if (sessionId) {
        const response = await fetch(`/api/content/advisage/sessions/${sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ batchResults: batchData, postInputs: postData, settings }),
        });
        if (!response.ok) {
          console.error('[ADVISAGE] Update session failed:', response.status);
          return null;
        }
        return sessionId;
      } else {
        const response = await fetch('/api/content/advisage/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ name: sessionName, settings, batchResults: batchData, postInputs: postData }),
        });
        if (!response.ok) {
          console.error('[ADVISAGE] Create session failed:', response.status);
          return null;
        }
        const result = await response.json();
        if (result.success && result.data?.id) {
          refetchSessions();
          return result.data.id;
        }
      }
    } catch (err) {
      console.error('[ADVISAGE] Save session error:', err);
    }
    return null;
  };

  const saveImageToServer = async (sessionId: string, conceptId: string, variant: string, imageBase64: string) => {
    try {
      await fetch(`/api/content/advisage/sessions/${sessionId}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ conceptId, variant, imageBase64, settingsUsed: getMergedSettings(conceptId) }),
      });
    } catch (err) {
      console.error('[ADVISAGE] Save image error:', err);
    }
  };

  const loadSessionFromServer = async (sessionId: string) => {
    setLoadingSessionId(sessionId);
    try {
      const response = await fetch(`/api/content/advisage/sessions/${sessionId}`, { headers: getAuthHeaders() });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      
      const { session, images } = result.data;
      
      if (session.settings) setSettings(prev => ({ ...prev, ...session.settings }));
      if (session.post_inputs?.length) setPostInputs(session.post_inputs);
      
      if (session.batch_results?.length) {
        setBatchResults(session.batch_results);
        setActivePostId(session.batch_results[0].id);
        
        const newPrompts: Record<string, string> = {};
        session.batch_results.forEach((result: AdAnalysis) => {
          result.concepts.forEach((c: VisualConcept) => {
            newPrompts[`${c.id}_text`] = c.promptWithText;
            newPrompts[`${c.id}_clean`] = c.promptClean;
          });
        });
        setCustomPrompts(newPrompts);
      }
      
      if (images?.length) {
        const loadedImages: GeneratedImage[] = images.map((img: any) => ({
          conceptId: img.concept_id,
          imageUrl: img.image_path,
          variant: img.variant,
          timestamp: new Date(img.created_at).getTime(),
        }));
        setGeneratedImages(loadedImages);
      }
      
      setCurrentSessionId(sessionId);
      setShowSessionHistory(false);
      
      toast({ title: "Sessione caricata", description: "Produzione precedente ripristinata con successo" });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setLoadingSessionId(null);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await fetch(`/api/content/advisage/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      refetchSessions();
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }
      toast({ title: "Sessione eliminata" });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
  };

  const getMergedSettings = (conceptId: string): AppSettings => {
    const overrides = conceptOverrides[conceptId];
    if (!overrides) return settings;
    return { ...settings, ...overrides };
  };

  const updateConceptOverride = (conceptId: string, field: string, value: any) => {
    setConceptOverrides(prev => ({
      ...prev,
      [conceptId]: { ...(prev[conceptId] || {}), [field]: value }
    }));
  };

  const resetConceptOverrides = (conceptId: string) => {
    setConceptOverrides(prev => {
      const next = { ...prev };
      delete next[conceptId];
      return next;
    });
  };

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
    localStorage.setItem('advisage_styles_mode', stylesMode);
  }, [postInputs, settings, theme, stylesMode]);

  useEffect(() => {
    if (!lightboxImage) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxImage(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxImage]);

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
      // Analizza in parallelo con concorrenza limitata (max 3 alla volta per evitare rate limits)
      const CONCURRENCY_LIMIT = 3;
      const results: AdAnalysis[] = [];
      const errors: string[] = [];
      
      for (let i = 0; i < valid.length; i += CONCURRENCY_LIMIT) {
        const batch = valid.slice(i, i + CONCURRENCY_LIMIT);
        const batchResults = await Promise.allSettled(
          batch.map(async (post) => {
            const result = await analyzeAdText(post.text, post.platform, settings, selectedConceptTypes, stylesMode);
            result.sourcePostId = post.sourcePostId;
            result.sourcePostTitle = post.sourcePostTitle;
            return result;
          })
        );
        
        batchResults.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            errors.push(`Post "${batch[idx].sourcePostTitle || idx + 1}": ${result.reason?.message || 'Errore'}`);
          }
        });
      }
      
      if (errors.length > 0 && results.length === 0) {
        throw new Error(errors.join('; '));
      }
      
      if (errors.length > 0) {
        setError(`Alcuni post non analizzati: ${errors.join('; ')}`);
      }
      
      // Costruisci i prompt dopo che le analisi sono complete
      const newPrompts = { ...customPrompts };
      results.forEach(result => {
        result.concepts.forEach(c => {
          newPrompts[`${c.id}_text`] = c.promptWithText;
          newPrompts[`${c.id}_clean`] = c.promptClean;
        });
      });
      
      if (results.length > 0) {
        if (stylesMode === 'auto' && results[0]?.recommendedSettings) {
          const rec = results[0].recommendedSettings;
          const validMoods = ['professional', 'energetic', 'luxury', 'minimalist', 'playful'];
          const validStyles = ['realistic', '3d-render', 'illustration', 'cyberpunk', 'lifestyle'];
          const validLighting = ['studio', 'natural', 'dramatic', 'neon', 'soft'];
          const validColorGrading = ['neutral', 'warm', 'cold', 'cinematic', 'vintage', 'vibrant'];
          const validCamera = ['standard', 'closeup', 'wideshot', 'flatlay', 'lowangle', 'aerial'];
          const validBackground = ['studio', 'outdoor', 'gradient', 'blur', 'contextual'];
          const validFormats = ['1:1', '4:5', '9:16', '16:9', '4:3', '2:3', '3:2', '5:4', '21:9'];
          
          const validated: Partial<AppSettings> = {};
          if (rec.mood && validMoods.includes(rec.mood)) validated.mood = rec.mood as any;
          if (rec.stylePreference && validStyles.includes(rec.stylePreference)) validated.stylePreference = rec.stylePreference as any;
          if (rec.lightingStyle && validLighting.includes(rec.lightingStyle)) validated.lightingStyle = rec.lightingStyle as any;
          if (rec.colorGrading && validColorGrading.includes(rec.colorGrading)) validated.colorGrading = rec.colorGrading as any;
          if (rec.cameraAngle && validCamera.includes(rec.cameraAngle)) validated.cameraAngle = rec.cameraAngle as any;
          if (rec.backgroundStyle && validBackground.includes(rec.backgroundStyle)) validated.backgroundStyle = rec.backgroundStyle as any;
          if (rec.imageFormat && validFormats.includes(rec.imageFormat)) validated.imageFormat = rec.imageFormat as any;
          
          if (Object.keys(validated).length > 0) {
            setSettings(prev => ({ ...prev, ...validated }));
            toast({ 
              title: "AI Auto-Style applicato", 
              description: rec.reasoning || "Impostazioni visive ottimizzate automaticamente per questo ads" 
            });
          }
        }
        
        setBatchResults(results);
        setCustomPrompts(newPrompts);
        setActivePostId(results[0].id);
        
        const newSessionId = await saveSessionToServer(results, valid, currentSessionId);
        if (newSessionId) {
          setCurrentSessionId(newSessionId);
          toast({ title: "Sessione salvata", description: "La produzione è stata salvata automaticamente" });
        }
      }
    } catch (err: any) { 
      setError(err.message); 
    } finally { 
      setIsProcessingBatch(false); 
    }
  };

  const getOriginalTextForConcept = (conceptId: string): string | undefined => {
    for (const result of batchResults) {
      if (result.concepts.some(c => c.id === conceptId)) {
        return result.originalText;
      }
    }
    return undefined;
  };

  const handleGenerateOne = async (concept: VisualConcept, variantOverride?: 'clean' | 'text') => {
    if (generatingIds.has(concept.id)) return;
    const variant = variantOverride || variantToggle[concept.id] || 'text';
    const mergedSettings = getMergedSettings(concept.id);
    setGeneratingIds(prev => new Set(prev).add(concept.id));
    try {
      const ratioMap: any = { "1:1": "1:1", "4:5": "3:4", "9:16": "9:16", "16:9": "16:9", "4:3": "4:3", "3:4": "3:4", "2:3": "2:3", "3:2": "3:2", "5:4": "5:4", "21:9": "21:9" };
      const userFormat = mergedSettings.imageFormat || '1:1';
      const aspectRatio = ratioMap[userFormat] || ratioMap[concept.recommendedFormat] || '1:1';
      const originalText = getOriginalTextForConcept(concept.id);
      const url = await generateImageConcept(customPrompts[`${concept.id}_${variant}`], aspectRatio, mergedSettings, variant, concept.textContent, concept.styleType, concept.promptVisual, concept.description, originalText);
      setGeneratedImages(prev => [{ conceptId: concept.id, imageUrl: url, variant, timestamp: Date.now() }, ...prev]);
      setSelectedHistoryImage(prev => ({ ...prev, [concept.id]: 0 }));
      
      if (currentSessionId) {
        saveImageToServer(currentSessionId, concept.id, variant, url);
      }
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

  const [linkingToPost, setLinkingToPost] = useState<string | null>(null);

  const handleLinkImageToPost = async (imageUrl: string) => {
    const sourcePostId = activePost?.sourcePostId;
    if (!sourcePostId) {
      toast({ title: "Nessun post collegato", description: "Questo concept non è associato a un post esistente", variant: "destructive" });
      return;
    }
    setLinkingToPost(sourcePostId);
    try {
      const res = await fetch(`/api/content/posts/${sourcePostId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ imageUrl }),
      });
      if (res.ok) {
        toast({ title: "Immagine associata", description: `Immagine salvata nel post "${activePost?.sourcePostTitle || 'collegato'}"` });
      } else {
        throw new Error("Errore nel salvataggio");
      }
    } catch (err) {
      console.error("Error linking image to post:", err);
      toast({ title: "Errore", description: "Impossibile associare l'immagine al post", variant: "destructive" });
    } finally {
      setLinkingToPost(null);
    }
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
    <div className={embedded ? "h-full" : "min-h-screen bg-background"}>
      {!embedded && isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={embedded ? "flex h-full" : `flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        {!embedded && <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
        
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
                    <Button variant="outline" size="sm" onClick={() => { refetchSessions(); setShowSessionHistory(true); }}>
                      <History className="w-4 h-4 mr-1" />
                      Storico
                      {sessionsData?.data?.length > 0 && (
                        <Badge variant="secondary" className="ml-1 text-[10px]">{sessionsData.data.length}</Badge>
                      )}
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

            <main className={`mx-auto px-4 sm:px-6 py-8 ${batchResults.length ? 'max-w-full' : 'max-w-7xl'}`}>
              {!batchResults.length ? (
                <div className="flex flex-col lg:flex-row gap-8">
                  <aside className="lg:w-80 shrink-0 space-y-6">
                    <Card className={`border-2 ${isDark ? 'border-indigo-500/50 bg-gradient-to-b from-indigo-950/40 to-slate-900/50' : 'border-indigo-400/60 bg-gradient-to-b from-indigo-50 to-white'}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
                            <FileText className="w-4 h-4 text-indigo-500" />
                          </div>
                          Importa Contenuti
                        </CardTitle>
                        <p className={`text-[11px] leading-snug ${isDark ? 'text-indigo-300/70' : 'text-indigo-600/70'}`}>
                          Importa i tuoi post per generare inserzioni visive
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-2.5">
                        <Button
                          className="w-full justify-start bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white h-10 text-xs font-semibold"
                          onClick={() => setShowImportDialog(true)}
                        >
                          <FileText className="w-4 h-4 mr-2 shrink-0" />
                          Importa da Post Esistenti
                          <Badge className="ml-auto bg-white/20 text-white border-0 text-[10px]">{existingPosts.length}</Badge>
                        </Button>
                        
                        <Button
                          variant="outline"
                          className={`w-full justify-start h-10 text-xs font-medium ${isDark ? 'border-indigo-500/30 hover:bg-indigo-500/10' : 'border-indigo-300 hover:bg-indigo-50'}`}
                          onClick={fetchFromExternalSource}
                          disabled={isFetchingFromSource}
                        >
                          {isFetchingFromSource ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2 text-indigo-500" />
                          )}
                          Importa da Generatore
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className={isDark ? 'bg-slate-900/50 border-slate-800' : ''}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-indigo-500" />
                          Factory Styles
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                          stylesMode === 'auto' 
                            ? 'bg-indigo-500/10 border-indigo-500/30' 
                            : isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
                        }`}>
                          <button
                            onClick={() => {
                              if (cachedManualSettings) {
                                setSettings(cachedManualSettings);
                                setCachedManualSettings(null);
                              }
                              setStylesMode('manual');
                            }}
                            className={`flex-1 text-[11px] font-semibold py-1.5 rounded-md transition-all ${
                              stylesMode === 'manual' 
                                ? isDark ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Manuale
                          </button>
                          <button
                            onClick={() => {
                              setCachedManualSettings({ ...settings });
                              setStylesMode('auto');
                            }}
                            className={`flex-1 text-[11px] font-semibold py-1.5 rounded-md transition-all flex items-center justify-center gap-1 ${
                              stylesMode === 'auto' 
                                ? 'bg-indigo-500 text-white shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <Zap className="w-3 h-3" />
                            AI Auto
                          </button>
                        </div>
                        {stylesMode === 'auto' && (
                          <p className="text-[10px] text-indigo-400 leading-tight">
                            L'AI analizzerà il testo e sceglierà automaticamente mood, stile, illuminazione, colori, inquadratura e sfondo ottimali per ogni ads.
                          </p>
                        )}
                        <div className={stylesMode === 'auto' ? 'opacity-50 pointer-events-none' : ''}>
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
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-2 block">Formato Immagine</label>
                          <Select value={settings.imageFormat || '1:1'} onValueChange={(v) => setSettings({...settings, imageFormat: v as any})}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1:1">
                                <span className="flex items-center gap-2">
                                  <span className="w-3 h-3 border border-current rounded-sm" />
                                  Instagram Feed (1:1)
                                </span>
                              </SelectItem>
                              <SelectItem value="4:5">
                                <span className="flex items-center gap-2">
                                  <span className="w-2.5 h-3 border border-current rounded-sm" />
                                  Instagram Post (4:5)
                                </span>
                              </SelectItem>
                              <SelectItem value="2:3">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-3 border border-current rounded-sm" />
                                  Portrait (2:3)
                                </span>
                              </SelectItem>
                              <SelectItem value="9:16">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-3.5 border border-current rounded-sm" />
                                  Story / Reel (9:16)
                                </span>
                              </SelectItem>
                              <SelectItem value="16:9">
                                <span className="flex items-center gap-2">
                                  <span className="w-4 h-2.5 border border-current rounded-sm" />
                                  Facebook / LinkedIn (16:9)
                                </span>
                              </SelectItem>
                              <SelectItem value="4:3">
                                <span className="flex items-center gap-2">
                                  <span className="w-3.5 h-2.5 border border-current rounded-sm" />
                                  Landscape (4:3)
                                </span>
                              </SelectItem>
                              <SelectItem value="3:2">
                                <span className="flex items-center gap-2">
                                  <span className="w-3.5 h-2.5 border border-current rounded-sm" />
                                  Landscape (3:2)
                                </span>
                              </SelectItem>
                              <SelectItem value="5:4">
                                <span className="flex items-center gap-2">
                                  <span className="w-3 h-2.5 border border-current rounded-sm" />
                                  Orizzontale (5:4)
                                </span>
                              </SelectItem>
                              <SelectItem value="21:9">
                                <span className="flex items-center gap-2">
                                  <span className="w-5 h-2 border border-current rounded-sm" />
                                  Ultra-wide (21:9)
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground mt-1">Sovrascrive il formato suggerito dall'AI</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-2 block">Illuminazione</label>
                          <Select value={settings.lightingStyle || 'studio'} onValueChange={(v) => setSettings({...settings, lightingStyle: v as any})}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="studio">Studio (3 punti)</SelectItem>
                              <SelectItem value="natural">Naturale / Golden Hour</SelectItem>
                              <SelectItem value="dramatic">Drammatica / Chiaroscuro</SelectItem>
                              <SelectItem value="neon">Neon / Club</SelectItem>
                              <SelectItem value="soft">Morbida / Eterea</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-2 block">Color Grading</label>
                          <Select value={settings.colorGrading || 'neutral'} onValueChange={(v) => setSettings({...settings, colorGrading: v as any})}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="neutral">Naturale</SelectItem>
                              <SelectItem value="warm">Caldo / Ambrato</SelectItem>
                              <SelectItem value="cold">Freddo / Blu</SelectItem>
                              <SelectItem value="cinematic">Cinematografico (Orange & Teal)</SelectItem>
                              <SelectItem value="vintage">Vintage / Film</SelectItem>
                              <SelectItem value="vibrant">Vibrante / Pop</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-2 block">Inquadratura</label>
                          <Select value={settings.cameraAngle || 'standard'} onValueChange={(v) => setSettings({...settings, cameraAngle: v as any})}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Standard (livello occhi)</SelectItem>
                              <SelectItem value="closeup">Close-up / Dettaglio</SelectItem>
                              <SelectItem value="wideshot">Ampia / Contesto</SelectItem>
                              <SelectItem value="flatlay">Flat Lay (dall'alto)</SelectItem>
                              <SelectItem value="lowangle">Dal basso (eroico)</SelectItem>
                              <SelectItem value="aerial">Aerea / Drone</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-2 block">Sfondo</label>
                          <Select value={settings.backgroundStyle || 'studio'} onValueChange={(v) => setSettings({...settings, backgroundStyle: v as any})}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="studio">Studio (cyclorama)</SelectItem>
                              <SelectItem value="outdoor">Esterno / Location</SelectItem>
                              <SelectItem value="gradient">Gradiente</SelectItem>
                              <SelectItem value="blur">Sfocato (bokeh)</SelectItem>
                              <SelectItem value="contextual">Contestuale (ambiente)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-2 block">Qualità Immagine</label>
                          <Select value={settings.imageQuality || 'standard'} onValueChange={(v) => setSettings({...settings, imageQuality: v as any})}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Standard (2K)</SelectItem>
                              <SelectItem value="high">Alta Qualità (4K)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground mt-1">4K usa più token ma produce dettagli superiori</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-2 block">Colore Brand</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={settings.brandColor || '#6366f1'}
                              onChange={(e) => setSettings({...settings, brandColor: e.target.value})}
                              className="w-10 h-10 rounded-lg border cursor-pointer"
                            />
                            <Input
                              value={settings.brandColor || '#6366f1'}
                              onChange={(e) => setSettings({...settings, brandColor: e.target.value})}
                              className="flex-1 font-mono text-xs"
                              placeholder="#6366f1"
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">Usato come accento visivo nell'immagine</p>
                        </div>
                        </div>
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
                    
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground block">
                        Tipologia Inserzione <span className="text-muted-foreground/60">(opzionale — seleziona 1-3 tipologie)</span>
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {CONCEPT_TYPES.map((ct) => {
                          const isSelected = selectedConceptTypes.includes(ct.id);
                          return (
                            <button
                              key={ct.id}
                              type="button"
                              onClick={() => {
                                setSelectedConceptTypes(prev => {
                                  if (prev.includes(ct.id)) return prev.filter(id => id !== ct.id);
                                  if (prev.length >= 3) return prev;
                                  return [...prev, ct.id];
                                });
                              }}
                              className={`relative flex flex-col items-start gap-1.5 p-3 rounded-lg border-2 text-left transition-all ${
                                isSelected 
                                  ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30' 
                                  : 'border-border hover:border-muted-foreground/40 hover:bg-muted/50'
                              } ${selectedConceptTypes.length >= 3 && !isSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              {ct.referenceImage && (
                                <img 
                                  src={ct.referenceImage} 
                                  alt={ct.label}
                                  className="w-full h-16 object-cover rounded-md mb-1"
                                />
                              )}
                              <span className={`text-xs font-semibold leading-tight ${isSelected ? 'text-indigo-400' : ''}`}>
                                {ct.label}
                              </span>
                              <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                                {ct.description}
                              </span>
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5">
                                  <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 text-white" />
                                  </div>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {selectedConceptTypes.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            {selectedConceptTypes.length}/3 selezionate
                          </span>
                          <button 
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 underline"
                            onClick={() => setSelectedConceptTypes([])}
                          >
                            Rimuovi tutte
                          </button>
                        </div>
                      )}
                    </div>

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
                <div className="flex flex-col gap-6">
                  <div className={`sticky top-[72px] z-20 rounded-xl border backdrop-blur-md ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap shrink-0">Coda Elaborata</span>
                      <div className="flex-1 overflow-x-auto">
                        <div className="flex items-center gap-2">
                          {batchResults.map(p => {
                            const firstConceptId = p.concepts[0].id;
                            const hasImage = generatedImages.some(img => img.conceptId === firstConceptId);
                            const isGenerating = generatingIds.has(firstConceptId);
                            
                            return (
                              <button
                                key={p.id}
                                onClick={() => setActivePostId(p.id)}
                                className={`shrink-0 px-3 py-2 rounded-lg border transition-all flex items-center gap-2 ${
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
                                <div className="max-w-[140px]">
                                  <p className="text-xs font-semibold truncate">{p.context.sector}</p>
                                  <p className="text-[10px] opacity-60 truncate">{p.tone}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {currentSessionId && (
                          <span className="text-[10px] text-emerald-500 flex items-center">
                            <Check className="w-3 h-3 mr-0.5" />
                            Salvata
                          </span>
                        )}
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
                          onClick={handleBatchGenerateFirstImages}
                          disabled={isBatchRendering}
                        >
                          {isBatchRendering ? (
                            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Rendering...</>
                          ) : (
                            <><Layers className="w-3.5 h-3.5 mr-1.5" />Genera Tutto</>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive text-xs"
                          onClick={() => {
                            setBatchResults([]);
                            setGeneratedImages([]);
                            setCurrentSessionId(null);
                            setConceptOverrides({});
                            setCustomPrompts({});
                            setSelectedHistoryImage({});
                            setPostInputs([{ id: 'reset', text: '', platform: 'instagram' }]);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Nuova
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
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
                          const conceptHistory = generatedImages.filter(i => i.conceptId === concept.id);
                          const selectedIdx = selectedHistoryImage[concept.id] ?? 0;
                          const currentImg = conceptHistory.length > 0
                            ? (conceptHistory[selectedIdx] || conceptHistory[0])?.imageUrl
                            : undefined;
                          const mergedS = getMergedSettings(concept.id);
                          const hasOverrides = !!conceptOverrides[concept.id] && Object.keys(conceptOverrides[concept.id]).length > 0;
                          
                          return (
                            <Card key={concept.id} className={`overflow-hidden ${isDark ? 'bg-slate-900/50 border-slate-800' : ''}`}>
                              <div className="flex flex-col lg:flex-row">
                                <div className={`lg:w-[400px] shrink-0 relative flex flex-col ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                  <div className={`relative flex items-center justify-center flex-1 ${
                                    (mergedS.imageFormat === '9:16') ? 'aspect-[9/16]' :
                                    (mergedS.imageFormat === '4:5') ? 'aspect-[4/5]' :
                                    (mergedS.imageFormat === '2:3') ? 'aspect-[2/3]' :
                                    (mergedS.imageFormat === '16:9') ? 'aspect-[16/9]' :
                                    (mergedS.imageFormat === '4:3') ? 'aspect-[4/3]' :
                                    (mergedS.imageFormat === '3:2') ? 'aspect-[3/2]' :
                                    (mergedS.imageFormat === '5:4') ? 'aspect-[5/4]' :
                                    (mergedS.imageFormat === '21:9') ? 'aspect-[21/9]' :
                                    'aspect-square'
                                  }`}>
                                    {currentImg ? (
                                      <>
                                        <img src={currentImg} className="w-full h-full object-contain" alt={concept.title} />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                          <Button
                                            size="icon"
                                            variant="secondary"
                                            onClick={() => setLightboxImage({ url: currentImg, title: concept.title })}
                                            title="Visualizza a schermo intero"
                                          >
                                            <Maximize2 className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            size="icon"
                                            variant="secondary"
                                            onClick={() => downloadImage(currentImg, `advisage-${concept.title.replace(/\s+/g, '-').toLowerCase()}-${variant}.png`)}
                                            title="Scarica"
                                          >
                                            <Download className="w-4 h-4" />
                                          </Button>
                                          {activePost?.sourcePostId && (
                                            <Button
                                              size="icon"
                                              variant="secondary"
                                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                              onClick={() => handleLinkImageToPost(currentImg)}
                                              disabled={!!linkingToPost}
                                              title="Associa immagine al post"
                                            >
                                              {linkingToPost ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                                            </Button>
                                          )}
                                          <Button
                                            size="icon"
                                            variant="default"
                                            className="bg-indigo-600 hover:bg-indigo-700"
                                            onClick={() => handleUploadToPubler(currentImg, concept.id)}
                                            title="Carica su Publer"
                                          >
                                            <CloudUpload className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex flex-col items-center opacity-30">
                                        <ImageIcon className="w-16 h-16 mb-4" />
                                        <p className="text-xs font-semibold uppercase tracking-wider">Pronto per la Generazione</p>
                                      </div>
                                    )}
                                    {isGen && (
                                      <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-10">
                                        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
                                        <p className="text-xs font-semibold uppercase tracking-wider">Synthesizing...</p>
                                      </div>
                                    )}
                                  </div>
                                  {conceptHistory.length > 0 && (
                                    <div className={`p-2 border-t ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-200 bg-white/80'}`}>
                                      <div className="flex items-center gap-1.5 mb-1.5">
                                        <History className="w-3 h-3 text-muted-foreground" />
                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                          Storico ({conceptHistory.length})
                                        </span>
                                      </div>
                                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                                        {conceptHistory.map((img, idx) => (
                                          <button
                                            key={`${img.conceptId}-${img.timestamp}-${idx}`}
                                            onClick={() => {
                                              setSelectedHistoryImage(prev => ({...prev, [concept.id]: idx}));
                                            }}
                                            className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                                              selectedIdx === idx
                                                ? 'border-indigo-500 ring-1 ring-indigo-500/50'
                                                : isDark ? 'border-slate-600 hover:border-slate-400' : 'border-slate-300 hover:border-slate-500'
                                            }`}
                                            title={`${img.variant === 'text' ? 'Con Testo' : 'Solo Visual'} — ${new Date(img.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
                                          >
                                            <img src={img.imageUrl} className="w-full h-full object-cover" alt={`Gen ${idx + 1}`} />
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex-1 p-6 lg:p-8 space-y-5">
                                  <div className="flex flex-wrap justify-between items-start gap-3">
                                    <div>
                                      <h3 className="text-xl font-bold mb-1.5">{concept.title}</h3>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline" className="text-indigo-500">{concept.styleType}</Badge>
                                        <Badge variant="secondary" className="text-xs" title="Formato suggerito dall'AI">AI: {concept.recommendedFormat}</Badge>
                                        {mergedS.imageFormat && mergedS.imageFormat !== concept.recommendedFormat && (
                                          <Badge className="text-xs bg-indigo-500/15 text-indigo-500 border-indigo-500/30" title="Formato attivo per la generazione">Attivo: {mergedS.imageFormat}</Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {activePost?.originalText && (
                                    <div className={`p-4 rounded-xl border ${isDark ? 'border-blue-500/30 bg-blue-950/20' : 'border-blue-200 bg-blue-50'}`}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <FileText className="w-3.5 h-3.5 text-blue-500" />
                                        <span className="text-blue-600 text-xs font-bold uppercase tracking-wider">Testo Inserzione Originale</span>
                                        <div className="flex-1 h-px bg-blue-300/30" />
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 text-blue-500 hover:text-blue-700 text-[10px]"
                                          onClick={() => setOriginalTextExpanded({...originalTextExpanded, [concept.id]: !originalTextExpanded[concept.id]})}
                                        >
                                          {originalTextExpanded[concept.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                        </Button>
                                      </div>
                                      <p className={`text-xs leading-relaxed ${isDark ? 'text-blue-300' : 'text-blue-800'} ${originalTextExpanded[concept.id] ? '' : 'line-clamp-3'}`}>
                                        {activePost.originalText}
                                      </p>
                                    </div>
                                  )}

                                  {concept.textContent && (
                                    <div className={`relative p-4 rounded-xl border-2 ${isDark ? 'border-amber-500/40 bg-amber-950/20' : 'border-amber-400/60 bg-gradient-to-r from-amber-50 to-orange-50'}`}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-amber-600 text-xs font-bold uppercase tracking-wider">Testo Hook</span>
                                        <div className="flex-1 h-px bg-amber-300/40" />
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 text-amber-500 hover:text-amber-700"
                                          onClick={() => {
                                            navigator.clipboard.writeText(concept.textContent);
                                            toast({ title: "Hook copiato", description: "Testo copiato negli appunti" });
                                          }}
                                        >
                                          <Copy className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                      <p className={`text-base font-semibold leading-relaxed ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>
                                        "{concept.textContent}"
                                      </p>
                                    </div>
                                  )}

                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Descrizione Visiva</p>
                                    <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                                      {concept.description}
                                    </p>
                                  </div>
                                  
                                  <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Perché converte</p>
                                    <p className="text-xs leading-relaxed opacity-80">{concept.reasoning}</p>
                                  </div>
                                  
                                  <Tabs value={variant} onValueChange={(v) => setVariantToggle({...variantToggle, [concept.id]: v as 'text' | 'clean'})}>
                                    <TabsList className="w-full mb-4">
                                      <TabsTrigger value="text" className="flex-1">Con Testo</TabsTrigger>
                                      <TabsTrigger value="clean" className="flex-1">Solo Visual</TabsTrigger>
                                    </TabsList>
                                  </Tabs>

                                  <div className={`rounded-xl border ${isDark ? 'border-slate-700/60' : 'border-slate-200'}`}>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={`w-full justify-between text-xs rounded-b-none ${conceptControlsOpen[concept.id] ? 'rounded-t-xl' : 'rounded-xl'} ${isDark ? 'text-slate-300 hover:text-slate-100 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}`}
                                      onClick={() => setConceptControlsOpen({...conceptControlsOpen, [concept.id]: !conceptControlsOpen[concept.id]})}
                                    >
                                      <span className="flex items-center gap-2">
                                        <SlidersHorizontal className="w-3.5 h-3.5" />
                                        Personalizza Generazione
                                        {hasOverrides && (
                                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-indigo-500/20 text-indigo-400">
                                            Modificato
                                          </Badge>
                                        )}
                                      </span>
                                      {conceptControlsOpen[concept.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </Button>
                                    {conceptControlsOpen[concept.id] && (
                                      <div className={`p-4 border-t space-y-3 ${isDark ? 'border-slate-700/60 bg-slate-800/30' : 'border-slate-200 bg-slate-50/50'}`}>
                                        {hasOverrides && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-2 text-[10px] text-amber-500 hover:text-amber-400"
                                            onClick={() => resetConceptOverrides(concept.id)}
                                          >
                                            <RotateCcw className="w-3 h-3 mr-1" />
                                            Ripristina valori globali
                                          </Button>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Mood</label>
                                            <Select value={mergedS.mood} onValueChange={(v) => updateConceptOverride(concept.id, 'mood', v)}>
                                              <SelectTrigger className="h-8 text-xs">
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
                                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Art Style</label>
                                            <Select value={mergedS.stylePreference} onValueChange={(v) => updateConceptOverride(concept.id, 'stylePreference', v)}>
                                              <SelectTrigger className="h-8 text-xs">
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
                                          <div>
                                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Illuminazione</label>
                                            <Select value={mergedS.lightingStyle || 'studio'} onValueChange={(v) => updateConceptOverride(concept.id, 'lightingStyle', v)}>
                                              <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="studio">Studio (3 punti)</SelectItem>
                                                <SelectItem value="natural">Naturale / Golden Hour</SelectItem>
                                                <SelectItem value="dramatic">Drammatica</SelectItem>
                                                <SelectItem value="neon">Neon / Club</SelectItem>
                                                <SelectItem value="soft">Morbida / Eterea</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Color Grading</label>
                                            <Select value={mergedS.colorGrading || 'neutral'} onValueChange={(v) => updateConceptOverride(concept.id, 'colorGrading', v)}>
                                              <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="neutral">Naturale</SelectItem>
                                                <SelectItem value="warm">Caldo / Ambrato</SelectItem>
                                                <SelectItem value="cold">Freddo / Blu</SelectItem>
                                                <SelectItem value="cinematic">Cinematografico</SelectItem>
                                                <SelectItem value="vintage">Vintage / Film</SelectItem>
                                                <SelectItem value="vibrant">Vibrante / Pop</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Inquadratura</label>
                                            <Select value={mergedS.cameraAngle || 'standard'} onValueChange={(v) => updateConceptOverride(concept.id, 'cameraAngle', v)}>
                                              <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="standard">Standard</SelectItem>
                                                <SelectItem value="closeup">Close-up</SelectItem>
                                                <SelectItem value="wideshot">Ampia</SelectItem>
                                                <SelectItem value="flatlay">Flat Lay</SelectItem>
                                                <SelectItem value="lowangle">Dal basso</SelectItem>
                                                <SelectItem value="aerial">Aerea / Drone</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Sfondo</label>
                                            <Select value={mergedS.backgroundStyle || 'studio'} onValueChange={(v) => updateConceptOverride(concept.id, 'backgroundStyle', v)}>
                                              <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="studio">Studio</SelectItem>
                                                <SelectItem value="outdoor">Esterno</SelectItem>
                                                <SelectItem value="gradient">Gradiente</SelectItem>
                                                <SelectItem value="blur">Sfocato (bokeh)</SelectItem>
                                                <SelectItem value="contextual">Contestuale</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Formato</label>
                                            <Select value={mergedS.imageFormat || '1:1'} onValueChange={(v) => updateConceptOverride(concept.id, 'imageFormat', v)}>
                                              <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="1:1">1:1 Feed</SelectItem>
                                                <SelectItem value="4:5">4:5 Portrait</SelectItem>
                                                <SelectItem value="9:16">9:16 Story</SelectItem>
                                                <SelectItem value="16:9">16:9 Landscape</SelectItem>
                                                <SelectItem value="4:3">4:3</SelectItem>
                                                <SelectItem value="2:3">2:3</SelectItem>
                                                <SelectItem value="3:2">3:2</SelectItem>
                                                <SelectItem value="5:4">5:4</SelectItem>
                                                <SelectItem value="21:9">21:9 Ultra-wide</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Qualità</label>
                                            <Select value={mergedS.imageQuality || 'standard'} onValueChange={(v) => updateConceptOverride(concept.id, 'imageQuality', v)}>
                                              <SelectTrigger className="h-8 text-xs">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="standard">Standard (2K)</SelectItem>
                                                <SelectItem value="high">Alta (4K)</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                        <div>
                                          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Colore Brand</label>
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="color"
                                              value={mergedS.brandColor || '#6366f1'}
                                              onChange={(e) => updateConceptOverride(concept.id, 'brandColor', e.target.value)}
                                              className="w-8 h-8 rounded border cursor-pointer"
                                            />
                                            <Input
                                              value={mergedS.brandColor || '#6366f1'}
                                              onChange={(e) => updateConceptOverride(concept.id, 'brandColor', e.target.value)}
                                              className="flex-1 font-mono text-xs h-8"
                                              placeholder="#6366f1"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={`w-full justify-between text-xs ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                      onClick={() => setPromptPreviewOpen({...promptPreviewOpen, [concept.id]: !promptPreviewOpen[concept.id]})}
                                    >
                                      <span className="flex items-center gap-2">
                                        {promptPreviewOpen[concept.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        Anteprima Prompt
                                      </span>
                                      {promptPreviewOpen[concept.id] ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </Button>
                                    {promptPreviewOpen[concept.id] && (() => {
                                      const ratioMap: any = { "1:1": "1:1", "4:5": "3:4", "9:16": "9:16", "16:9": "16:9", "4:3": "4:3", "3:4": "3:4", "2:3": "2:3", "3:2": "3:2", "5:4": "5:4", "21:9": "21:9" };
                                      const userFormat = mergedS.imageFormat || '1:1';
                                      const previewRatio = ratioMap[userFormat] || ratioMap[concept.recommendedFormat] || '1:1';
                                      const previewPrompt = buildPromptPreview(concept, mergedS, variant, previewRatio, activePost?.originalText);
                                      return (
                                        <div className={`mt-3 rounded-xl border ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-slate-50'}`}>
                                          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200/20">
                                            <span className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                              {previewPrompt.length} caratteri
                                            </span>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 px-2 text-[10px]"
                                              onClick={() => {
                                                navigator.clipboard.writeText(previewPrompt);
                                                toast({ title: "Prompt copiato", description: "Prompt completo copiato negli appunti" });
                                              }}
                                            >
                                              <Copy className="w-3 h-3 mr-1" />
                                              Copia
                                            </Button>
                                          </div>
                                          <div className="max-h-[400px] overflow-y-auto">
                                            <pre className={`p-4 text-[11px] leading-relaxed whitespace-pre-wrap font-mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                              {previewPrompt}
                                            </pre>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  <Button
                                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                                    onClick={() => handleGenerateOne(concept)}
                                    disabled={isGen}
                                  >
                                    {isGen ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Generazione in corso...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Genera Immagine
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
              <label className="text-sm font-medium mb-2 block">Endpoint Generatore Testi (JSON)</label>
              <Input
                type="text"
                value={settings.externalSourceUrl}
                onChange={e => setSettings({...settings, externalSourceUrl: e.target.value})}
                placeholder="https://progetto.replit.app/api/genera"
              />
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Modello: Gemini 3.1 Flash Image Preview
              </p>
              <p className="text-xs text-emerald-600 mt-1">Le chiavi API vengono gestite automaticamente dal sistema.</p>
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
                return true;
              });
              
              if (filteredPosts.length === 0) {
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium mb-1">Nessun post disponibile</p>
                    <p className="text-xs">Tutti i post sono già pubblicati</p>
                  </div>
                );
              }
              
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mb-3">
                    <span>{filteredPosts.length} post disponibili</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Con immagine
                      <span className="w-2 h-2 rounded-full bg-amber-500 ml-2"></span> Programmato
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
                    const hasExistingMedia = post.publerMediaIds && Array.isArray(post.publerMediaIds) && post.publerMediaIds.length > 0;
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
                          {hasExistingMedia && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                          )}
                          {isScheduled && !hasExistingMedia && (
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
                            {hasExistingMedia && (
                              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
                                <ImageIcon className="w-3 h-3 mr-1" />
                                Ha immagine (sostituisce)
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {charCount} caratteri
                            </span>
                            {isAlreadyInQueue && (
                              <Badge className="text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200">
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

      <Dialog open={showSessionHistory} onOpenChange={setShowSessionHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-500" />
              Storico Produzioni
            </DialogTitle>
            <DialogDescription>
              Le tue produzioni batch precedenti con analisi e immagini generate
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[60vh] pr-2">
            <div className="space-y-2 pt-2">
              {!sessionsData?.data?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nessuna produzione salvata</p>
                  <p className="text-sm mt-1">Le produzioni batch vengono salvate automaticamente</p>
                </div>
              ) : (
                sessionsData.data.map((session: any) => {
                  const isActive = currentSessionId === session.id;
                  const isLoading = loadingSessionId === session.id;
                  const createdAt = new Date(session.created_at);
                  const imageCount = Number(session.image_count) || 0;
                  const conceptCount = Number(session.concept_count) || 0;
                  
                  return (
                    <div
                      key={session.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isActive 
                          ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30' 
                          : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm truncate">{session.name || 'Produzione senza nome'}</p>
                            {isActive && <Badge className="text-[10px] bg-indigo-500">Attiva</Badge>}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span>{createdAt.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span>{createdAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            {conceptCount > 0 && (
                              <Badge variant="outline" className="text-[10px]">
                                <Layers className="w-3 h-3 mr-1" />
                                {conceptCount} concept
                              </Badge>
                            )}
                            {imageCount > 0 && (
                              <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-600">
                                <ImageIcon className="w-3 h-3 mr-1" />
                                {imageCount} immagini
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant={isActive ? 'secondary' : 'default'}
                            onClick={() => loadSessionFromServer(session.id)}
                            disabled={isLoading || isActive}
                          >
                            {isLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : isActive ? (
                              'Attiva'
                            ) : (
                              <>
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Carica
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteSession(session.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
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

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <Button
              size="icon"
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                downloadImage(lightboxImage.url, `advisage-${lightboxImage.title.replace(/\s+/g, '-').toLowerCase()}.png`);
              }}
              title="Scarica"
            >
              <Download className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setLightboxImage(null)}
              title="Chiudi"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="absolute top-4 left-4 z-10">
            <p className="text-white/60 text-sm font-medium">{lightboxImage.title}</p>
          </div>
          <img
            src={lightboxImage.url}
            alt={lightboxImage.title}
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="text-white/40 text-xs mt-3">Clicca fuori dall'immagine per chiudere</p>
        </div>
      )}
    </div>
  );
};

export default AdVisagePage;
