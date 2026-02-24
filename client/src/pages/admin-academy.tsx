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
  type: "module" | "lesson" | "document" | "video";
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

  const { data: modules = [], isLoading } = useQuery<AcademyModule[]>({
    queryKey: ["admin-academy-modules"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/modules`, { headers: getAuthHeaders() });
      const json = await res.json();
      return json.data || [];
    },
  });

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const totalVideos = modules.reduce((acc, m) => acc + m.lessons.reduce((a, l) => a + (l.videos?.length || 0) + (l.video_url ? 1 : 0), 0), 0);
  const totalDocs = modules.reduce((acc, m) => acc + m.lessons.reduce((a, l) => a + l.documents.length, 0), 0);

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
    const urlMap: Record<string, string> = {
      module: `${API_BASE}/admin/modules/${deleteState.id}`,
      lesson: `${API_BASE}/admin/lessons/${deleteState.id}`,
      document: `${API_BASE}/admin/documents/${deleteState.id}`,
      video: `${API_BASE}/admin/videos/${deleteState.id}`,
    };
    await saveMutation.mutateAsync({ url: urlMap[deleteState.type], method: "DELETE" });
    setDeleteState(null);
    const labels: Record<string, string> = { module: "Modulo", lesson: "Lezione", document: "Documento", video: "Video" };
    toast({ title: `${labels[deleteState.type]} eliminato con successo` });
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
    const typeLabels: Record<string, string> = { module: "il modulo", lesson: "la lezione", document: "il documento", video: "il video" };
    const label = typeLabels[deleteState.type];

    if (deleteState.step === 1) {
      return {
        icon: <AlertTriangle className="h-12 w-12 text-amber-500" />,
        title: "Sei sicuro?",
        description: `Stai per eliminare ${label} "${deleteState.name}".${deleteState.type === "module" ? " Tutte le lezioni, video e documenti del modulo verranno eliminati permanentemente." : ""}`,
        buttonLabel: "Continua",
        buttonVariant: "outline" as const,
      };
    }
    if (deleteState.step === 2) {
      return {
        icon: <Shield className="h-12 w-12 text-orange-500" />,
        title: "Conferma eliminazione",
        description: `Questa azione e' irreversibile. ${label} "${deleteState.name}" verra' eliminato definitivamente dal database.${deleteState.type === "module" ? " Include tutte le lezioni associate, i loro video e documenti." : ""}`,
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            </div>
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
              {modules.map((mod, modIdx) => (
                <div key={mod.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-gray-800 shadow-sm overflow-hidden transition-all hover:shadow-md">
                  <div
                    className="flex items-center gap-3 px-5 py-4 cursor-pointer transition-colors group"
                    onClick={() => toggleModule(mod.id)}
                  >
                    <div className="flex flex-col gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleReorderModules(mod.id, "up"); }} disabled={modIdx === 0}>
                        <ArrowUp size={13} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-40 hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleReorderModules(mod.id, "down"); }} disabled={modIdx === modules.length - 1}>
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
                        <div>
                          {mod.lessons.map((lesson, lIdx) => (
                            <div key={lesson.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                              <div className="px-5 py-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex flex-col gap-0.5 mt-1">
                                    <Button variant="ghost" size="icon" className="h-5 w-5 opacity-30 hover:opacity-100" onClick={() => handleReorderLessons(lesson, "up")} disabled={lIdx === 0}>
                                      <ArrowUp size={11} />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 opacity-30 hover:opacity-100" onClick={() => handleReorderLessons(lesson, "down")} disabled={lIdx === mod.lessons.length - 1}>
                                      <ArrowDown size={11} />
                                    </Button>
                                  </div>
                                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getModuleGradient(mod.color)} flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 opacity-80`}>
                                    {lIdx + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{lesson.title}</span>
                                      <Badge variant="outline" className="text-[10px] font-mono bg-gray-50 dark:bg-gray-800">{lesson.lesson_id}</Badge>
                                      <Badge className="text-[10px] bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border-0">
                                        <Clock size={9} className="mr-0.5" /> {lesson.duration}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{lesson.description}</p>

                                    {(() => {
                                      const allVideos: Array<{ id: string; title: string; video_url: string; video_type: string; isLegacy?: boolean }> = [];
                                      if (lesson.video_url) {
                                        allVideos.push({ id: "legacy", title: "Video principale", video_url: lesson.video_url, video_type: lesson.video_type, isLegacy: true });
                                      }
                                      if (lesson.videos) {
                                        lesson.videos.forEach(v => allVideos.push({ ...v }));
                                      }
                                      if (allVideos.length === 0) return null;
                                      return (
                                        <div className="mt-3 space-y-2">
                                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                                            <Film size={12} />
                                            {allVideos.length} {allVideos.length === 1 ? "Video" : "Video"}
                                          </div>
                                          <div className="space-y-1.5">
                                            {allVideos.map((vid, vIdx) => (
                                              <div key={vid.id} className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/20 border border-purple-100 dark:border-purple-900/30">
                                                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0 text-[10px] font-bold text-white">
                                                  {vIdx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                    {vid.title || `Video ${vIdx + 1}`}
                                                  </p>
                                                  <p className="text-[10px] text-purple-500 truncate">{vid.video_url}</p>
                                                </div>
                                                <Badge className="text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-0 shrink-0">
                                                  {vid.video_type === "youtube" ? "YouTube" : "Iframe"}
                                                </Badge>
                                                {!vid.isLegacy && (
                                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600 opacity-50 hover:opacity-100 shrink-0" onClick={() => initiateDelete("video", vid.id, vid.title || `Video ${vIdx + 1}`)}>
                                                    <Trash2 size={11} />
                                                  </Button>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {lesson.documents.length > 0 && (
                                      <div className="mt-3 space-y-2">
                                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                                          <FileText size={12} />
                                          Documenti ({lesson.documents.length})
                                        </div>
                                        <div className="space-y-1.5">
                                          {lesson.documents.map(doc => (
                                            <div key={doc.id} className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-100 dark:border-amber-900/30">
                                              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
                                                <FileText size={14} className="text-white" />
                                              </div>
                                              <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 truncate transition-colors">
                                                {doc.title}
                                              </a>
                                              <Badge className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0 shrink-0 uppercase">
                                                {doc.file_type}
                                              </Badge>
                                              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600 opacity-50 hover:opacity-100 shrink-0" onClick={() => initiateDelete("document", doc.id, doc.title)}>
                                                <Trash2 size={11} />
                                              </Button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {lesson.config_link && lesson.config_link !== "/" && (
                                      <div className="mt-2 flex items-center gap-1.5">
                                        <Settings size={11} className="text-gray-400" />
                                        <span className="text-[10px] text-gray-400 font-mono">{lesson.config_link}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors" title="Aggiungi video" onClick={() => { setShowNewVideo(lesson.id); setVideoForm({ title: "", video_url: "", video_type: "youtube" }); }}>
                                      <Video size={14} className="text-purple-500" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors" title="Aggiungi documento" onClick={() => { setShowNewDoc(lesson.id); setDocForm({ title: "", file_url: "", file_type: "link" }); }}>
                                      <FileText size={14} className="text-amber-500" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors" title="Modifica lezione" onClick={() => startEditLesson(lesson)}>
                                      <Pencil size={14} className="text-blue-500" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" title="Elimina lezione" onClick={() => initiateDelete("lesson", lesson.id, lesson.title)}>
                                      <Trash2 size={14} />
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {editingLesson === lesson.id && (
                                <div className="mx-5 mb-4 p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                  <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                    <Pencil size={12} /> Modifica Lezione
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                      <Label className="text-xs text-blue-600 dark:text-blue-400">ID lezione</Label>
                                      <Input value={lessonForm.lesson_id} onChange={e => setLessonForm(f => ({ ...f, lesson_id: e.target.value }))} className="mt-1" />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-blue-600 dark:text-blue-400">Titolo</Label>
                                      <Input value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-blue-600 dark:text-blue-400">Durata</Label>
                                      <Input value={lessonForm.duration} onChange={e => setLessonForm(f => ({ ...f, duration: e.target.value }))} placeholder="5 min" className="mt-1" />
                                    </div>
                                    <div className="md:col-span-3">
                                      <Label className="text-xs text-blue-600 dark:text-blue-400">Descrizione</Label>
                                      <Textarea value={lessonForm.description} onChange={e => setLessonForm(f => ({ ...f, description: e.target.value }))} rows={2} className="mt-1" />
                                    </div>
                                    <div className="md:col-span-2">
                                      <Label className="text-xs text-blue-600 dark:text-blue-400">Video URL principale (legacy)</Label>
                                      <Input value={lessonForm.video_url} onChange={e => setLessonForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://..." className="mt-1" />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-blue-600 dark:text-blue-400">Tipo Video</Label>
                                      <Select value={lessonForm.video_type} onValueChange={v => setLessonForm(f => ({ ...f, video_type: v }))}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="youtube">YouTube</SelectItem>
                                          <SelectItem value="iframe">Iframe (Guidde, ecc.)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="md:col-span-3">
                                      <Label className="text-xs text-blue-600 dark:text-blue-400">Link configurazione</Label>
                                      <Input value={lessonForm.config_link} onChange={e => setLessonForm(f => ({ ...f, config_link: e.target.value }))} placeholder="/consultant/..." className="mt-1" />
                                    </div>
                                  </div>
                                  <div className="flex gap-2 mt-4">
                                    <Button size="sm" onClick={() => handleSaveLesson(lesson.id)} disabled={saveMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                                      <Save size={14} className="mr-1.5" /> Salva
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingLesson(null)}>
                                      <X size={14} className="mr-1" /> Annulla
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {showNewVideo === lesson.id && (
                                <div className="mx-5 mb-4 p-4 bg-gradient-to-r from-purple-50/80 to-pink-50/50 dark:from-purple-950/30 dark:to-pink-950/20 rounded-xl border border-purple-100 dark:border-purple-900/30">
                                  <h4 className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                    <Film size={12} /> Aggiungi Video
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                      <Label className="text-xs text-purple-600 dark:text-purple-400">Titolo video</Label>
                                      <Input value={videoForm.title} onChange={e => setVideoForm(f => ({ ...f, title: e.target.value }))} placeholder="Tutorial introduttivo" className="mt-1" />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-purple-600 dark:text-purple-400">URL Video</Label>
                                      <Input value={videoForm.video_url} onChange={e => setVideoForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=... o embed URL" className="mt-1" />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-purple-600 dark:text-purple-400">Tipo</Label>
                                      <Select value={videoForm.video_type} onValueChange={v => setVideoForm(f => ({ ...f, video_type: v }))}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="youtube">
                                            <span className="flex items-center gap-1.5"><PlayCircle size={12} className="text-red-500" /> YouTube</span>
                                          </SelectItem>
                                          <SelectItem value="iframe">
                                            <span className="flex items-center gap-1.5"><ExternalLink size={12} className="text-blue-500" /> Iframe (Guidde, ecc.)</span>
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 mt-4">
                                    <Button size="sm" onClick={() => handleAddVideo(lesson.id)} disabled={saveMutation.isPending} className="bg-purple-600 hover:bg-purple-700 text-white">
                                      <Plus size={14} className="mr-1.5" /> Aggiungi Video
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setShowNewVideo(null)}>
                                      <X size={14} className="mr-1" /> Annulla
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {showNewDoc === lesson.id && (
                                <div className="mx-5 mb-4 p-4 bg-gradient-to-r from-amber-50/80 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30">
                                  <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                    <FileText size={12} /> Nuovo Documento
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                      <Label className="text-xs text-amber-600 dark:text-amber-400">Titolo</Label>
                                      <Input value={docForm.title} onChange={e => setDocForm(f => ({ ...f, title: e.target.value }))} placeholder="Guida PDF" className="mt-1" />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-amber-600 dark:text-amber-400">URL</Label>
                                      <Input value={docForm.file_url} onChange={e => setDocForm(f => ({ ...f, file_url: e.target.value }))} placeholder="https://..." className="mt-1" />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-amber-600 dark:text-amber-400">Tipo</Label>
                                      <Select value={docForm.file_type} onValueChange={v => setDocForm(f => ({ ...f, file_type: v }))}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
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
                                    <Button size="sm" onClick={() => handleAddDoc(lesson.id)} disabled={saveMutation.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
                                      <Plus size={14} className="mr-1.5" /> Aggiungi
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setShowNewDoc(null)}>
                                      <X size={14} className="mr-1" /> Annulla
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="px-5 py-3 bg-gray-50/80 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800">
                        {showNewLesson === mod.id ? (
                          <div className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-green-200 dark:border-green-900/30 shadow-sm">
                            <h4 className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                              <Plus size={12} /> Nuova Lezione
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs text-green-600 dark:text-green-400">ID lezione (univoco)</Label>
                                <Input value={lessonForm.lesson_id} onChange={e => setLessonForm(f => ({ ...f, lesson_id: e.target.value }))} placeholder="es: new_lesson_1" className="mt-1" />
                              </div>
                              <div>
                                <Label className="text-xs text-green-600 dark:text-green-400">Titolo</Label>
                                <Input value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} placeholder="Titolo lezione" className="mt-1" />
                              </div>
                              <div>
                                <Label className="text-xs text-green-600 dark:text-green-400">Durata</Label>
                                <Input value={lessonForm.duration} onChange={e => setLessonForm(f => ({ ...f, duration: e.target.value }))} placeholder="5 min" className="mt-1" />
                              </div>
                              <div className="md:col-span-3">
                                <Label className="text-xs text-green-600 dark:text-green-400">Descrizione</Label>
                                <Textarea value={lessonForm.description} onChange={e => setLessonForm(f => ({ ...f, description: e.target.value }))} rows={2} className="mt-1" />
                              </div>
                              <div className="md:col-span-2">
                                <Label className="text-xs text-green-600 dark:text-green-400">Video URL</Label>
                                <Input value={lessonForm.video_url} onChange={e => setLessonForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://..." className="mt-1" />
                              </div>
                              <div>
                                <Label className="text-xs text-green-600 dark:text-green-400">Tipo Video</Label>
                                <Select value={lessonForm.video_type} onValueChange={v => setLessonForm(f => ({ ...f, video_type: v }))}>
                                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="youtube">YouTube</SelectItem>
                                    <SelectItem value="iframe">Iframe (Guidde, ecc.)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="md:col-span-3">
                                <Label className="text-xs text-green-600 dark:text-green-400">Link configurazione</Label>
                                <Input value={lessonForm.config_link} onChange={e => setLessonForm(f => ({ ...f, config_link: e.target.value }))} placeholder="/consultant/..." className="mt-1" />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                              <Button size="sm" onClick={() => handleCreateLesson(mod.id)} disabled={saveMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
                                <Plus size={14} className="mr-1.5" /> Crea Lezione
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setShowNewLesson(null)}>
                                <X size={14} className="mr-1" /> Annulla
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                            onClick={() => {
                              setShowNewLesson(mod.id);
                              setLessonForm({ lesson_id: "", title: "", description: "", duration: "5 min", video_url: "", video_type: "iframe", config_link: "/" });
                            }}
                          >
                            <Plus size={14} className="mr-1.5" /> Aggiungi Lezione
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
