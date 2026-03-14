import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  GraduationCap,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,  
  Pencil,
  Save,
  X,
  FileText,
  Video,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Loader2,
  Menu,
  BookOpen,
  AlertTriangle,
  Shield,
  Clock,
  PlayCircle,
  Film,
  Settings,
  ListOrdered,
  ClipboardPaste,
  Hash,
  HelpCircle,
  Info,
  RefreshCw,
  HardDrive,
} from "lucide-react";
import Navbar from "@/components/navbar";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "/api/consultant/academy";

interface AcademyVideo {
  id: string;
  lesson_id: string;
  title: string;
  video_url: string;
  video_type: string;
  sort_order: number;
}

interface AcademyDocument {
  id: string;
  lesson_id: string;
  title: string;
  file_url: string;
  file_type: string;
  sort_order: number;
}

interface AcademyStep {
  id: string;
  step_number: number;
  timestamp: string | null;
  title: string;
  description: string;
  screenshot_url: string | null;
  sort_order: number;
}

interface AcademyLesson {
  id: string;
  lesson_id: string;
  module_id: string;
  title: string;
  description: string;
  duration: string;
  video_url: string | null;
  video_type: string;
  config_link: string;
  sort_order: number;
  documents: AcademyDocument[];
  videos: AcademyVideo[];
  steps?: AcademyStep[];
  guide_embed_url?: string | null;
  guide_local_video_url?: string | null;
  guide_display_mode?: string;
}

interface AcademyModule {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  tagline: string;
  color: string;
  sort_order: number;
  lessons: AcademyLesson[];
}

const COLOR_OPTIONS = [
  { value: "slate", label: "Grigio", bg: "bg-slate-500", ring: "ring-slate-200" },
  { value: "blue", label: "Blu", bg: "bg-blue-500", ring: "ring-blue-200" },
  { value: "violet", label: "Viola", bg: "bg-violet-500", ring: "ring-violet-200" },
  { value: "indigo", label: "Indigo", bg: "bg-indigo-500", ring: "ring-indigo-200" },
  { value: "amber", label: "Ambra", bg: "bg-amber-500", ring: "ring-amber-200" },
  { value: "rose", label: "Rosa", bg: "bg-rose-500", ring: "ring-rose-200" },
  { value: "green", label: "Verde", bg: "bg-green-500", ring: "ring-green-200" },
  { value: "red", label: "Rosso", bg: "bg-red-500", ring: "ring-red-200" },
  { value: "orange", label: "Arancione", bg: "bg-orange-500", ring: "ring-orange-200" },
  { value: "teal", label: "Teal", bg: "bg-teal-500", ring: "ring-teal-200" },
];

const MODULE_GRADIENT: Record<string, string> = {
  slate: "from-slate-600 to-slate-800",
  blue: "from-blue-600 to-blue-800",
  violet: "from-violet-600 to-violet-800",
  indigo: "from-indigo-600 to-indigo-800",
  amber: "from-amber-500 to-amber-700",
  rose: "from-rose-500 to-rose-700",
  green: "from-green-600 to-green-800",
  red: "from-red-600 to-red-800",
  orange: "from-orange-500 to-orange-700",
  teal: "from-teal-600 to-teal-800",
};

interface DeleteState {
  type: "module" | "lesson" | "document" | "video" | "all-steps" | "local-media" | "local-video" | "local-screenshots" | "all-steps-and-media";
  id: string;
  name: string;
  step: number;
  confirmText: string;
}

export default function AdminAcademy() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState({ slug: "", title: "", emoji: "", tagline: "", color: "slate" });
  const [lessonForm, setLessonForm] = useState({ lesson_id: "", title: "", description: "", duration: "5 min", video_url: "", video_type: "iframe", config_link: "/" });
  const [showNewModule, setShowNewModule] = useState(false);
  const [showNewLesson, setShowNewLesson] = useState<string | null>(null);
  const [showNewDoc, setShowNewDoc] = useState<string | null>(null);
  const [docForm, setDocForm] = useState({ title: "", file_url: "", file_type: "link" });
  const [showNewVideo, setShowNewVideo] = useState<string | null>(null);
  const [videoForm, setVideoForm] = useState({ title: "", video_url: "", video_type: "youtube" });
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [showStepManager, setShowStepManager] = useState<string | null>(null);
  const [guiddeEmbedCode, setGuiddeEmbedCode] = useState("");
  const [guiddeEmbedKey, setGuiddeEmbedKey] = useState(0);
  const [guiddeWordHtml, setGuiddeWordHtml] = useState("");
  const [guiddeWordKey, setGuiddeWordKey] = useState(0);
  const [stepForm, setStepForm] = useState({ title: "", description: "", timestamp: "", screenshot_url: "" });
  const [showAddStep, setShowAddStep] = useState(false);
  const [showGuideHelp, setShowGuideHelp] = useState(false);
  const [activeTab, setActiveTab] = useState<"setup" | "accademia">("setup");
  const [guiddeVideoUrl, setGuiddeVideoUrl] = useState("");
  const [inlineDownload, setInlineDownload] = useState<{
    lessonId: string | null;
    status: "idle" | "downloading" | "done" | "error";
    videoStatus?: "done" | "error";
    screenshotsDone: number;
    screenshotsTotal: number;
    errors: string[];
  }>({ lessonId: null, status: "idle", screenshotsDone: 0, screenshotsTotal: 0, errors: [] });

  const { data: modules = [], isLoading } = useQuery<AcademyModule[]>({
    queryKey: ["admin-academy-modules"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/modules`, { headers: getAuthHeaders() });
      const json = await res.json();
      return json.data || [];
    },
  });

  const setupModules = modules.filter(m => !m.slug.startsWith("pkg_"));
  const accademiaModules = modules.filter(m => m.slug.startsWith("pkg_"));
  const filteredModules = activeTab === "setup" ? setupModules : accademiaModules;

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const totalVideos = modules.reduce((acc, m) => acc + m.lessons.reduce((a, l) => a + (l.videos?.length || 0) + (l.video_url ? 1 : 0), 0), 0);
  const totalDocs = modules.reduce((acc, m) => acc + m.lessons.reduce((a, l) => a + l.documents.length, 0), 0);
  const totalSteps = modules.reduce((acc, m) => acc + m.lessons.reduce((a, l) => a + (l.steps?.length || 0), 0), 0);

  const setupLessons = setupModules.reduce((acc, m) => acc + m.lessons.length, 0);
  const accademiaLessons = accademiaModules.reduce((acc, m) => acc + m.lessons.length, 0);

  const toggleModule = (id: string) => {
    const next = new Set(expandedModules);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedModules(next);
  };

  const saveMutation = useMutation({
    mutationFn: async ({ url, method, body }: { url: string; method: string; body?: any }) => {
      const res = await fetch(url, {
        method,
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Errore sconosciuto" }));
        throw new Error(err.error || "Errore nel salvataggio");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-academy-modules"] });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const handleSaveModule = async (moduleId: string) => {
    await saveMutation.mutateAsync({ url: `${API_BASE}/admin/modules/${moduleId}`, method: "PUT", body: moduleForm });
    setEditingModule(null);
    toast({ title: "Modulo aggiornato" });
  };

  const handleCreateModule = async () => {
    if (!moduleForm.title || !moduleForm.slug) {
      toast({ title: "Errore", description: "Titolo e slug sono richiesti", variant: "destructive" });
      return;
    }
    await saveMutation.mutateAsync({ url: `${API_BASE}/admin/modules`, method: "POST", body: moduleForm });
    setShowNewModule(false);
    setModuleForm({ slug: "", title: "", emoji: "", tagline: "", color: "slate" });
    toast({ title: "Modulo creato" });
  };

  const handleSaveLesson = async (lessonId: string) => {
    if (lessonForm.video_url && !isValidVideoUrl(lessonForm.video_url)) {
      toast({ title: "URL video non valido", description: "Inserisci un URL completo (es: https://...) oppure lascia il campo vuoto", variant: "destructive" });
      return;
    }
    await saveMutation.mutateAsync({
      url: `${API_BASE}/admin/lessons/${lessonId}`,
      method: "PUT",
      body: { ...lessonForm, video_url: lessonForm.video_url || null },
    });
    setEditingLesson(null);
    toast({ title: "Lezione aggiornata" });
  };

  const handleCreateLesson = async (moduleId: string) => {
    if (!lessonForm.title || !lessonForm.lesson_id) {
      toast({ title: "Errore", description: "ID e titolo sono richiesti", variant: "destructive" });
      return;
    }
    if (lessonForm.video_url && !isValidVideoUrl(lessonForm.video_url)) {
      toast({ title: "URL video non valido", description: "Inserisci un URL completo (es: https://...) oppure lascia il campo vuoto", variant: "destructive" });
      return;
    }
    await saveMutation.mutateAsync({
      url: `${API_BASE}/admin/lessons`,
      method: "POST",
      body: { ...lessonForm, module_id: moduleId, video_url: lessonForm.video_url || null },
    });
    setShowNewLesson(null);
    setLessonForm({ lesson_id: "", title: "", description: "", duration: "5 min", video_url: "", video_type: "iframe", config_link: "/" });
    toast({ title: "Lezione creata" });
  };

  const handleAddDoc = async (lessonId: string) => {
    if (!docForm.title || !docForm.file_url) {
      toast({ title: "Errore", description: "Titolo e URL sono richiesti", variant: "destructive" });
      return;
    }
    if (!isValidVideoUrl(docForm.file_url)) {
      toast({ title: "URL non valido", description: "Inserisci un URL completo valido (es: https://...)", variant: "destructive" });
      return;
    }
    await saveMutation.mutateAsync({ url: `${API_BASE}/admin/lessons/${lessonId}/documents`, method: "POST", body: docForm });
    setShowNewDoc(null);
    setDocForm({ title: "", file_url: "", file_type: "link" });
    toast({ title: "Documento aggiunto" });
  };

  const isValidVideoUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  };

  const handleAddVideo = async (lessonId: string) => {
    if (!videoForm.video_url) {
      toast({ title: "Errore", description: "URL video richiesto", variant: "destructive" });
      return;
    }
    if (!isValidVideoUrl(videoForm.video_url)) {
      toast({ title: "URL non valido", description: "Inserisci un URL completo valido (es: https://www.youtube.com/watch?v=...)", variant: "destructive" });
      return;
    }
    if (!videoForm.title.trim()) {
      toast({ title: "Errore", description: "Il titolo del video e' obbligatorio", variant: "destructive" });
      return;
    }
    await saveMutation.mutateAsync({
      url: `${API_BASE}/admin/lessons/${lessonId}/videos`,
      method: "POST",
      body: videoForm,
    });
    setShowNewVideo(null);
    setVideoForm({ title: "", video_url: "", video_type: "youtube" });
    toast({ title: "Video aggiunto" });
  };

  const handleParseGuidde = async (lessonId: string) => {
    if (!guiddeEmbedCode.trim()) {
      toast({ title: "Errore", description: "Incolla il codice embed di Guidde", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/parse-guidde`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ html: guiddeEmbedCode }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const { embedUrl, steps } = data.data;
      if (steps.length === 0 && !embedUrl) {
        toast({ title: "Nessun dato trovato", description: "Il codice embed non contiene step riconoscibili", variant: "destructive" });
        return;
      }

      const stepsWithoutScreenshots = steps.map((s: any) => ({ ...s, screenshot_url: undefined }));

      const bulkRes = await fetch(`${API_BASE}/admin/lessons/${lessonId}/steps/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ steps: stepsWithoutScreenshots, guide_embed_url: embedUrl || undefined }),
      });
      const bulkData = await bulkRes.json();
      if (!bulkData.success) throw new Error(bulkData.error);
      queryClient.invalidateQueries({ queryKey: ["admin-academy-modules"] });
      setGuiddeEmbedCode(""); setGuiddeEmbedKey(k => k + 1);

      const videoToDownload = guiddeVideoUrl.trim().startsWith('http') ? guiddeVideoUrl.trim() : (embedUrl || '');
      if (embedUrl) {
        setGuiddeVideoUrl(embedUrl);
      }

      toast({
        title: `${steps.length} step importati!`,
        description: `${embedUrl ? "Embed URL estratto. " : ""}Ora puoi aggiungere gli screenshot con "Copia per Word".`
      });

      if (videoToDownload.startsWith('http')) {
        await handleDownloadMediaInline(lessonId, videoToDownload, []);
      }
    } catch (err: any) {
      toast({ title: "Errore parsing", description: err.message, variant: "destructive" });
    }
  };

  const handleImportScreenshots = async (lessonId: string) => {
    if (!guiddeWordHtml.trim()) {
      toast({ title: "Errore", description: "Incolla l'HTML da 'Copia per Word' di Guidde", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/lessons/${lessonId}/import-screenshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ html: guiddeWordHtml }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      queryClient.invalidateQueries({ queryKey: ["admin-academy-modules"] });
      setGuiddeWordHtml(""); setGuiddeWordKey(k => k + 1);

      const stepsWithScreenshots = (data.data || [])
        .filter((s: any) => s.screenshot_url && s.screenshot_url.startsWith('http'))
        .map((s: any) => ({ step_id: s.id, screenshot_url: s.screenshot_url }));

      toast({
        title: `${data.updatedCount} screenshot associati!`,
        description: `${data.totalImages} immagini trovate, ${data.updatedCount} assegnate agli step. Download in corso...`
      });

      if (stepsWithScreenshots.length > 0) {
        const videoUrl = guiddeVideoUrl.trim().startsWith('http') ? guiddeVideoUrl.trim() : undefined;
        await handleDownloadMediaInline(lessonId, videoUrl, stepsWithScreenshots);
      }
    } catch (err: any) {
      toast({ title: "Errore import screenshot", description: err.message, variant: "destructive" });
    }
  };

  const handleAddStepToLesson = async (lessonId: string) => {
    if (!stepForm.title.trim()) {
      toast({ title: "Errore", description: "Titolo step richiesto", variant: "destructive" });
      return;
    }
    await saveMutation.mutateAsync({
      url: `${API_BASE}/admin/lessons/${lessonId}/steps`,
      method: "POST",
      body: stepForm,
    });
    setStepForm({ title: "", description: "", timestamp: "", screenshot_url: "" });
    setShowAddStep(false);
    toast({ title: "Step aggiunto" });
  };

  const handleDeleteStepItem = async (stepId: string) => {
    await saveMutation.mutateAsync({
      url: `${API_BASE}/admin/steps/${stepId}`,
      method: "DELETE",
      body: {},
    });
    toast({ title: "Step eliminato" });
  };

  const handleUpdateGuideSettings = async (lessonId: string, settings: { guide_embed_url?: string; guide_display_mode?: string }) => {
    await saveMutation.mutateAsync({
      url: `${API_BASE}/admin/lessons/${lessonId}/guide-settings`,
      method: "PUT",
      body: settings,
    });
    toast({ title: "Impostazioni guida aggiornate" });
  };

  const handleDownloadMediaInline = async (lessonId: string, videoUrl?: string, stepsToDownload?: Array<{ step_id: string; screenshot_url: string }>) => {
    const lesson = modules.flatMap(m => m.lessons).find(l => l.id === lessonId);
    const stepsWithScreenshots = stepsToDownload ?? (lesson?.steps || [])
      .filter(s => s.screenshot_url && s.screenshot_url.startsWith('http'))
      .map(s => ({ step_id: s.id, screenshot_url: s.screenshot_url! }));
    const hasVideo = !!videoUrl;

    if (!hasVideo && stepsWithScreenshots.length === 0) {
      toast({ title: "Nessun media da scaricare", description: "Nessuno screenshot da scaricare e nessun URL video", variant: "destructive" });
      return;
    }

    setInlineDownload({ lessonId, status: "downloading", screenshotsDone: 0, screenshotsTotal: stepsWithScreenshots.length, videoStatus: hasVideo ? undefined : undefined, errors: [] });

    try {
      const res = await fetch(`${API_BASE}/admin/lessons/${lessonId}/download-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ video_url: videoUrl, step_screenshots: stepsWithScreenshots }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const result = data.data;
      const errors = (result.screenshots || []).filter((s: any) => !s.success).map((s: any) => s.error || 'Errore');
      if (result.video && !result.video.success) errors.push(`Video: ${result.video.error || 'errore'}`);

      setInlineDownload({
        lessonId,
        status: errors.length > 0 ? "error" : "done",
        videoStatus: result.video ? (result.video.success ? "done" : "error") : undefined,
        screenshotsDone: (result.screenshots || []).filter((s: any) => s.success).length,
        screenshotsTotal: stepsWithScreenshots.length,
        errors,
      });

      queryClient.invalidateQueries({ queryKey: ["admin-academy-modules"] });
    } catch (err: any) {
      setInlineDownload(p => ({ ...p, status: "error", errors: [err.message] }));
    }
  };

  const initiateDelete = (type: DeleteState["type"], id: string, name: string) => {
    setDeleteState({ type, id, name, step: 1, confirmText: "" });
  };

  const handleDeleteStep = async () => {
    if (!deleteState) return;
    if (deleteState.step < 3) {
      setDeleteState({ ...deleteState, step: deleteState.step + 1 });
      return;
    }
    if (deleteState.confirmText !== "CONFERMA") {
      toast({ title: "Errore", description: "Devi scrivere CONFERMA per procedere", variant: "destructive" });
      return;
    }
    if (deleteState.type === "all-steps-and-media") {
      await saveMutation.mutateAsync({ url: `${API_BASE}/admin/lessons/${deleteState.id}/local-media`, method: "DELETE" });
      await saveMutation.mutateAsync({ url: `${API_BASE}/admin/lessons/${deleteState.id}/all-steps`, method: "DELETE" });
      setDeleteState(null);
      toast({ title: "Step e media eliminati con successo" });
      return;
    }
    const urlMap: Record<string, string> = {
      module: `${API_BASE}/admin/modules/${deleteState.id}`,
      lesson: `${API_BASE}/admin/lessons/${deleteState.id}`,
      document: `${API_BASE}/admin/documents/${deleteState.id}`,
      video: `${API_BASE}/admin/videos/${deleteState.id}`,
      "all-steps": `${API_BASE}/admin/lessons/${deleteState.id}/all-steps`,
      "local-media": `${API_BASE}/admin/lessons/${deleteState.id}/local-media`,
      "local-video": `${API_BASE}/admin/lessons/${deleteState.id}/local-video`,
      "local-screenshots": `${API_BASE}/admin/lessons/${deleteState.id}/local-screenshots`,
    };
    await saveMutation.mutateAsync({ url: urlMap[deleteState.type], method: "DELETE" });
    setDeleteState(null);
    const labels: Record<string, string> = { module: "Modulo", lesson: "Lezione", document: "Documento", video: "Video", "all-steps": "Tutti gli step", "local-media": "Media locali", "local-video": "Video locale", "local-screenshots": "Screenshot" };
    const plural = ["all-steps", "local-media", "local-screenshots"].includes(deleteState.type);
    toast({ title: `${labels[deleteState.type]} eliminat${plural ? "i" : "o"} con successo` });
  };

  const handleReorderModules = async (moduleId: string, direction: "up" | "down") => {
    const idx = modules.findIndex(m => m.id === moduleId);
    if ((direction === "up" && idx <= 0) || (direction === "down" && idx >= modules.length - 1)) return;
    const newOrder = modules.map(m => m.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    await saveMutation.mutateAsync({ url: `${API_BASE}/admin/modules/reorder`, method: "PUT", body: { order: newOrder } });
  };

  const handleReorderLessons = async (lesson: AcademyLesson, direction: "up" | "down") => {
    const mod = modules.find(m => m.id === lesson.module_id);
    if (!mod) return;
    const idx = mod.lessons.findIndex(l => l.id === lesson.id);
    if ((direction === "up" && idx <= 0) || (direction === "down" && idx >= mod.lessons.length - 1)) return;
    const newOrder = mod.lessons.map(l => l.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    await saveMutation.mutateAsync({ url: `${API_BASE}/admin/lessons/reorder`, method: "PUT", body: { order: newOrder } });
  };

  const startEditModule = (m: AcademyModule) => {
    setEditingModule(m.id);
    setModuleForm({ slug: m.slug, title: m.title, emoji: m.emoji, tagline: m.tagline, color: m.color });
  };

  const startEditLesson = (l: AcademyLesson) => {
    setEditingLesson(l.id);
    setLessonForm({
      lesson_id: l.lesson_id,
      title: l.title,
      description: l.description,
      duration: l.duration,
      video_url: l.video_url || "",
      video_type: l.video_type || "iframe",
      config_link: l.config_link,
    });
  };

  const getDeleteStepContent = () => {
    if (!deleteState) return null;
    const typeLabels: Record<string, string> = {
      module: "il modulo", lesson: "la lezione", document: "il documento", video: "il video",
      "all-steps": "tutti gli step", "local-media": "i media locali",
      "local-video": "il video locale", "local-screenshots": "gli screenshot",
      "all-steps-and-media": "tutti gli step e media",
    };
    const label = typeLabels[deleteState.type];

    const extraWarning = deleteState.type === "module"
      ? " Tutte le lezioni, video e documenti del modulo verranno eliminati permanentemente."
      : deleteState.type === "all-steps"
      ? " Tutti gli step della guida verranno rimossi. Dovrai reimportarli da Guidde o aggiungerli manualmente."
      : deleteState.type === "local-media"
      ? " Il video e gli screenshot scaricati verranno eliminati dal server."
      : deleteState.type === "local-video"
      ? " Il file video locale verra' eliminato dal server."
      : deleteState.type === "local-screenshots"
      ? " Tutti gli screenshot verranno rimossi dagli step."
      : deleteState.type === "all-steps-and-media"
      ? " Tutti gli step, screenshot e il video locale verranno eliminati permanentemente."
      : "";

    if (deleteState.step === 1) {
      return {
        icon: <AlertTriangle className="h-12 w-12 text-amber-500" />,
        title: "Sei sicuro?",
        description: `Stai per eliminare ${label} "${deleteState.name}".${extraWarning}`,
        buttonLabel: "Continua",
        buttonVariant: "outline" as const,
      };
    }
    if (deleteState.step === 2) {
      return {
        icon: <Shield className="h-12 w-12 text-orange-500" />,
        title: "Conferma eliminazione",
        description: `Questa azione e' irreversibile. ${label} "${deleteState.name}" ${["all-steps", "local-media", "local-screenshots", "all-steps-and-media"].includes(deleteState.type) ? "verranno eliminati" : "verra' eliminato"} definitivamente.${deleteState.type === "module" ? " Include tutte le lezioni associate, i loro video e documenti." : ""}`,
        buttonLabel: "Procedi all'eliminazione",
        buttonVariant: "outline" as const,
      };
    }
    return {
      icon: <Trash2 className="h-12 w-12 text-red-500" />,
      title: "Ultima conferma",
      description: `Per procedere, scrivi CONFERMA nel campo qui sotto.`,
      buttonLabel: "Elimina definitivamente",
      buttonVariant: "destructive" as const,
      showInput: true,
    };
  };

  const getModuleGradient = (color: string) => MODULE_GRADIENT[color] || MODULE_GRADIENT.slate;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-indigo-50/30 dark:from-gray-950 dark:via-gray-950 dark:to-indigo-950/20">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-6xl mx-auto w-full">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                {isMobile && (
                  <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                    <Menu size={20} />
                  </Button>
                )}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl blur-lg opacity-30" />
                  <div className="relative p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
                    <GraduationCap className="h-7 w-7 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                    Gestione Academy
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Gestisci moduli, lezioni, video e documenti
                  </p>
                </div>
              </div>
              <Button
                onClick={() => { setShowNewModule(true); setModuleForm({ slug: "", title: "", emoji: "", tagline: "", color: "slate" }); }}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 transition-all hover:shadow-xl hover:scale-[1.02]"
              >
                <Plus size={16} className="mr-1.5" /> Nuovo Modulo
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200/60 dark:border-gray-800 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
                    <BookOpen size={18} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{modules.length}</p>
                    <p className="text-xs text-gray-500">Moduli</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200/60 dark:border-gray-800 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/40">
                    <GraduationCap size={18} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalLessons}</p>
                    <p className="text-xs text-gray-500">Lezioni</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200/60 dark:border-gray-800 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/40">
                    <PlayCircle size={18} className="text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalVideos}</p>
                    <p className="text-xs text-gray-500">Video</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200/60 dark:border-gray-800 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                    <FileText size={18} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalDocs}</p>
                    <p className="text-xs text-gray-500">Documenti</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200/60 dark:border-gray-800 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
                    <ListOrdered size={18} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalSteps}</p>
                    <p className="text-xs text-gray-500">Guide Step</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setActiveTab("setup")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "setup"
                      ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  <Settings size={16} />
                  <span>Setup Base</span>
                  <Badge className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-0 px-1.5">
                    {setupModules.length} mod / {setupLessons} lez
                  </Badge>
                </button>
                <button
                  onClick={() => setActiveTab("accademia")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "accademia"
                      ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  <GraduationCap size={16} />
                  <span>Accademia</span>
                  <Badge className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-0 px-1.5">
                    {accademiaModules.length} mod / {accademiaLessons} lez
                  </Badge>
                </button>
              </div>

              <button
                onClick={() => setShowGuideHelp(!showGuideHelp)}
                className={`ml-auto flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                  showGuideHelp
                    ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-indigo-600 hover:border-indigo-200"
                }`}
              >
                <HelpCircle size={14} />
                Come usare le Guide
              </button>
            </div>

            {showGuideHelp && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-indigo-200/60 dark:border-indigo-800/40 shadow-sm overflow-hidden">
                <div className="p-5 space-y-5">

                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Apri il gestore step</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Espandi un modulo, trova la lezione e clicca <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[11px] font-medium"><ListOrdered size={10} /> Guide Step</span></p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Aggiungi step (2 metodi)</h4>
                      <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/20">
                          <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">A) Importa da Guidde</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">Incolla l'HTML embed di Guidde e clicca "Importa Step". Estrae automaticamente tutti i passaggi.</p>
                        </div>
                        <div className="p-3 bg-green-50/50 dark:bg-green-950/20 rounded-lg border border-green-100 dark:border-green-900/20">
                          <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">B) Manualmente</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">Clicca "Aggiungi Step Manualmente" e compila titolo, timestamp, descrizione e screenshot URL.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Scegli la modalita'</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1"><strong>Solo Nativa</strong> = step creati qui | <strong>Solo Embed</strong> = iframe Guidde | <strong>Entrambi</strong> = tab per scegliere</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">4</span>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Verifica su /consultant/academy</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Apri la lezione lato consulente e sotto il video vedrai la "Guida Passo-Passo" con indice laterale e step numerati.</p>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
              <p className="text-sm text-gray-500">Caricamento moduli...</p>
            </div>
          ) : modules.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-300 dark:border-gray-700">
              <CardContent className="py-20 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center">
                  <BookOpen className="h-10 w-10 text-indigo-500 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nessun modulo ancora</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">Crea il primo modulo per iniziare a costruire il percorso formativo della tua academy.</p>
                <Button
                  onClick={() => { setShowNewModule(true); setModuleForm({ slug: "", title: "", emoji: "", tagline: "", color: "slate" }); }}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                >
                  <Plus size={16} className="mr-1.5" /> Crea il primo modulo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredModules.length === 0 && !isLoading && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-sm">Nessun modulo in questa sezione</p>
                </div>
              )}
              {filteredModules.map((mod, modIdx) => (
                <div key={mod.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-gray-800 shadow-sm overflow-hidden transition-all hover:shadow-md">
                  <div
                    className="flex items-center gap-3 px-5 py-4 cursor-pointer transition-colors group"
                    onClick={() => toggleModule(mod.id)}
                  >
                    <div className="flex flex-col gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleReorderModules(mod.id, "up"); }} disabled={modIdx === 0}>
                        <ArrowUp size={13} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleReorderModules(mod.id, "down"); }} disabled={modIdx === filteredModules.length - 1}>
                        <ArrowDown size={13} />
                      </Button>
                    </div>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getModuleGradient(mod.color)} flex items-center justify-center text-2xl shadow-sm shrink-0`}>
                      {mod.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-[15px]">{mod.title}</h3>
                        <Badge className="text-[10px] bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 font-medium border-0">
                          {mod.lessons.length} {mod.lessons.length === 1 ? "lezione" : "lezioni"}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{mod.tagline}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-50 hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); startEditModule(mod); }}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 opacity-50 hover:opacity-100 hover:text-red-600 transition-all" onClick={(e) => { e.stopPropagation(); initiateDelete("module", mod.id, mod.title); }}>
                        <Trash2 size={14} />
                      </Button>
                      <div className="w-6 flex justify-center">
                        {expandedModules.has(mod.id) ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                      </div>
                    </div>
                  </div>

                  {editingModule === mod.id && (
                    <div className="px-5 py-4 bg-gradient-to-r from-indigo-50/80 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/20 border-t border-b border-indigo-100 dark:border-indigo-900/30">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                          <Label className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Slug</Label>
                          <Input value={moduleForm.slug} onChange={e => setModuleForm(f => ({ ...f, slug: e.target.value }))} placeholder="slug_modulo" className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Titolo</Label>
                          <Input value={moduleForm.title} onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Emoji</Label>
                          <Input value={moduleForm.emoji} onChange={e => setModuleForm(f => ({ ...f, emoji: e.target.value }))} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Colore</Label>
                          <Select value={moduleForm.color} onValueChange={v => setModuleForm(f => ({ ...f, color: v }))}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {COLOR_OPTIONS.map(c => (
                                <SelectItem key={c.value} value={c.value}>
                                  <span className="flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded-full ${c.bg}`} />
                                    {c.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-4">
                          <Label className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Tagline</Label>
                          <Input value={moduleForm.tagline} onChange={e => setModuleForm(f => ({ ...f, tagline: e.target.value }))} className="mt-1" />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button size="sm" onClick={() => handleSaveModule(mod.id)} disabled={saveMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                          <Save size={14} className="mr-1.5" /> Salva Modulo
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingModule(null)}>
                          <X size={14} className="mr-1" /> Annulla
                        </Button>
                      </div>
                    </div>
                  )}

                  {expandedModules.has(mod.id) && (
                    <div className="border-t border-gray-100 dark:border-gray-800">
                      {mod.lessons.length === 0 ? (
                        <div className="px-5 py-10 text-center">
                          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                            <BookOpen size={20} className="text-gray-400" />
                          </div>
                          <p className="text-gray-400 text-sm">Nessuna lezione in questo modulo</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                          {mod.lessons.map((lesson, lIdx) => {
                            const videoCount = (lesson.video_url ? 1 : 0) + (lesson.videos?.length || 0);
                            const docCount = lesson.documents.length;
                            const stepCount = lesson.steps?.length || 0;
                            const allVideos: Array<{ id: string; title: string; video_url: string; video_type: string; isLegacy?: boolean }> = [];
                            if (lesson.video_url) allVideos.push({ id: "legacy", title: "Video principale", video_url: lesson.video_url, video_type: lesson.video_type, isLegacy: true });
                            if (lesson.videos) lesson.videos.forEach(v => allVideos.push({ ...v }));

                            return (
                            <div key={lesson.id} className="mx-4 my-3 group/lesson">
                              <div className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200/80 dark:border-gray-800 overflow-hidden transition-shadow hover:shadow-md`}>
                                <div className="flex items-start gap-3 p-4">
                                  <div className="flex flex-col items-center gap-0.5 pt-0.5">
                                    <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover/lesson:opacity-60 hover:!opacity-100 transition-opacity" onClick={() => handleReorderLessons(lesson, "up")} disabled={lIdx === 0}>
                                      <ArrowUp size={10} />
                                    </Button>
                                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getModuleGradient(mod.color)} flex items-center justify-center text-white text-sm font-semibold shrink-0 shadow-sm`}>
                                      {lIdx + 1}
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover/lesson:opacity-60 hover:!opacity-100 transition-opacity" onClick={() => handleReorderLessons(lesson, "down")} disabled={lIdx === mod.lessons.length - 1}>
                                      <ArrowDown size={10} />
                                    </Button>
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-[15px] font-semibold text-gray-900 dark:text-white leading-tight">{lesson.title}</h4>
                                      {(videoCount > 0 || docCount > 0 || stepCount > 0) ? (
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Ha contenuti" />
                                      ) : (
                                        <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" title="Nessun contenuto" />
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[11px] font-mono">{lesson.lesson_id}</span>
                                      <span className="inline-flex items-center gap-1 text-[12px] text-gray-400 dark:text-gray-500">
                                        <Clock size={10} /> {lesson.duration}
                                      </span>
                                      {lesson.config_link && lesson.config_link !== "/" && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500 text-[11px] font-mono">
                                          <Settings size={9} /> {lesson.config_link}
                                        </span>
                                      )}
                                    </div>

                                    <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed mt-2 line-clamp-2">{lesson.description}</p>

                                    {(videoCount > 0 || docCount > 0 || stepCount > 0) && (
                                      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                                        {videoCount > 0 && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[11px] font-medium">
                                            <Film size={10} className="text-gray-400" /> {videoCount} video
                                          </span>
                                        )}
                                        {docCount > 0 && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[11px] font-medium">
                                            <FileText size={10} className="text-gray-400" /> {docCount} doc
                                          </span>
                                        )}
                                        {stepCount > 0 && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[11px] font-medium">
                                            <ListOrdered size={10} className="text-gray-400" /> {stepCount} step
                                          </span>
                                        )}
                                        {(() => {
                                          const localShots = (lesson.steps || []).filter((s: any) => s.screenshot_url && !s.screenshot_url.startsWith('http')).length;
                                          const totalShots = (lesson.steps || []).filter((s: any) => s.screenshot_url).length;
                                          if (localShots === 0) return null;
                                          const allLocal = localShots === totalShots;
                                          return (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${allLocal ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400'}`}>
                                              <HardDrive size={10} /> {localShots}/{totalShots} locale
                                            </span>
                                          );
                                        })()}
                                        {lesson.guide_local_video_url && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-medium">
                                            <Film size={10} /> video locale
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {videoCount === 0 && docCount === 0 && stepCount === 0 && (
                                      <div className="flex items-center gap-1.5 mt-3">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                                        <span className="text-[11px] text-gray-400 dark:text-gray-500">Nessun contenuto ancora</span>
                                      </div>
                                    )}

                                    {allVideos.length > 0 && (
                                      <div className="mt-3 space-y-1">
                                        {allVideos.map((vid, vIdx) => (
                                          <div key={vid.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-gray-50 dark:bg-gray-800/40 group/vid">
                                            <PlayCircle size={12} className="text-gray-400 shrink-0" />
                                            <span className="text-[12px] text-gray-700 dark:text-gray-300 font-medium truncate flex-1">{vid.title || `Video ${vIdx + 1}`}</span>
                                            {vid.video_type === "youtube" ? (
                                              <a href={vid.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[10px] font-semibold hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors cursor-pointer shrink-0" title={vid.video_url}>
                                                <PlayCircle size={9} /> YT
                                              </a>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[10px] font-semibold shrink-0">Embed</span>
                                            )}
                                            {!vid.isLegacy && (
                                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-100 md:opacity-0 md:group-hover/vid:opacity-100 md:focus:opacity-100 text-red-400 hover:text-red-600 transition-opacity" title="Rimuovi video" onClick={() => initiateDelete("video", vid.id, vid.title || `Video ${vIdx + 1}`)}>
                                                <Trash2 size={10} />
                                              </Button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {lesson.documents.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        {lesson.documents.map(doc => (
                                          <div key={doc.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-gray-50 dark:bg-gray-800/40 group/doc">
                                            <FileText size={12} className="text-gray-400 shrink-0" />
                                            <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-gray-700 dark:text-gray-300 font-medium truncate flex-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                              {doc.title}
                                            </a>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-200/60 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-[10px] font-medium uppercase shrink-0">
                                              {doc.file_type}
                                            </span>
                                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-100 md:opacity-0 md:group-hover/doc:opacity-100 md:focus:opacity-100 text-red-400 hover:text-red-600 transition-opacity" title="Rimuovi documento" onClick={() => initiateDelete("document", doc.id, doc.title)}>
                                              <Trash2 size={10} />
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-dashed border-gray-200 dark:border-gray-800">
                                      <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-1">Aggiungi</span>
                                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 rounded-md" onClick={() => { setShowNewVideo(lesson.id); setVideoForm({ title: "", video_url: "", video_type: "youtube" }); }}>
                                        <Video size={11} /> Video
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 rounded-md" onClick={() => { setShowNewDoc(lesson.id); setDocForm({ title: "", file_url: "", file_type: "link" }); }}>
                                        <FileText size={11} /> Doc
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 rounded-md" onClick={() => setShowStepManager(showStepManager === lesson.id ? null : lesson.id)}>
                                        <ListOrdered size={11} /> Step
                                      </Button>
                                      <div className="flex-1" />
                                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-100 md:opacity-0 md:group-hover/lesson:opacity-100 md:focus:opacity-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-md transition-opacity" title="Modifica lezione" onClick={() => startEditLesson(lesson)}>
                                        <Pencil size={12} />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-100 md:opacity-0 md:group-hover/lesson:opacity-100 md:focus:opacity-100 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-opacity" title="Elimina lezione" onClick={() => initiateDelete("lesson", lesson.id, lesson.title)}>
                                        <Trash2 size={12} />
                                      </Button>
                                    </div>
                                  </div>
                                </div>

                                {editingLesson === lesson.id && (
                                  <div className="border-t border-gray-200 dark:border-gray-800">
                                    <div className="p-4 bg-gray-50/50 dark:bg-gray-800/20">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="w-1 h-4 rounded-full bg-blue-500" />
                                        <h4 className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Modifica lezione</h4>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                          <Label className="text-[11px] text-gray-500 dark:text-gray-400">ID lezione</Label>
                                          <Input value={lessonForm.lesson_id} onChange={e => setLessonForm(f => ({ ...f, lesson_id: e.target.value }))} className="mt-1 h-10 text-sm rounded-md" />
                                        </div>
                                        <div>
                                          <Label className="text-[11px] text-gray-500 dark:text-gray-400">Titolo</Label>
                                          <Input value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} className="mt-1 h-10 text-sm rounded-md" />
                                        </div>
                                        <div>
                                          <Label className="text-[11px] text-gray-500 dark:text-gray-400">Durata</Label>
                                          <Input value={lessonForm.duration} onChange={e => setLessonForm(f => ({ ...f, duration: e.target.value }))} placeholder="5 min" className="mt-1 h-10 text-sm rounded-md" />
                                        </div>
                                        <div className="md:col-span-3">
                                          <Label className="text-[11px] text-gray-500 dark:text-gray-400">Descrizione</Label>
                                          <Textarea value={lessonForm.description} onChange={e => setLessonForm(f => ({ ...f, description: e.target.value }))} rows={2} className="mt-1 text-sm rounded-md" />
                                        </div>
                                        <div className="md:col-span-2">
                                          <Label className="text-[11px] text-gray-500 dark:text-gray-400">Video URL principale (legacy)</Label>
                                          <Input value={lessonForm.video_url} onChange={e => setLessonForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://..." className="mt-1 h-10 text-sm rounded-md" />
                                        </div>
                                        <div>
                                          <Label className="text-[11px] text-gray-500 dark:text-gray-400">Tipo Video</Label>
                                          <Select value={lessonForm.video_type} onValueChange={v => setLessonForm(f => ({ ...f, video_type: v }))}>
                                            <SelectTrigger className="mt-1 h-10 text-sm rounded-md"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="youtube">YouTube</SelectItem>
                                              <SelectItem value="iframe">Iframe (Guidde, ecc.)</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="md:col-span-3">
                                          <Label className="text-[11px] text-gray-500 dark:text-gray-400">Link configurazione</Label>
                                          <Input value={lessonForm.config_link} onChange={e => setLessonForm(f => ({ ...f, config_link: e.target.value }))} placeholder="/consultant/..." className="mt-1 h-10 text-sm rounded-md" />
                                        </div>
                                      </div>
                                      <div className="flex gap-2 mt-4">
                                        <Button size="sm" onClick={() => handleSaveLesson(lesson.id)} disabled={saveMutation.isPending} className="h-9 px-4 text-xs rounded-md bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white">
                                          <Save size={13} className="mr-1.5" /> Salva modifiche
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setEditingLesson(null)} className="h-9 px-4 text-xs rounded-md">
                                          Annulla
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {showStepManager === lesson.id && (
                                  <div className="border-t border-gray-200 dark:border-gray-800">
                                    <div className="p-4 bg-gray-50/50 dark:bg-gray-800/20">
                                      <div className="flex items-center gap-2 mb-4">
                                        <div className="w-1 h-4 rounded-full bg-blue-500" />
                                        <h4 className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Gestione guide step-by-step</h4>
                                        <div className="flex-1" />
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600" onClick={() => setShowStepManager(null)}>
                                          <X size={14} />
                                        </Button>
                                      </div>

                                      <div className="mb-4 p-3 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Hash size={13} className="text-indigo-400" />
                                          <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300">1. Importa step da codice embed</span>
                                          <span className="text-[10px] text-gray-400 ml-auto">Guidde → Share → Embed code</span>
                                        </div>
                                        <div className="relative mb-2">
                                          <div
                                            key={guiddeEmbedKey}
                                            contentEditable
                                            suppressContentEditableWarning
                                            className="min-h-[50px] max-h-[100px] overflow-y-auto p-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 dark:text-gray-200"
                                            onPaste={(e) => {
                                              e.preventDefault();
                                              const htmlData = e.clipboardData.getData('text/html');
                                              const textData = e.clipboardData.getData('text/plain');
                                              const content = htmlData || textData || '';
                                              setGuiddeEmbedCode(content);
                                              const pCount = (content.match(/<p>/gi) || []).length;
                                              const hasIframe = /<iframe/i.test(content);
                                              (e.target as HTMLElement).innerText = `Embed incollato${hasIframe ? ' (iframe trovato)' : ''} — ${pCount} paragrafi`;
                                            }}
                                            onInput={(e) => {
                                              if (!guiddeEmbedCode) {
                                                setGuiddeEmbedCode((e.target as HTMLElement).innerText || '');
                                              }
                                            }}
                                          />
                                          {!guiddeEmbedCode && (
                                            <span className="absolute top-2 left-2 text-gray-400 dark:text-gray-500 text-sm pointer-events-none select-none">
                                              Incolla qui il codice embed di Guidde (iframe + step con timestamp)...
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex gap-2">
                                          <Button size="sm" onClick={() => handleParseGuidde(lesson.id)} disabled={!guiddeEmbedCode.trim()} className="h-9 px-4 text-xs rounded-md bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white">
                                            <ListOrdered size={12} className="mr-1.5" /> Importa step
                                          </Button>
                                          {guiddeEmbedCode && (
                                            <Button size="sm" variant="ghost" onClick={() => { setGuiddeEmbedCode(""); setGuiddeEmbedKey(k => k + 1); }} className="h-9 px-2 text-xs">
                                              <X size={12} />
                                            </Button>
                                          )}
                                        </div>
                                      </div>

                                      <div className={`mb-4 p-3 rounded-md border ${(lesson.steps?.length ?? 0) > 0 ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700' : 'bg-gray-50 dark:bg-gray-900/50 border-dashed border-gray-300 dark:border-gray-700'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                          <ClipboardPaste size={13} className={(lesson.steps?.length ?? 0) > 0 ? "text-emerald-400" : "text-gray-300"} />
                                          <span className={`text-[12px] font-medium ${(lesson.steps?.length ?? 0) > 0 ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>2. Associa screenshot (Copia per Word)</span>
                                          {(lesson.steps?.length ?? 0) === 0 && (
                                            <span className="text-[10px] text-gray-400 italic ml-auto">Prima importa gli step</span>
                                          )}
                                        </div>
                                        {(lesson.steps?.length ?? 0) > 0 ? (
                                          <>
                                            <div className="relative mb-2">
                                              <div
                                                key={guiddeWordKey}
                                                contentEditable
                                                suppressContentEditableWarning
                                                className="min-h-[50px] max-h-[100px] overflow-y-auto p-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-emerald-300 text-gray-700 dark:text-gray-200"
                                                onPaste={(e) => {
                                                  e.preventDefault();
                                                  const htmlData = e.clipboardData.getData('text/html');
                                                  const textData = e.clipboardData.getData('text/plain');
                                                  if (htmlData) {
                                                    setGuiddeWordHtml(htmlData);
                                                    const imgCount = (htmlData.match(/<img/gi) || []).length;
                                                    const screenshotCount = imgCount > 0 ? imgCount - 1 : 0;
                                                    (e.target as HTMLElement).innerText = `HTML incollato — ${screenshotCount} screenshot trovati`;
                                                  } else if (textData) {
                                                    setGuiddeWordHtml(textData);
                                                    (e.target as HTMLElement).innerText = textData.substring(0, 150) + '...';
                                                  }
                                                }}
                                              />
                                              {!guiddeWordHtml && (
                                                <span className="absolute top-2 left-2 text-gray-400 dark:text-gray-500 text-sm pointer-events-none select-none">
                                                  Guidde → "Copia per Word" → Ctrl+V qui (per gli screenshot)...
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex gap-2">
                                              <Button size="sm" onClick={() => handleImportScreenshots(lesson.id)} disabled={!guiddeWordHtml.trim()} className="h-9 px-4 text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white">
                                                <ClipboardPaste size={12} className="mr-1.5" /> Associa screenshot
                                              </Button>
                                              {guiddeWordHtml && (
                                                <Button size="sm" variant="ghost" onClick={() => { setGuiddeWordHtml(""); setGuiddeWordKey(k => k + 1); }} className="h-9 px-2 text-xs">
                                                  <X size={12} />
                                                </Button>
                                              )}
                                            </div>
                                          </>
                                        ) : (
                                          <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                            Gli screenshot vengono associati agli step per posizione. Importa prima gli step dal codice embed (sopra).
                                          </p>
                                        )}
                                      </div>

                                      <div className="mb-4 p-3 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Film size={13} className="text-blue-400" />
                                          <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300">3. Video URL</span>
                                        </div>
                                        <div className="flex gap-1.5">
                                          <Input
                                            value={guiddeVideoUrl}
                                            onChange={e => setGuiddeVideoUrl(e.target.value)}
                                            placeholder="URL video (tasto destro sul video → Copia indirizzo video)"
                                            className="h-9 text-xs rounded-md flex-1"
                                          />
                                          {guiddeVideoUrl.startsWith('http') && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-9 px-3 text-xs rounded-md shrink-0 gap-1"
                                              onClick={() => handleDownloadMediaInline(lesson.id, guiddeVideoUrl.trim(), [])}
                                              disabled={inlineDownload.status === "downloading"}
                                            >
                                              <Film size={11} /> Scarica video
                                            </Button>
                                          )}
                                        </div>
                                        {lesson.guide_embed_url && (
                                          <p className="text-[10px] text-gray-400 mt-1.5">Embed URL: {lesson.guide_embed_url}</p>
                                        )}
                                      </div>

                                      {inlineDownload.lessonId === lesson.id && inlineDownload.status !== "idle" && (
                                        <div className="mb-4 p-3 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                                          <div className="flex items-center gap-2 text-[11px]">
                                            {inlineDownload.status === "downloading" && <Loader2 size={11} className="animate-spin text-indigo-500" />}
                                            {inlineDownload.status === "done" && <div className="w-2.5 h-2.5 rounded-full bg-green-500" />}
                                            {inlineDownload.status === "error" && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                                            <span className="text-gray-600 dark:text-gray-300">
                                              {inlineDownload.status === "downloading" && "Download in corso..."}
                                              {inlineDownload.status === "done" && (() => {
                                                const hasLocalVideo = inlineDownload.videoStatus === "done" || !!lesson.guide_local_video_url;
                                                const localScreenshots = inlineDownload.screenshotsTotal > 0
                                                  ? inlineDownload.screenshotsDone
                                                  : (lesson.steps || []).filter((s: any) => s.screenshot_url && !s.screenshot_url.startsWith('http')).length;
                                                const totalScreenshots = inlineDownload.screenshotsTotal > 0
                                                  ? inlineDownload.screenshotsTotal
                                                  : (lesson.steps || []).filter((s: any) => s.screenshot_url).length;
                                                const parts: string[] = [];
                                                if (totalScreenshots > 0) parts.push(`${localScreenshots}/${totalScreenshots} screenshot`);
                                                if (hasLocalVideo) parts.push("video");
                                                return `Salvato in locale: ${parts.join(" + ")}`;
                                              })()}
                                              {inlineDownload.status === "error" && (
                                                inlineDownload.screenshotsTotal === 0
                                                  ? "Errore download video"
                                                  : `Completato con errori: ${inlineDownload.screenshotsDone}/${inlineDownload.screenshotsTotal} screenshot`
                                              )}
                                            </span>
                                          </div>
                                          {inlineDownload.errors.length > 0 && (
                                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">{inlineDownload.errors[0]}</p>
                                          )}
                                        </div>
                                      )}

                                      {inlineDownload.lessonId !== lesson.id && (lesson.steps || []).some(s => s.screenshot_url && s.screenshot_url.startsWith('http')) && (
                                        <div className="mb-4 p-2.5 flex items-center gap-2 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-900">
                                          <p className="text-[10px] text-blue-600 dark:text-blue-400 flex-1">Screenshot non ancora scaricati in locale.</p>
                                          <Button size="sm" variant="outline" onClick={() => handleDownloadMediaInline(lesson.id)} className="h-7 px-2 text-[10px] rounded gap-1">
                                            <Film size={10} /> Scarica ora
                                          </Button>
                                        </div>
                                      )}

                                      <div className="mb-4 p-3 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center gap-2 mb-2">
                                          <Settings size={13} className="text-gray-400" />
                                          <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300">Impostazioni guida</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                          <div>
                                            <Label className="text-[11px] text-gray-500 dark:text-gray-400">Embed URL Guidde</Label>
                                            <Input
                                              defaultValue={lesson.guide_embed_url || ""}
                                              onBlur={e => handleUpdateGuideSettings(lesson.id, { guide_embed_url: e.target.value })}
                                              placeholder="https://app.guidde.com/embed/..."
                                              className="mt-1 h-10 text-sm rounded-md"
                                            />
                                          </div>
                                          <div>
                                            <Label className="text-[11px] text-gray-500 dark:text-gray-400">Modalita' visualizzazione</Label>
                                            <Select
                                              value={lesson.guide_display_mode || "native"}
                                              onValueChange={v => handleUpdateGuideSettings(lesson.id, { guide_display_mode: v })}
                                            >
                                              <SelectTrigger className="mt-1 h-10 text-sm rounded-md"><SelectValue /></SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="native">Solo guida nativa</SelectItem>
                                                <SelectItem value="embed">Solo embed Guidde</SelectItem>
                                                <SelectItem value="both">Entrambi (tab)</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                      </div>

                                      {(lesson.steps && lesson.steps.length > 0) && (
                                        <div className="mb-4 p-3 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                                          <div className="flex items-center gap-2 mb-3">
                                            <ListOrdered size={13} className="text-gray-500" />
                                            <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300">{lesson.steps.length} step</span>
                                            <div className="flex-1" />
                                            <div className="flex gap-1">
                                              {(lesson.steps || []).some(s => s.screenshot_url) && (
                                                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 text-orange-500 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-md"
                                                  onClick={() => initiateDelete("local-screenshots", lesson.id, lesson.title)}>
                                                  <Trash2 size={10} /> Screenshot
                                                </Button>
                                              )}
                                              {lesson.guide_local_video_url && (
                                                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 text-orange-500 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30 rounded-md"
                                                  onClick={() => initiateDelete("local-video", lesson.id, lesson.title)}>
                                                  <Trash2 size={10} /> Video
                                                </Button>
                                              )}
                                              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md"
                                                onClick={() => initiateDelete("all-steps", lesson.id, lesson.title)}>
                                                <Trash2 size={10} /> Solo step
                                              </Button>
                                              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md font-semibold"
                                                onClick={() => initiateDelete("all-steps-and-media", lesson.id, lesson.title)}>
                                                <Trash2 size={10} /> Tutto
                                              </Button>
                                            </div>
                                          </div>
                                          <div className="space-y-2">
                                            {[...lesson.steps].sort((a: any, b: any) => a.sort_order - b.sort_order).map((step: any) => (
                                              <div key={step.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md border border-gray-100 dark:border-gray-700/50 group/step">
                                                <div className="flex items-start gap-3">
                                                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-bold flex items-center justify-center mt-0.5">
                                                    {step.step_number}
                                                  </span>
                                                  <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                      <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">{step.title}</p>
                                                      {step.timestamp && (
                                                        <span className="text-[10px] text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded font-mono">{step.timestamp}</span>
                                                      )}
                                                    </div>
                                                    {step.description && (
                                                      <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{step.description}</p>
                                                    )}
                                                    {step.screenshot_url && (
                                                      <div className="mt-2">
                                                        <img
                                                          src={step.screenshot_url}
                                                          alt={step.title}
                                                          className="max-h-[200px] max-w-full rounded-md border border-gray-200 dark:border-gray-600 object-contain object-left"
                                                          loading="lazy"
                                                        />
                                                      </div>
                                                    )}
                                                  </div>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 opacity-100 md:opacity-0 md:group-hover/step:opacity-100 md:focus:opacity-100 text-red-400 hover:text-red-600 transition-opacity shrink-0"
                                                    title="Rimuovi step"
                                                    onClick={() => handleDeleteStepItem(step.id)}
                                                  >
                                                    <Trash2 size={12} />
                                                  </Button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {showAddStep ? (
                                        <div className="p-3 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                            <div className="md:col-span-2">
                                              <Label className="text-[11px] text-gray-500 dark:text-gray-400">Titolo</Label>
                                              <Input value={stepForm.title} onChange={e => setStepForm(f => ({ ...f, title: e.target.value }))} className="mt-1 h-10 text-sm rounded-md" placeholder="Es: Clicca su Impostazioni" />
                                            </div>
                                            <div>
                                              <Label className="text-[11px] text-gray-500 dark:text-gray-400">Timestamp</Label>
                                              <Input value={stepForm.timestamp} onChange={e => setStepForm(f => ({ ...f, timestamp: e.target.value }))} className="mt-1 h-10 text-sm rounded-md" placeholder="00:15" />
                                            </div>
                                            <div>
                                              <Label className="text-[11px] text-gray-500 dark:text-gray-400">Screenshot URL</Label>
                                              <Input value={stepForm.screenshot_url} onChange={e => setStepForm(f => ({ ...f, screenshot_url: e.target.value }))} className="mt-1 h-10 text-sm rounded-md" placeholder="https://..." />
                                            </div>
                                            <div className="md:col-span-4">
                                              <Label className="text-[11px] text-gray-500 dark:text-gray-400">Descrizione</Label>
                                              <Textarea value={stepForm.description} onChange={e => setStepForm(f => ({ ...f, description: e.target.value }))} rows={2} className="mt-1 text-sm rounded-md" placeholder="Descrizione dettagliata dello step..." />
                                            </div>
                                          </div>
                                          <div className="flex gap-2 mt-3">
                                            <Button size="sm" onClick={() => handleAddStepToLesson(lesson.id)} className="h-9 px-4 text-xs rounded-md bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white">
                                              <Plus size={12} className="mr-1.5" /> Aggiungi step
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => setShowAddStep(false)} className="h-9 px-4 text-xs rounded-md">
                                              Annulla
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <Button variant="outline" size="sm" onClick={() => { setShowAddStep(true); setStepForm({ title: "", description: "", timestamp: "", screenshot_url: "" }); }} className="h-9 px-4 text-xs rounded-md gap-1.5 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600">
                                          <Plus size={12} /> Aggiungi step manualmente
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {showNewVideo === lesson.id && (
                                  <div className="border-t border-gray-200 dark:border-gray-800">
                                    <div className="p-4 bg-gray-50/50 dark:bg-gray-800/20">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="w-1 h-4 rounded-full bg-blue-500" />
                                        <h4 className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Aggiungi video</h4>
                                        <div className="flex-1" />
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600" onClick={() => setShowNewVideo(null)}>
                                          <X size={14} />
                                        </Button>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                          <Label className="text-[11px] text-gray-500 dark:text-gray-400">Titolo video</Label>
                                          <Input value={videoForm.title} onChange={e => setVideoForm(f => ({ ...f, title: e.target.value }))} placeholder="Tutorial introduttivo" className="mt-1 h-10 text-sm rounded-md" />
                                        </div>
                                        <div>
                                          <Label className="text-[11px] text-gray-500 dark:text-gray-400">URL Video</Label>
                                          <Input value={videoForm.video_url} onChange={e => setVideoForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=..." className="mt-1 h-10 text-sm rounded-md" />
                                        </div>
                                        <div>
                                          <Label className="text-[11px] text-gray-500 dark:text-gray-400">Tipo</Label>
                                          <Select value={videoForm.video_type} onValueChange={v => setVideoForm(f => ({ ...f, video_type: v }))}>
                                            <SelectTrigger className="mt-1 h-10 text-sm rounded-md"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="youtube">YouTube</SelectItem>
                                              <SelectItem value="iframe">Iframe (Guidde, ecc.)</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                      <div className="flex gap-2 mt-4">
                                        <Button size="sm" onClick={() => handleAddVideo(lesson.id)} disabled={saveMutation.isPending} className="h-9 px-4 text-xs rounded-md bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white">
                                          <Plus size={12} className="mr-1.5" /> Aggiungi video
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setShowNewVideo(null)} className="h-9 px-4 text-xs rounded-md">
                                          Annulla
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {showNewDoc === lesson.id && (
                                  <div className="border-t border-gray-200 dark:border-gray-800">
                                    <div className="p-4 bg-gray-50/50 dark:bg-gray-800/20">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="w-1 h-4 rounded-full bg-blue-500" />
                                        <h4 className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Nuovo documento</h4>
                                        <div className="flex-1" />
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-gray-600" onClick={() => setShowNewDoc(null)}>
                                          <X size={14} />
                                        </Button>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                          <Label className="text-[11px] text-gray-500 dark:text-gray-400">Titolo</Label>
                                          <Input value={docForm.title} onChange={e => setDocForm(f => ({ ...f, title: e.target.value }))} placeholder="Guida PDF" className="mt-1 h-10 text-sm rounded-md" />
                                        </div>
                                        <div>
                                          <Label className="text-[11px] text-gray-500 dark:text-gray-400">URL</Label>
                                          <Input value={docForm.file_url} onChange={e => setDocForm(f => ({ ...f, file_url: e.target.value }))} placeholder="https://..." className="mt-1 h-10 text-sm rounded-md" />
                                        </div>
                                        <div>
                                          <Label className="text-[11px] text-gray-500 dark:text-gray-400">Tipo</Label>
                                          <Select value={docForm.file_type} onValueChange={v => setDocForm(f => ({ ...f, file_type: v }))}>
                                            <SelectTrigger className="mt-1 h-10 text-sm rounded-md"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="link">Link</SelectItem>
                                              <SelectItem value="pdf">PDF</SelectItem>
                                              <SelectItem value="doc">Documento</SelectItem>
                                              <SelectItem value="video">Video</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      </div>
                                      <div className="flex gap-2 mt-4">
                                        <Button size="sm" onClick={() => handleAddDoc(lesson.id)} disabled={saveMutation.isPending} className="h-9 px-4 text-xs rounded-md bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white">
                                          <Plus size={12} className="mr-1.5" /> Aggiungi documento
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setShowNewDoc(null)} className="h-9 px-4 text-xs rounded-md">
                                          Annulla
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="px-5 py-3 bg-gray-50/80 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800">
                        {showNewLesson === mod.id ? (
                          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-1 h-4 rounded-full bg-blue-500" />
                              <h4 className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Nuova lezione</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <Label className="text-[11px] text-gray-500 dark:text-gray-400">ID lezione (univoco)</Label>
                                <Input value={lessonForm.lesson_id} onChange={e => setLessonForm(f => ({ ...f, lesson_id: e.target.value }))} placeholder="es: new_lesson_1" className="mt-1 h-10 text-sm rounded-md" />
                              </div>
                              <div>
                                <Label className="text-[11px] text-gray-500 dark:text-gray-400">Titolo</Label>
                                <Input value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} placeholder="Titolo lezione" className="mt-1 h-10 text-sm rounded-md" />
                              </div>
                              <div>
                                <Label className="text-[11px] text-gray-500 dark:text-gray-400">Durata</Label>
                                <Input value={lessonForm.duration} onChange={e => setLessonForm(f => ({ ...f, duration: e.target.value }))} placeholder="5 min" className="mt-1 h-10 text-sm rounded-md" />
                              </div>
                              <div className="md:col-span-3">
                                <Label className="text-[11px] text-gray-500 dark:text-gray-400">Descrizione</Label>
                                <Textarea value={lessonForm.description} onChange={e => setLessonForm(f => ({ ...f, description: e.target.value }))} rows={2} className="mt-1 text-sm rounded-md" />
                              </div>
                              <div className="md:col-span-2">
                                <Label className="text-[11px] text-gray-500 dark:text-gray-400">Video URL</Label>
                                <Input value={lessonForm.video_url} onChange={e => setLessonForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://..." className="mt-1 h-10 text-sm rounded-md" />
                              </div>
                              <div>
                                <Label className="text-[11px] text-gray-500 dark:text-gray-400">Tipo Video</Label>
                                <Select value={lessonForm.video_type} onValueChange={v => setLessonForm(f => ({ ...f, video_type: v }))}>
                                  <SelectTrigger className="mt-1 h-10 text-sm rounded-md"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="youtube">YouTube</SelectItem>
                                    <SelectItem value="iframe">Iframe (Guidde, ecc.)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="md:col-span-3">
                                <Label className="text-[11px] text-gray-500 dark:text-gray-400">Link configurazione</Label>
                                <Input value={lessonForm.config_link} onChange={e => setLessonForm(f => ({ ...f, config_link: e.target.value }))} placeholder="/consultant/..." className="mt-1 h-10 text-sm rounded-md" />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                              <Button size="sm" onClick={() => handleCreateLesson(mod.id)} disabled={saveMutation.isPending} className="h-9 px-4 text-xs rounded-md bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white">
                                <Plus size={12} className="mr-1.5" /> Crea lezione
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setShowNewLesson(null)} className="h-9 px-4 text-xs rounded-md">
                                Annulla
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 rounded-md gap-1.5"
                            onClick={() => {
                              setShowNewLesson(mod.id);
                              setLessonForm({ lesson_id: "", title: "", description: "", duration: "5 min", video_url: "", video_type: "iframe", config_link: "/" });
                            }}
                          >
                            <Plus size={12} /> Aggiungi lezione
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <Dialog open={showNewModule} onOpenChange={setShowNewModule}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg">Nuovo Modulo</DialogTitle>
                <DialogDescription className="text-sm">Crea un nuovo modulo per l'academy</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm font-medium">Slug (identificativo univoco)</Label>
              <Input value={moduleForm.slug} onChange={e => setModuleForm(f => ({ ...f, slug: e.target.value }))} placeholder="es: marketing_avanzato" className="mt-1.5" />
            </div>
            <div>
              <Label className="text-sm font-medium">Titolo</Label>
              <Input value={moduleForm.title} onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))} placeholder="Marketing Avanzato" className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Emoji</Label>
                <Input value={moduleForm.emoji} onChange={e => setModuleForm(f => ({ ...f, emoji: e.target.value }))} placeholder="" className="mt-1.5" />
              </div>
              <div>
                <Label className="text-sm font-medium">Colore</Label>
                <Select value={moduleForm.color} onValueChange={v => setModuleForm(f => ({ ...f, color: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${c.bg}`} />
                          {c.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Tagline</Label>
              <Input value={moduleForm.tagline} onChange={e => setModuleForm(f => ({ ...f, tagline: e.target.value }))} placeholder="Breve descrizione del modulo" className="mt-1.5" />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setShowNewModule(false)}>Annulla</Button>
            <Button onClick={handleCreateModule} disabled={saveMutation.isPending} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">
              {saveMutation.isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Plus size={14} className="mr-1.5" />}
              Crea Modulo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteState} onOpenChange={() => setDeleteState(null)}>
        <DialogContent className="sm:max-w-md">
          {deleteState && (() => {
            const content = getDeleteStepContent();
            if (!content) return null;
            return (
              <>
                <div className="flex flex-col items-center text-center pt-4 pb-2">
                  <div className="mb-4">{content.icon}</div>
                  <DialogHeader className="space-y-2">
                    <DialogTitle className="text-xl">{content.title}</DialogTitle>
                    <DialogDescription className="text-sm leading-relaxed max-w-sm mx-auto">
                      {content.description}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex items-center gap-2 mt-4 mb-2">
                    {[1, 2, 3].map(step => (
                      <div
                        key={step}
                        className={`w-8 h-1.5 rounded-full transition-all ${
                          step <= deleteState.step
                            ? step === 3 ? "bg-red-500" : step === 2 ? "bg-orange-400" : "bg-amber-400"
                            : "bg-gray-200 dark:bg-gray-700"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400">Passaggio {deleteState.step} di 3</p>

                  {content.showInput && (
                    <div className="w-full mt-4 px-4">
                      <Label className="text-xs text-red-600 font-semibold">Scrivi CONFERMA per procedere</Label>
                      <Input
                        value={deleteState.confirmText}
                        onChange={e => setDeleteState({ ...deleteState, confirmText: e.target.value })}
                        placeholder="CONFERMA"
                        className="mt-2 text-center font-mono text-lg tracking-wider border-red-200 dark:border-red-900/50 focus:ring-red-500"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
                <DialogFooter className="gap-2 sm:gap-2 mt-2">
                  <Button variant="ghost" onClick={() => setDeleteState(null)} className="flex-1">
                    Annulla
                  </Button>
                  <Button
                    variant={content.buttonVariant}
                    onClick={handleDeleteStep}
                    disabled={saveMutation.isPending || (deleteState.step === 3 && deleteState.confirmText !== "CONFERMA")}
                    className={`flex-1 ${deleteState.step === 3 ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
                  >
                    {saveMutation.isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
                    {content.buttonLabel}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
