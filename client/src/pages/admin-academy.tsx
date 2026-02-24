import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ChevronUp,
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
  Link as LinkIcon,
} from "lucide-react";
import Navbar from "@/components/navbar";
import AdminSidebar from "@/components/layout/AdminSidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

const API_BASE = "/api/consultant/academy";

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
  { value: "slate", label: "Grigio" },
  { value: "blue", label: "Blu" },
  { value: "violet", label: "Viola" },
  { value: "indigo", label: "Indigo" },
  { value: "amber", label: "Ambra" },
  { value: "rose", label: "Rosa" },
  { value: "green", label: "Verde" },
  { value: "red", label: "Rosso" },
  { value: "orange", label: "Arancione" },
  { value: "teal", label: "Teal" },
];

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
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "module" | "lesson" | "document"; id: string; name: string } | null>(null);

  const { data: modules = [], isLoading } = useQuery<AcademyModule[]>({
    queryKey: ["admin-academy-modules"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/modules`, { headers: getAuthHeaders() });
      const json = await res.json();
      return json.data || [];
    },
  });

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);

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
    await saveMutation.mutateAsync({
      url: `${API_BASE}/admin/modules/${moduleId}`,
      method: "PUT",
      body: moduleForm,
    });
    setEditingModule(null);
    toast({ title: "Modulo aggiornato" });
  };

  const handleCreateModule = async () => {
    if (!moduleForm.title || !moduleForm.slug) {
      toast({ title: "Errore", description: "Titolo e slug sono richiesti", variant: "destructive" });
      return;
    }
    await saveMutation.mutateAsync({
      url: `${API_BASE}/admin/modules`,
      method: "POST",
      body: moduleForm,
    });
    setShowNewModule(false);
    setModuleForm({ slug: "", title: "", emoji: "📖", tagline: "", color: "slate" });
    toast({ title: "Modulo creato" });
  };

  const handleSaveLesson = async (lessonId: string) => {
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
    await saveMutation.mutateAsync({
      url: `${API_BASE}/admin/lessons/${lessonId}/documents`,
      method: "POST",
      body: docForm,
    });
    setShowNewDoc(null);
    setDocForm({ title: "", file_url: "", file_type: "link" });
    toast({ title: "Documento aggiunto" });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const urlMap = {
      module: `${API_BASE}/admin/modules/${deleteConfirm.id}`,
      lesson: `${API_BASE}/admin/lessons/${deleteConfirm.id}`,
      document: `${API_BASE}/admin/documents/${deleteConfirm.id}`,
    };
    await saveMutation.mutateAsync({ url: urlMap[deleteConfirm.type], method: "DELETE" });
    setDeleteConfirm(null);
    toast({ title: `${deleteConfirm.type === "module" ? "Modulo" : deleteConfirm.type === "lesson" ? "Lezione" : "Documento"} eliminato` });
  };

  const handleReorderModules = async (moduleId: string, direction: "up" | "down") => {
    const idx = modules.findIndex(m => m.id === moduleId);
    if ((direction === "up" && idx <= 0) || (direction === "down" && idx >= modules.length - 1)) return;
    const newOrder = modules.map(m => m.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    await saveMutation.mutateAsync({
      url: `${API_BASE}/admin/modules/reorder`,
      method: "PUT",
      body: { order: newOrder },
    });
  };

  const handleReorderLessons = async (lesson: AcademyLesson, direction: "up" | "down") => {
    const mod = modules.find(m => m.id === lesson.module_id);
    if (!mod) return;
    const idx = mod.lessons.findIndex(l => l.id === lesson.id);
    if ((direction === "up" && idx <= 0) || (direction === "down" && idx >= mod.lessons.length - 1)) return;
    const newOrder = mod.lessons.map(l => l.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    await saveMutation.mutateAsync({
      url: `${API_BASE}/admin/lessons/reorder`,
      method: "PUT",
      body: { order: newOrder },
    });
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

  const renderVideoTypeLabel = (type: string) => {
    switch (type) {
      case "youtube": return "YouTube";
      case "iframe": return "Iframe (Guidde)";
      default: return type;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {isMobile && (
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                  <Menu size={20} />
                </Button>
              )}
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                <GraduationCap className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Gestione Academy</h1>
                <p className="text-sm text-gray-500">
                  {totalLessons} lezioni in {modules.length} moduli
                </p>
              </div>
            </div>
            <Button onClick={() => { setShowNewModule(true); setModuleForm({ slug: "", title: "", emoji: "📖", tagline: "", color: "slate" }); }} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus size={16} className="mr-1" /> Nuovo Modulo
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : modules.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">Nessun modulo ancora. Crea il primo modulo per iniziare.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {modules.map((mod, modIdx) => (
                <Card key={mod.id} className="overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    onClick={() => toggleModule(mod.id)}
                  >
                    <div className="flex flex-col gap-0.5">
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); handleReorderModules(mod.id, "up"); }} disabled={modIdx === 0}>
                        <ArrowUp size={12} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); handleReorderModules(mod.id, "down"); }} disabled={modIdx === modules.length - 1}>
                        <ArrowDown size={12} />
                      </Button>
                    </div>
                    <span className="text-2xl">{mod.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{mod.title}</h3>
                        <Badge variant="secondary" className="text-xs">{mod.lessons.length} lezioni</Badge>
                        <Badge variant="outline" className="text-xs">{mod.color}</Badge>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{mod.tagline}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); startEditModule(mod); }}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: "module", id: mod.id, name: mod.title }); }}>
                        <Trash2 size={14} />
                      </Button>
                      {expandedModules.has(mod.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                  </div>

                  {editingModule === mod.id && (
                    <div className="px-4 py-3 bg-indigo-50/50 dark:bg-indigo-950/20 border-t border-b">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs">Slug</Label>
                          <Input value={moduleForm.slug} onChange={e => setModuleForm(f => ({ ...f, slug: e.target.value }))} placeholder="slug_modulo" />
                        </div>
                        <div>
                          <Label className="text-xs">Titolo</Label>
                          <Input value={moduleForm.title} onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">Emoji</Label>
                          <Input value={moduleForm.emoji} onChange={e => setModuleForm(f => ({ ...f, emoji: e.target.value }))} />
                        </div>
                        <div className="md:col-span-2">
                          <Label className="text-xs">Tagline</Label>
                          <Input value={moduleForm.tagline} onChange={e => setModuleForm(f => ({ ...f, tagline: e.target.value }))} />
                        </div>
                        <div>
                          <Label className="text-xs">Colore</Label>
                          <Select value={moduleForm.color} onValueChange={v => setModuleForm(f => ({ ...f, color: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={() => handleSaveModule(mod.id)} disabled={saveMutation.isPending}>
                          <Save size={14} className="mr-1" /> Salva
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingModule(null)}>
                          <X size={14} className="mr-1" /> Annulla
                        </Button>
                      </div>
                    </div>
                  )}

                  {expandedModules.has(mod.id) && (
                    <div className="border-t">
                      {mod.lessons.length === 0 ? (
                        <div className="px-4 py-6 text-center text-gray-400 text-sm">Nessuna lezione in questo modulo</div>
                      ) : (
                        <div className="divide-y">
                          {mod.lessons.map((lesson, lIdx) => (
                            <div key={lesson.id} className="px-4 py-3">
                              <div className="flex items-start gap-3">
                                <div className="flex flex-col gap-0.5 mt-1">
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleReorderLessons(lesson, "up")} disabled={lIdx === 0}>
                                    <ArrowUp size={11} />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleReorderLessons(lesson, "down")} disabled={lIdx === mod.lessons.length - 1}>
                                    <ArrowDown size={11} />
                                  </Button>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{lesson.title}</span>
                                    <Badge variant="outline" className="text-[10px]">{lesson.lesson_id}</Badge>
                                    <Badge variant="secondary" className="text-[10px]">{lesson.duration}</Badge>
                                    {lesson.video_url && (
                                      <Badge className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                        <Video size={10} className="mr-0.5" /> {renderVideoTypeLabel(lesson.video_type)}
                                      </Badge>
                                    )}
                                    {lesson.documents.length > 0 && (
                                      <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                        <FileText size={10} className="mr-0.5" /> {lesson.documents.length} doc
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 line-clamp-2">{lesson.description}</p>
                                  {lesson.video_url && (
                                    <p className="text-xs text-indigo-500 mt-1 truncate flex items-center gap-1">
                                      <ExternalLink size={10} />
                                      {lesson.video_url}
                                    </p>
                                  )}
                                  {lesson.documents.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {lesson.documents.map(doc => (
                                        <div key={doc.id} className="flex items-center gap-2 text-xs">
                                          <FileText size={12} className="text-amber-500" />
                                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">{doc.title}</a>
                                          <Badge variant="outline" className="text-[9px]">{doc.file_type}</Badge>
                                          <Button variant="ghost" size="icon" className="h-5 w-5 text-red-400 hover:text-red-600" onClick={() => setDeleteConfirm({ type: "document", id: doc.id, name: doc.title })}>
                                            <Trash2 size={10} />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowNewDoc(lesson.id); setDocForm({ title: "", file_url: "", file_type: "link" }); }}>
                                    <FileText size={13} />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditLesson(lesson)}>
                                    <Pencil size={13} />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => setDeleteConfirm({ type: "lesson", id: lesson.id, name: lesson.title })}>
                                    <Trash2 size={13} />
                                  </Button>
                                </div>
                              </div>

                              {editingLesson === lesson.id && (
                                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                      <Label className="text-xs">ID lezione</Label>
                                      <Input value={lessonForm.lesson_id} onChange={e => setLessonForm(f => ({ ...f, lesson_id: e.target.value }))} />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Titolo</Label>
                                      <Input value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Durata</Label>
                                      <Input value={lessonForm.duration} onChange={e => setLessonForm(f => ({ ...f, duration: e.target.value }))} placeholder="5 min" />
                                    </div>
                                    <div className="md:col-span-3">
                                      <Label className="text-xs">Descrizione</Label>
                                      <Textarea value={lessonForm.description} onChange={e => setLessonForm(f => ({ ...f, description: e.target.value }))} rows={2} />
                                    </div>
                                    <div className="md:col-span-2">
                                      <Label className="text-xs">Video URL (YouTube o iframe Guidde)</Label>
                                      <Input value={lessonForm.video_url} onChange={e => setLessonForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=... o https://app.guidde.com/embed/..." />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Tipo Video</Label>
                                      <Select value={lessonForm.video_type} onValueChange={v => setLessonForm(f => ({ ...f, video_type: v }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="youtube">YouTube</SelectItem>
                                          <SelectItem value="iframe">Iframe (Guidde, ecc.)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="md:col-span-3">
                                      <Label className="text-xs">Link configurazione</Label>
                                      <Input value={lessonForm.config_link} onChange={e => setLessonForm(f => ({ ...f, config_link: e.target.value }))} placeholder="/consultant/..." />
                                    </div>
                                  </div>
                                  <div className="flex gap-2 mt-3">
                                    <Button size="sm" onClick={() => handleSaveLesson(lesson.id)} disabled={saveMutation.isPending}>
                                      <Save size={14} className="mr-1" /> Salva
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setEditingLesson(null)}>
                                      <X size={14} className="mr-1" /> Annulla
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {showNewDoc === lesson.id && (
                                <div className="mt-3 p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg">
                                  <h4 className="text-xs font-semibold mb-2 text-amber-700 dark:text-amber-300">Nuovo Documento</h4>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                      <Label className="text-xs">Titolo</Label>
                                      <Input value={docForm.title} onChange={e => setDocForm(f => ({ ...f, title: e.target.value }))} placeholder="Guida PDF" />
                                    </div>
                                    <div>
                                      <Label className="text-xs">URL</Label>
                                      <Input value={docForm.file_url} onChange={e => setDocForm(f => ({ ...f, file_url: e.target.value }))} placeholder="https://..." />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Tipo</Label>
                                      <Select value={docForm.file_type} onValueChange={v => setDocForm(f => ({ ...f, file_type: v }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="link">Link</SelectItem>
                                          <SelectItem value="pdf">PDF</SelectItem>
                                          <SelectItem value="doc">Documento</SelectItem>
                                          <SelectItem value="video">Video</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 mt-3">
                                    <Button size="sm" onClick={() => handleAddDoc(lesson.id)} disabled={saveMutation.isPending}>
                                      <Plus size={14} className="mr-1" /> Aggiungi
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
                      <div className="px-4 py-3 bg-gray-50/50 dark:bg-gray-800/30 border-t">
                        {showNewLesson === mod.id ? (
                          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border">
                            <h4 className="text-xs font-semibold mb-2 text-indigo-600 dark:text-indigo-400">Nuova Lezione</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs">ID lezione (univoco)</Label>
                                <Input value={lessonForm.lesson_id} onChange={e => setLessonForm(f => ({ ...f, lesson_id: e.target.value }))} placeholder="es: new_lesson_1" />
                              </div>
                              <div>
                                <Label className="text-xs">Titolo</Label>
                                <Input value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} placeholder="Titolo lezione" />
                              </div>
                              <div>
                                <Label className="text-xs">Durata</Label>
                                <Input value={lessonForm.duration} onChange={e => setLessonForm(f => ({ ...f, duration: e.target.value }))} placeholder="5 min" />
                              </div>
                              <div className="md:col-span-3">
                                <Label className="text-xs">Descrizione</Label>
                                <Textarea value={lessonForm.description} onChange={e => setLessonForm(f => ({ ...f, description: e.target.value }))} rows={2} />
                              </div>
                              <div className="md:col-span-2">
                                <Label className="text-xs">Video URL</Label>
                                <Input value={lessonForm.video_url} onChange={e => setLessonForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://..." />
                              </div>
                              <div>
                                <Label className="text-xs">Tipo Video</Label>
                                <Select value={lessonForm.video_type} onValueChange={v => setLessonForm(f => ({ ...f, video_type: v }))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="youtube">YouTube</SelectItem>
                                    <SelectItem value="iframe">Iframe (Guidde, ecc.)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="md:col-span-3">
                                <Label className="text-xs">Link configurazione</Label>
                                <Input value={lessonForm.config_link} onChange={e => setLessonForm(f => ({ ...f, config_link: e.target.value }))} placeholder="/consultant/..." />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Button size="sm" onClick={() => handleCreateLesson(mod.id)} disabled={saveMutation.isPending}>
                                <Plus size={14} className="mr-1" /> Crea Lezione
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setShowNewLesson(null)}>
                                <X size={14} className="mr-1" /> Annulla
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" className="text-indigo-600 dark:text-indigo-400" onClick={() => { setShowNewLesson(mod.id); setLessonForm({ lesson_id: "", title: "", description: "", duration: "5 min", video_url: "", video_type: "iframe", config_link: "/" }); }}>
                            <Plus size={14} className="mr-1" /> Aggiungi Lezione
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      <Dialog open={showNewModule} onOpenChange={setShowNewModule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo Modulo</DialogTitle>
            <DialogDescription>Crea un nuovo modulo per l'academy</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Slug (identificativo univoco)</Label>
              <Input value={moduleForm.slug} onChange={e => setModuleForm(f => ({ ...f, slug: e.target.value }))} placeholder="es: marketing_avanzato" />
            </div>
            <div>
              <Label>Titolo</Label>
              <Input value={moduleForm.title} onChange={e => setModuleForm(f => ({ ...f, title: e.target.value }))} placeholder="Marketing Avanzato" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Emoji</Label>
                <Input value={moduleForm.emoji} onChange={e => setModuleForm(f => ({ ...f, emoji: e.target.value }))} placeholder="📖" />
              </div>
              <div>
                <Label>Colore</Label>
                <Select value={moduleForm.color} onValueChange={v => setModuleForm(f => ({ ...f, color: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLOR_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Tagline</Label>
              <Input value={moduleForm.tagline} onChange={e => setModuleForm(f => ({ ...f, tagline: e.target.value }))} placeholder="Breve descrizione del modulo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewModule(false)}>Annulla</Button>
            <Button onClick={handleCreateModule} disabled={saveMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
              {saveMutation.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Plus size={14} className="mr-1" />}
              Crea Modulo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
            <DialogDescription>
              Stai per eliminare {deleteConfirm?.type === "module" ? "il modulo" : deleteConfirm?.type === "lesson" ? "la lezione" : "il documento"} "{deleteConfirm?.name}".
              {deleteConfirm?.type === "module" && " Tutte le lezioni e i documenti del modulo verranno eliminati."}
              {" "}Questa azione non può essere annullata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>Annulla</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Trash2 size={14} className="mr-1" />}
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
