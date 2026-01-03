import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  GraduationCap,
  Plus,
  BookOpen,
  FileText,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Edit,
  Trash2,
  Save,
  X,
  Calendar,
  Layers,
  Link as LinkIcon,
  CheckCircle2,
  Copy,
  Eye,
  Settings2,
  ChevronDown,
  Loader2,
  Dumbbell,
  Unlink,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import type { UniversityTemplate, TemplateTrimester, TemplateModule, TemplateLesson } from "@shared/schema";
import LibraryDocumentTableSelector from "@/components/library-document-table-selector";
import { AIPathwayWizard } from "@/components/ai-pathway-wizard";

interface TemplateWithStructure extends UniversityTemplate {
  trimesters?: (TemplateTrimester & {
    modules?: (TemplateModule & {
      lessons?: TemplateLesson[];
    })[];
  })[];
}

interface TemplateCounts {
  trimesterCount: number;
  moduleCount: number;
  lessonCount: number;
}

export default function ConsultantTemplates() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "builder">("list");

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [trimesterDialogOpen, setTrimesterDialogOpen] = useState(false);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);

  const [editingTemplate, setEditingTemplate] = useState<UniversityTemplate | null>(null);
  const [editingTrimester, setEditingTrimester] = useState<TemplateTrimester | null>(null);
  const [editingModule, setEditingModule] = useState<TemplateModule | null>(null);
  const [editingLesson, setEditingLesson] = useState<TemplateLesson | null>(null);

  const [selectedTrimesterId, setSelectedTrimesterId] = useState<string>("");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "template" | "trimester" | "module" | "lesson"; id: string } | null>(null);

  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const [aiWizardOpen, setAiWizardOpen] = useState(false);

  const [manageSheetOpen, setManageSheetOpen] = useState(false);
  const [managingTemplateId, setMananingTemplateId] = useState<string | null>(null);
  const [expandedTrimesters, setExpandedTrimesters] = useState<string[]>([]);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [coursePickerTrimesterId, setCoursePickerTrimesterId] = useState<string | null>(null);
  const [exercisePickerLessonId, setExercisePickerLessonId] = useState<string | null>(null);

  const [templateFormData, setTemplateFormData] = useState({ name: "", description: "", isActive: true });
  const [trimesterFormData, setTrimesterFormData] = useState({ title: "", description: "", sortOrder: 0 });
  const [moduleFormData, setModuleFormData] = useState({ title: "", description: "", sortOrder: 0 });
  const [lessonFormData, setLessonFormData] = useState({ title: "", description: "", resourceUrl: "", sortOrder: 0, libraryDocumentId: "" });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery<UniversityTemplate[]>({
    queryKey: ["/api/university/templates"],
    queryFn: async () => {
      const response = await fetch("/api/university/templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });

  const { data: selectedTemplate, isLoading: templateLoading } = useQuery<TemplateWithStructure>({
    queryKey: ["/api/university/templates", selectedTemplateId, "full"],
    queryFn: async () => {
      const response = await fetch(`/api/university/templates/${selectedTemplateId}/full`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch template");
      return response.json();
    },
    enabled: !!selectedTemplateId && viewMode === "builder",
  });

  const { data: previewTemplate } = useQuery<TemplateWithStructure>({
    queryKey: ["/api/university/templates", previewTemplateId, "full"],
    queryFn: async () => {
      const response = await fetch(`/api/university/templates/${previewTemplateId}/full`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch template");
      return response.json();
    },
    enabled: !!previewTemplateId && previewDialogOpen,
  });

  const { data: managingTemplate, isLoading: managingTemplateLoading } = useQuery<TemplateWithStructure>({
    queryKey: ["/api/university/templates", managingTemplateId, "full"],
    queryFn: async () => {
      const response = await fetch(`/api/university/templates/${managingTemplateId}/full`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch template");
      return response.json();
    },
    enabled: !!managingTemplateId && manageSheetOpen,
  });

  const { data: availableCourses = [] } = useQuery<{ id: string; name: string; description?: string }[]>({
    queryKey: ["/api/university/ai/courses"],
    queryFn: async () => {
      const response = await fetch("/api/university/ai/courses", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch courses");
      return response.json();
    },
    enabled: manageSheetOpen,
  });

  const { data: availableExercises = [] } = useQuery<{ id: string; title: string; category?: string }[]>({
    queryKey: ["/api/exercises"],
    queryFn: async () => {
      const response = await fetch("/api/exercises", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch exercises");
      return response.json();
    },
    enabled: manageSheetOpen,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; isActive: boolean }) => {
      return await apiRequest("POST", "/api/university/templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates"] });
      setTemplateDialogOpen(false);
      setTemplateFormData({ name: "", description: "", isActive: true });
      toast({ title: "Template creato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description: string; isActive: boolean }) => {
      const { id, ...updates } = data;
      return await apiRequest("PUT", `/api/university/templates/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates"] });
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
      setTemplateFormData({ name: "", description: "", isActive: true });
      toast({ title: "Template aggiornato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return await apiRequest("DELETE", `/api/university/templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates"] });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      if (selectedTemplateId === deleteTarget?.id) {
        setSelectedTemplateId(null);
        setViewMode("list");
      }
      toast({ title: "Template eliminato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const duplicateTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return await apiRequest("POST", `/api/university/templates/${templateId}/duplicate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates"] });
      toast({ title: "Template duplicato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const addCourseToTrimesterMutation = useMutation({
    mutationFn: async (data: { templateId: string; trimesterId: string; libraryCategoryId: string }) => {
      return await apiRequest("POST", `/api/university/templates/${data.templateId}/trimesters/${data.trimesterId}/add-course`, {
        libraryCategoryId: data.libraryCategoryId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates", managingTemplateId, "full"] });
      setCoursePickerOpen(false);
      setCoursePickerTrimesterId("");
      toast({ title: "Corso aggiunto con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const updateLessonExerciseMutation = useMutation({
    mutationFn: async (data: { lessonId: string; exerciseId: string | null }) => {
      return await apiRequest("PATCH", `/api/university/templates/lessons/${data.lessonId}/exercise`, {
        exerciseId: data.exerciseId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates", managingTemplateId, "full"] });
      setExercisePickerOpen(false);
      setExercisePickerLessonId("");
      toast({ title: "Esercizio aggiornato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const createTrimesterMutation = useMutation({
    mutationFn: async (data: { templateId: string; title: string; description: string; sortOrder: number }) => {
      return await apiRequest("POST", `/api/university/templates/${data.templateId}/trimesters`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates", selectedTemplateId, "full"] });
      setTrimesterDialogOpen(false);
      setTrimesterFormData({ title: "", description: "", sortOrder: 0 });
      toast({ title: "Trimestre creato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const updateTrimesterMutation = useMutation({
    mutationFn: async (data: { id: string; templateId: string; title: string; description: string; sortOrder: number }) => {
      const { id, ...updates } = data;
      return await apiRequest("PUT", `/api/university/templates/trimesters/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates", selectedTemplateId, "full"] });
      setTrimesterDialogOpen(false);
      setEditingTrimester(null);
      setTrimesterFormData({ title: "", description: "", sortOrder: 0 });
      toast({ title: "Trimestre aggiornato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const deleteTrimesterMutation = useMutation({
    mutationFn: async (trimesterId: string) => {
      return await apiRequest("DELETE", `/api/university/templates/trimesters/${trimesterId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates", selectedTemplateId, "full"] });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      toast({ title: "Trimestre eliminato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const createModuleMutation = useMutation({
    mutationFn: async (data: { templateTrimesterId: string; title: string; description: string; sortOrder: number }) => {
      return await apiRequest("POST", `/api/university/templates/trimesters/${data.templateTrimesterId}/modules`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates", selectedTemplateId, "full"] });
      setModuleDialogOpen(false);
      setModuleFormData({ title: "", description: "", sortOrder: 0 });
      toast({ title: "Modulo creato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const updateModuleMutation = useMutation({
    mutationFn: async (data: { id: string; templateTrimesterId: string; title: string; description: string; sortOrder: number }) => {
      const { id, ...updates } = data;
      return await apiRequest("PUT", `/api/university/templates/modules/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates", selectedTemplateId, "full"] });
      setModuleDialogOpen(false);
      setEditingModule(null);
      setModuleFormData({ title: "", description: "", sortOrder: 0 });
      toast({ title: "Modulo aggiornato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const deleteModuleMutation = useMutation({
    mutationFn: async (moduleId: string) => {
      return await apiRequest("DELETE", `/api/university/templates/modules/${moduleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates", selectedTemplateId, "full"] });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      toast({ title: "Modulo eliminato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const createLessonMutation = useMutation({
    mutationFn: async (data: { templateModuleId: string; title: string; description: string; resourceUrl: string; sortOrder: number; libraryDocumentId?: string | null }) => {
      return await apiRequest("POST", `/api/university/templates/modules/${data.templateModuleId}/lessons`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates", selectedTemplateId, "full"] });
      setLessonDialogOpen(false);
      setLessonFormData({ title: "", description: "", resourceUrl: "", sortOrder: 0, libraryDocumentId: "" });
      toast({ title: "Lezione creata con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const updateLessonMutation = useMutation({
    mutationFn: async (data: { id: string; templateModuleId: string; title: string; description: string; resourceUrl: string; sortOrder: number; libraryDocumentId?: string | null }) => {
      const { id, ...updates } = data;
      return await apiRequest("PUT", `/api/university/templates/lessons/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates", selectedTemplateId, "full"] });
      setLessonDialogOpen(false);
      setEditingLesson(null);
      setLessonFormData({ title: "", description: "", resourceUrl: "", sortOrder: 0, libraryDocumentId: "" });
      toast({ title: "Lezione aggiornata con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const deleteLessonMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      return await apiRequest("DELETE", `/api/university/templates/lessons/${lessonId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates", selectedTemplateId, "full"] });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      toast({ title: "Lezione eliminata con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const calculateTemplateCounts = (template: TemplateWithStructure): TemplateCounts => {
    const trimesterCount = template.trimesters?.length || 0;
    const moduleCount = template.trimesters?.reduce((sum, t) => sum + (t.modules?.length || 0), 0) || 0;
    const lessonCount = template.trimesters?.reduce((sum, t) =>
      sum + (t.modules?.reduce((mSum, m) => mSum + (m.lessons?.length || 0), 0) || 0), 0) || 0;
    return { trimesterCount, moduleCount, lessonCount };
  };

  const handleOpenTemplateDialog = (template?: UniversityTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateFormData({ name: template.name, description: template.description || "", isActive: template.isActive });
    } else {
      setEditingTemplate(null);
      setTemplateFormData({ name: "", description: "", isActive: true });
    }
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, ...templateFormData });
    } else {
      createTemplateMutation.mutate(templateFormData);
    }
  };

  const handleOpenTrimesterDialog = (trimester?: TemplateTrimester) => {
    if (trimester) {
      setEditingTrimester(trimester);
      setTrimesterFormData({
        title: trimester.title,
        description: trimester.description || "",
        sortOrder: trimester.sortOrder
      });
    } else {
      setEditingTrimester(null);
      const nextOrder = (selectedTemplate?.trimesters?.length || 0) + 1;
      setTrimesterFormData({ title: "", description: "", sortOrder: nextOrder });
    }
    setTrimesterDialogOpen(true);
  };

  const handleSaveTrimester = () => {
    if (!selectedTemplateId) return;

    if (editingTrimester) {
      updateTrimesterMutation.mutate({
        id: editingTrimester.id,
        templateId: selectedTemplateId,
        ...trimesterFormData
      });
    } else {
      createTrimesterMutation.mutate({
        templateId: selectedTemplateId,
        ...trimesterFormData
      });
    }
  };

  const handleOpenModuleDialog = (trimesterId: string, module?: TemplateModule) => {
    setSelectedTrimesterId(trimesterId);
    if (module) {
      setEditingModule(module);
      setModuleFormData({
        title: module.title,
        description: module.description || "",
        sortOrder: module.sortOrder
      });
    } else {
      setEditingModule(null);
      const trimester = selectedTemplate?.trimesters?.find(t => t.id === trimesterId);
      const nextOrder = (trimester?.modules?.length || 0) + 1;
      setModuleFormData({ title: "", description: "", sortOrder: nextOrder });
    }
    setModuleDialogOpen(true);
  };

  const handleSaveModule = () => {
    if (editingModule) {
      updateModuleMutation.mutate({
        id: editingModule.id,
        templateTrimesterId: selectedTrimesterId,
        ...moduleFormData
      });
    } else {
      createModuleMutation.mutate({
        templateTrimesterId: selectedTrimesterId,
        ...moduleFormData
      });
    }
  };

  const handleOpenLessonDialog = (moduleId: string, lesson?: TemplateLesson) => {
    setSelectedModuleId(moduleId);
    if (lesson) {
      setEditingLesson(lesson);
      setLessonFormData({
        title: lesson.title,
        description: lesson.description || "",
        resourceUrl: lesson.resourceUrl || "",
        sortOrder: lesson.sortOrder,
        libraryDocumentId: lesson.libraryDocumentId || ""
      });
    } else {
      setEditingLesson(null);
      const module = selectedTemplate?.trimesters
        ?.flatMap(t => t.modules || [])
        .find(m => m.id === moduleId);
      const nextOrder = (module?.lessons?.length || 0) + 1;
      setLessonFormData({ title: "", description: "", resourceUrl: "", sortOrder: nextOrder, libraryDocumentId: "" });
    }
    setLessonDialogOpen(true);
  };

  const handleSaveLesson = () => {
    if (!selectedModuleId) return;

    if (editingLesson) {
      updateLessonMutation.mutate({
        id: editingLesson.id,
        templateModuleId: selectedModuleId,
        ...lessonFormData
      });
    } else {
      createLessonMutation.mutate({
        templateModuleId: selectedModuleId,
        ...lessonFormData
      });
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;

    switch (deleteTarget.type) {
      case "template":
        deleteTemplateMutation.mutate(deleteTarget.id);
        break;
      case "trimester":
        deleteTrimesterMutation.mutate(deleteTarget.id);
        break;
      case "module":
        deleteModuleMutation.mutate(deleteTarget.id);
        break;
      case "lesson":
        deleteLessonMutation.mutate(deleteTarget.id);
        break;
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setViewMode("builder");
  };

  const handleBackToList = () => {
    setSelectedTemplateId(null);
    setViewMode("list");
  };

  if (viewMode === "builder" && selectedTemplateId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
        {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}

        <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
          <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink onClick={handleBackToList} className="cursor-pointer flex items-center">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Templates
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{selectedTemplate?.name || "Caricamento..."}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              {templateLoading ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <p className="text-muted-foreground">Caricamento template...</p>
                  </CardContent>
                </Card>
              ) : selectedTemplate ? (
                <Tabs defaultValue="info" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="info">Info Template</TabsTrigger>
                    <TabsTrigger value="structure">Struttura</TabsTrigger>
                  </TabsList>

                  <TabsContent value="info" className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Informazioni Template</CardTitle>
                        <CardDescription>Modifica le informazioni del template</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <Label htmlFor="template-name">Nome Template</Label>
                          <Input
                            id="template-name"
                            value={templateFormData.name}
                            onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                            placeholder="es. Percorso Base"
                          />
                        </div>
                        <div>
                          <Label htmlFor="template-description">Descrizione</Label>
                          <Textarea
                            id="template-description"
                            value={templateFormData.description}
                            onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
                            placeholder="Descrizione del template..."
                            rows={4}
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="template-active"
                            checked={templateFormData.isActive}
                            onCheckedChange={(checked) => setTemplateFormData({ ...templateFormData, isActive: checked as boolean })}
                          />
                          <Label htmlFor="template-active" className="cursor-pointer">Template Attivo</Label>
                        </div>
                        <div className="flex gap-3 pt-4">
                          <Button
                            onClick={() => updateTemplateMutation.mutate({ id: selectedTemplate.id, ...templateFormData })}
                            className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Salva Modifiche
                          </Button>
                          <Button variant="outline" onClick={handleBackToList}>
                            <X className="mr-2 h-4 w-4" />
                            Annulla
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="structure" className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Struttura Template</h3>
                      <Button onClick={() => handleOpenTrimesterDialog()} className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600">
                        <Plus className="mr-2 h-4 w-4" />
                        Aggiungi Trimestre
                      </Button>
                    </div>

                    {!selectedTemplate.trimesters || selectedTemplate.trimesters.length === 0 ? (
                      <Card className="border border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <Calendar size={32} className="text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-semibold mb-2">Nessun trimestre ancora</h3>
                          <p className="text-muted-foreground mb-4">Inizia creando il primo trimestre del template</p>
                          <Button onClick={() => handleOpenTrimesterDialog()} variant="outline">
                            <Plus className="mr-2 h-4 w-4" />
                            Aggiungi Primo Trimestre
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <Accordion type="multiple" className="space-y-2">
                        {selectedTemplate.trimesters.sort((a, b) => a.sortOrder - b.sortOrder).map((trimester) => (
                          <AccordionItem key={trimester.id} value={trimester.id} className="border rounded-lg px-4 bg-card">
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg flex items-center justify-center">
                                    <Calendar className="text-white" size={20} />
                                  </div>
                                  <div className="text-left">
                                    <p className="font-semibold">{trimester.title}</p>
                                    <p className="text-sm text-muted-foreground">Ordine: {trimester.sortOrder}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{trimester.modules?.length || 0} moduli</Badge>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenTrimesterDialog(trimester);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteTarget({ type: "trimester", id: trimester.id });
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                              {trimester.description && (
                                <p className="text-sm text-muted-foreground mb-4">{trimester.description}</p>
                              )}
                              <div className="flex justify-end mb-4">
                                <Button size="sm" onClick={() => handleOpenModuleDialog(trimester.id)} variant="outline">
                                  <Plus className="mr-2 h-4 w-4" />
                                  Aggiungi Modulo
                                </Button>
                              </div>

                              {!trimester.modules || trimester.modules.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">Nessun modulo ancora</p>
                              ) : (
                                <div className="space-y-2 ml-6">
                                  {trimester.modules.sort((a, b) => a.sortOrder - b.sortOrder).map((module) => (
                                    <Card key={module.id} className="border-l-4 border-l-teal-500">
                                      <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900 rounded-lg flex items-center justify-center">
                                              <Layers className="text-teal-600 dark:text-teal-400" size={16} />
                                            </div>
                                            <div>
                                              <CardTitle className="text-base">{module.title}</CardTitle>
                                              {module.description && (
                                                <CardDescription className="text-sm">{module.description}</CardDescription>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Badge variant="secondary">{module.lessons?.length || 0} lezioni</Badge>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => handleOpenModuleDialog(trimester.id, module)}
                                            >
                                              <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => {
                                                setDeleteTarget({ type: "module", id: module.id });
                                                setDeleteDialogOpen(true);
                                              }}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      </CardHeader>
                                      <CardContent className="pt-0">
                                        <div className="flex justify-end mb-3">
                                          <Button size="sm" onClick={() => handleOpenLessonDialog(module.id)} variant="outline">
                                            <Plus className="mr-2 h-4 w-4" />
                                            Aggiungi Lezione
                                          </Button>
                                        </div>
                                        {!module.lessons || module.lessons.length === 0 ? (
                                          <p className="text-sm text-muted-foreground text-center py-2">Nessuna lezione ancora</p>
                                        ) : (
                                          <div className="space-y-2">
                                            {module.lessons.sort((a, b) => a.sortOrder - b.sortOrder).map((lesson) => (
                                              <div key={lesson.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                                <div className="flex items-center gap-3 flex-1">
                                                  <BookOpen className="text-slate-600 dark:text-slate-400" size={16} />
                                                  <div className="flex-1">
                                                    <p className="text-sm font-medium">{lesson.title}</p>
                                                    {lesson.description && (
                                                      <p className="text-xs text-muted-foreground">{lesson.description}</p>
                                                    )}
                                                    {lesson.resourceUrl && (
                                                      <div className="flex items-center gap-1 mt-1">
                                                        <LinkIcon className="h-3 w-3 text-muted-foreground" />
                                                        <a
                                                          href={lesson.resourceUrl}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="text-xs text-blue-600 hover:underline"
                                                        >
                                                          {lesson.resourceUrl.substring(0, 40)}...
                                                        </a>
                                                      </div>
                                                    )}
                                                    {lesson.libraryDocumentId && (
                                                      <div className="flex items-center gap-1 mt-1">
                                                        <FileText className="h-3 w-3 text-muted-foreground" />
                                                        <p className="text-xs text-muted-foreground">
                                                          Documento Libreria Collegato
                                                        </p>
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleOpenLessonDialog(module.id, lesson)}
                                                  >
                                                    <Edit className="h-4 w-4" />
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                      setDeleteTarget({ type: "lesson", id: lesson.id });
                                                      setDeleteDialogOpen(true);
                                                    }}
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    )}
                  </TabsContent>
                </Tabs>
              ) : null}
            </div>
          </main>
        </div>

        <Dialog open={trimesterDialogOpen} onOpenChange={setTrimesterDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTrimester ? "Modifica Trimestre" : "Nuovo Trimestre"}</DialogTitle>
              <DialogDescription>Inserisci i dettagli del trimestre</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="trimester-title">Titolo</Label>
                <Input
                  id="trimester-title"
                  value={trimesterFormData.title}
                  onChange={(e) => setTrimesterFormData({ ...trimesterFormData, title: e.target.value })}
                  placeholder="es. Primo Trimestre"
                />
              </div>
              <div>
                <Label htmlFor="trimester-description">Descrizione</Label>
                <Textarea
                  id="trimester-description"
                  value={trimesterFormData.description}
                  onChange={(e) => setTrimesterFormData({ ...trimesterFormData, description: e.target.value })}
                  placeholder="Descrizione del trimestre..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="trimester-order">Ordine</Label>
                <Input
                  id="trimester-order"
                  type="number"
                  value={trimesterFormData.sortOrder}
                  onChange={(e) => setTrimesterFormData({ ...trimesterFormData, sortOrder: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTrimesterDialogOpen(false)}>Annulla</Button>
              <Button onClick={handleSaveTrimester}>Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingModule ? "Modifica Modulo" : "Nuovo Modulo"}</DialogTitle>
              <DialogDescription>Inserisci i dettagli del modulo</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="module-title">Titolo</Label>
                <Input
                  id="module-title"
                  value={moduleFormData.title}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, title: e.target.value })}
                  placeholder="es. Fondamenti"
                />
              </div>
              <div>
                <Label htmlFor="module-description">Descrizione</Label>
                <Textarea
                  id="module-description"
                  value={moduleFormData.description}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, description: e.target.value })}
                  placeholder="Descrizione del modulo..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="module-order">Ordine</Label>
                <Input
                  id="module-order"
                  type="number"
                  value={moduleFormData.sortOrder}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, sortOrder: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>Annulla</Button>
              <Button onClick={handleSaveModule}>Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingLesson ? "Modifica Lezione" : "Nuova Lezione"}</DialogTitle>
              <DialogDescription>Inserisci i dettagli della lezione</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="lesson-title">Titolo</Label>
                <Input
                  id="lesson-title"
                  value={lessonFormData.title}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, title: e.target.value })}
                  placeholder="es. Introduzione"
                />
              </div>
              <div>
                <Label htmlFor="lesson-description">Descrizione</Label>
                <Textarea
                  id="lesson-description"
                  value={lessonFormData.description}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, description: e.target.value })}
                  placeholder="Descrizione della lezione..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="lesson-resource">URL Risorsa</Label>
                <Input
                  id="lesson-resource"
                  value={lessonFormData.resourceUrl}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, resourceUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              {/* Lezione Corso Collegata */}
              <div className="border-t pt-4">
                <Label className="text-base font-semibold mb-3 block">Lezione Corso Collegata</Label>
                <LibraryDocumentTableSelector
                  selectedDocumentId={lessonFormData.libraryDocumentId || ""}
                  onDocumentSelect={(documentId) => {
                    setLessonFormData({ ...lessonFormData, libraryDocumentId: documentId });
                  }}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Collega questa lezione ad una lezione del corso dalla libreria
                </p>
              </div>
              <div>
                <Label htmlFor="lesson-order">Ordine</Label>
                <Input
                  id="lesson-order"
                  type="number"
                  value={lessonFormData.sortOrder}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, sortOrder: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLessonDialogOpen(false)}>Annulla</Button>
              <Button onClick={handleSaveLesson}>Salva</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
              <AlertDialogDescription>
                Questa azione eliminerà {deleteTarget?.type === "template" ? "il template e tutta la sua struttura" :
                  deleteTarget?.type === "trimester" ? "il trimestre e tutti i suoi moduli e lezioni" :
                  deleteTarget?.type === "module" ? "il modulo e tutte le sue lezioni" :
                  "la lezione"} in modo permanente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Elimina</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}

      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
            {/* Header Moderno */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 lg:p-8 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl"></div>

              <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl shadow-lg shadow-cyan-500/25">
                    <GraduationCap className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Template Universitari</h1>
                    <p className="text-slate-400 text-sm lg:text-base mt-0.5">
                      Crea e gestisci i template per i percorsi formativi
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setAiWizardOpen(true)}
                    className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white border-0 shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl"
                    size="default"
                  >
                    <Sparkles size={16} className="mr-2" />
                    Crea con AI
                  </Button>
                  <Button
                    onClick={() => handleOpenTemplateDialog()}
                    className="bg-white text-slate-900 hover:bg-slate-100 border-0 font-semibold"
                    size="default"
                  >
                    <Plus size={16} className="mr-2" />
                    Nuovo Template
                  </Button>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-xl flex items-center justify-center">
                  <GraduationCap className="text-slate-600 dark:text-slate-300" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Template Totali</p>
                  <p className="text-2xl font-bold">{templates.length}</p>
                </div>
              </div>

              <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/50 dark:to-emerald-800/50 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Template Attivi</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {templates.filter(t => t.isActive).length}
                  </p>
                </div>
              </div>

              <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-xl flex items-center justify-center">
                  <FileText className="text-slate-500 dark:text-slate-400" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Template Inattivi</p>
                  <p className="text-2xl font-bold text-slate-500">
                    {templates.filter(t => !t.isActive).length}
                  </p>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="p-4 animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2 mb-4"></div>
                    <div className="h-8 bg-muted rounded w-full"></div>
                  </Card>
                ))}
              </div>
            ) : templates.length === 0 ? (
              <Card className="border border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <GraduationCap size={32} className="text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Nessun template ancora</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Inizia creando il tuo primo template universitario
                  </p>
                  <Button onClick={() => handleOpenTemplateDialog()} variant="outline">
                    <Plus size={16} className="mr-2" />
                    Crea Primo Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => {
                  const counts = calculateTemplateCounts(template);
                  return (
                    <div
                      key={template.id}
                      className="group bg-card border rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-cyan-500/50"
                      onClick={() => handleSelectTemplate(template.id)}
                    >
                      <div className="h-1 bg-gradient-to-r from-cyan-500 to-teal-500"></div>
                      <div className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                            <GraduationCap className="text-white" size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground line-clamp-1 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                              {template.name}
                            </h4>
                            <Badge 
                              variant={template.isActive ? "default" : "outline"} 
                              className={`text-xs mt-1 ${template.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400' : ''}`}
                            >
                              {template.isActive ? 'Attivo' : 'Inattivo'}
                            </Badge>
                          </div>
                        </div>

                        {template.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{template.description}</p>
                        )}

                        <div className="flex flex-wrap gap-1.5 mb-4">
                          <span className="inline-flex items-center text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                            <Calendar className="mr-1 h-3 w-3" />
                            {counts.trimesterCount} trim.
                          </span>
                          <span className="inline-flex items-center text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                            <Layers className="mr-1 h-3 w-3" />
                            {counts.moduleCount} mod.
                          </span>
                          <span className="inline-flex items-center text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                            <BookOpen className="mr-1 h-3 w-3" />
                            {counts.lessonCount} lez.
                          </span>
                        </div>

                        <div className="flex gap-2 pt-3 border-t">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1 h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTemplateDialog(template);
                            }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1 h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewTemplateId(template.id);
                              setPreviewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1 h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMananingTemplateId(template.id);
                              setManageSheetOpen(true);
                            }}
                            title="Gestisci"
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1 h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateTemplateMutation.mutate(template.id);
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1 h-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ type: "template", id: template.id });
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Modifica Template" : "Nuovo Template"}</DialogTitle>
            <DialogDescription>Inserisci i dettagli del template universitario</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome Template</Label>
              <Input
                id="name"
                value={templateFormData.name}
                onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                placeholder="es. Percorso Base"
              />
            </div>
            <div>
              <Label htmlFor="description">Descrizione</Label>
              <Textarea
                id="description"
                value={templateFormData.description}
                onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
                placeholder="Descrizione del template..."
                rows={4}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={templateFormData.isActive}
                onCheckedChange={(checked) => setTemplateFormData({ ...templateFormData, isActive: checked as boolean })}
              />
              <Label htmlFor="isActive" className="cursor-pointer">Template Attivo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleSaveTemplate}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione eliminerà {deleteTarget?.type === "template" ? "il template e tutta la sua struttura" : "l'elemento"} in modo permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Anteprima Struttura Template
            </DialogTitle>
            <DialogDescription>
              {previewTemplate?.name || "Caricamento..."}
            </DialogDescription>
          </DialogHeader>

          {previewTemplate && (
            <div className="space-y-4">
              {previewTemplate.description && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">{previewTemplate.description}</p>
                </div>
              )}

              {previewTemplate.trimesters && previewTemplate.trimesters.length > 0 ? (
                <div className="space-y-3">
                  {previewTemplate.trimesters.map((trimester, tIndex) => (
                    <div key={trimester.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-cyan-500 text-white rounded-lg flex items-center justify-center font-bold text-sm">
                          {tIndex + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-base">{trimester.title}</h4>
                          {trimester.description && (
                            <p className="text-sm text-muted-foreground mt-1">{trimester.description}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {trimester.modules?.length || 0} moduli
                        </Badge>
                      </div>

                      {trimester.modules && trimester.modules.length > 0 && (
                        <div className="ml-11 space-y-2">
                          {trimester.modules.map((module, mIndex) => (
                            <div key={module.id} className="border-l-2 border-teal-200 pl-4 py-2 space-y-2">
                              <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-teal-500 text-white rounded flex items-center justify-center font-semibold text-xs">
                                  {mIndex + 1}
                                </div>
                                <div className="flex-1">
                                  <h5 className="font-medium text-sm">{module.title}</h5>
                                  {module.description && (
                                    <p className="text-xs text-muted-foreground mt-1">{module.description}</p>
                                  )}
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {module.lessons?.length || 0} lezioni
                                </Badge>
                              </div>

                              {module.lessons && module.lessons.length > 0 && (
                                <div className="ml-9 space-y-1">
                                  {module.lessons.map((lesson, lIndex) => (
                                    <div key={lesson.id} className="flex items-start gap-2 text-xs py-1">
                                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                                      <div className="flex-1">
                                        <span className="font-medium">{lesson.title}</span>
                                        {lesson.description && (
                                          <p className="text-muted-foreground">{lesson.description}</p>
                                        )}
                                        {lesson.resourceUrl && (
                                          <div className="flex items-center gap-1 text-blue-600 mt-1">
                                            <LinkIcon className="h-3 w-3" />
                                            <span className="truncate max-w-xs">{lesson.resourceUrl}</span>
                                          </div>
                                        )}
                                        {lesson.libraryDocumentId && (
                                          <div className="flex items-center gap-1 mt-1">
                                            <FileText className="h-3 w-3 text-muted-foreground" />
                                            <p className="text-xs text-muted-foreground">
                                              Documento Libreria Collegato
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nessuna struttura definita per questo template</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AIPathwayWizard 
        open={aiWizardOpen} 
        onOpenChange={setAiWizardOpen}
        onComplete={(templateId) => {
          queryClient.invalidateQueries({ queryKey: ["/api/university/templates"] });
          toast({ title: "Percorso creato con successo", description: "Il template è stato generato dall'AI" });
        }}
      />

      <Sheet open={manageSheetOpen} onOpenChange={(open) => {
        setManageSheetOpen(open);
        if (!open) {
          setMananingTemplateId(null);
          setExpandedTrimesters([]);
          setExpandedModules([]);
        }
      }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Gestisci Template
            </SheetTitle>
            <SheetDescription>
              {managingTemplate?.name || "Caricamento..."}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-6 px-6">
            {managingTemplateLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : managingTemplate ? (
              <div className="space-y-4 py-4">
                {managingTemplate.description && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">{managingTemplate.description}</p>
                  </div>
                )}

                {managingTemplate.trimesters && managingTemplate.trimesters.length > 0 ? (
                  <div className="space-y-3">
                    {managingTemplate.trimesters.map((trimester, tIndex) => (
                      <Collapsible
                        key={trimester.id}
                        open={expandedTrimesters.includes(trimester.id)}
                        onOpenChange={(open) => {
                          setExpandedTrimesters(open 
                            ? [...expandedTrimesters, trimester.id]
                            : expandedTrimesters.filter(id => id !== trimester.id)
                          );
                        }}
                      >
                        <div className="border rounded-lg overflow-hidden">
                          <CollapsibleTrigger className="w-full">
                            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-950/20 dark:to-teal-950/20 hover:from-cyan-100 hover:to-teal-100 dark:hover:from-cyan-950/30 dark:hover:to-teal-950/30 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-cyan-500 text-white rounded-lg flex items-center justify-center font-bold text-sm">
                                  {tIndex + 1}
                                </div>
                                <div className="text-left">
                                  <h4 className="font-semibold text-sm">{trimester.title}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {trimester.modules?.length || 0} moduli
                                  </p>
                                </div>
                              </div>
                              <ChevronDown className={`h-5 w-5 transition-transform ${expandedTrimesters.includes(trimester.id) ? 'rotate-180' : ''}`} />
                            </div>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <div className="p-4 space-y-3 border-t">
                              {coursePickerTrimesterId === trimester.id ? (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h5 className="text-sm font-medium">Seleziona un corso</h5>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => setCoursePickerTrimesterId(null)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2 bg-white dark:bg-slate-950">
                                    {availableCourses.length === 0 ? (
                                      <p className="text-xs text-muted-foreground text-center py-2">
                                        Nessun corso disponibile
                                      </p>
                                    ) : (
                                      availableCourses.map((course) => (
                                        <div
                                          key={course.id}
                                          className="p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors text-sm"
                                          onClick={() => {
                                            if (managingTemplateId) {
                                              addCourseToTrimesterMutation.mutate({
                                                templateId: managingTemplateId,
                                                trimesterId: trimester.id,
                                                libraryCategoryId: course.id,
                                              });
                                              setCoursePickerTrimesterId(null);
                                            }
                                          }}
                                        >
                                          <span className="font-medium">{course.name}</span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="w-full justify-start gap-2"
                                  onClick={() => setCoursePickerTrimesterId(trimester.id)}
                                >
                                  <Plus className="h-4 w-4" />
                                  Aggiungi Corso
                                </Button>
                              )}

                              {trimester.modules && trimester.modules.length > 0 && (
                                <div className="space-y-2">
                                  {trimester.modules.map((module, mIndex) => (
                                    <Collapsible
                                      key={module.id}
                                      open={expandedModules.includes(module.id)}
                                      onOpenChange={(open) => {
                                        setExpandedModules(open 
                                          ? [...expandedModules, module.id]
                                          : expandedModules.filter(id => id !== module.id)
                                        );
                                      }}
                                    >
                                      <div className="border rounded-lg overflow-hidden ml-4">
                                        <CollapsibleTrigger className="w-full">
                                          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                            <div className="flex items-center gap-2">
                                              <div className="w-6 h-6 bg-teal-500 text-white rounded flex items-center justify-center font-semibold text-xs">
                                                {mIndex + 1}
                                              </div>
                                              <div className="text-left">
                                                <h5 className="font-medium text-sm">{module.title}</h5>
                                                <p className="text-xs text-muted-foreground">
                                                  {module.lessons?.length || 0} lezioni
                                                </p>
                                              </div>
                                            </div>
                                            <ChevronDown className={`h-4 w-4 transition-transform ${expandedModules.includes(module.id) ? 'rotate-180' : ''}`} />
                                          </div>
                                        </CollapsibleTrigger>

                                        <CollapsibleContent>
                                          <div className="p-3 space-y-2 border-t bg-white dark:bg-slate-950">
                                            {module.lessons && module.lessons.length > 0 ? (
                                              module.lessons.map((lesson) => (
                                                <div key={lesson.id} className="space-y-2">
                                                  <div className="flex items-center justify-between p-2 rounded-lg border bg-slate-50 dark:bg-slate-900/30">
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                                                      <span className="text-sm font-medium truncate">{lesson.title}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                      {lesson.exerciseId ? (
                                                        <>
                                                          <Badge variant="secondary" className="text-xs gap-1">
                                                            <Dumbbell className="h-3 w-3" />
                                                            Esercizio
                                                          </Badge>
                                                          <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                                            onClick={() => {
                                                              updateLessonExerciseMutation.mutate({
                                                                lessonId: lesson.id,
                                                                exerciseId: null,
                                                              });
                                                            }}
                                                            title="Scollega esercizio"
                                                          >
                                                            <Unlink className="h-3.5 w-3.5" />
                                                          </Button>
                                                        </>
                                                      ) : exercisePickerLessonId === lesson.id ? (
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          className="h-7 w-7 p-0"
                                                          onClick={() => setExercisePickerLessonId(null)}
                                                        >
                                                          <X className="h-4 w-4" />
                                                        </Button>
                                                      ) : (
                                                        <Button
                                                          size="sm"
                                                          variant="outline"
                                                          className="h-7 text-xs gap-1"
                                                          onClick={() => setExercisePickerLessonId(lesson.id)}
                                                        >
                                                          <Dumbbell className="h-3 w-3" />
                                                          Collega Esercizio
                                                        </Button>
                                                      )}
                                                    </div>
                                                  </div>
                                                  {exercisePickerLessonId === lesson.id && (
                                                    <div className="ml-6 p-2 border rounded-lg bg-white dark:bg-slate-950">
                                                      <p className="text-xs font-medium mb-2">Seleziona esercizio:</p>
                                                      <div className="max-h-32 overflow-y-auto space-y-1">
                                                        {availableExercises.length === 0 ? (
                                                          <p className="text-xs text-muted-foreground text-center py-2">
                                                            Nessun esercizio disponibile
                                                          </p>
                                                        ) : (
                                                          availableExercises.map((exercise) => (
                                                            <div
                                                              key={exercise.id}
                                                              className="p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors text-xs"
                                                              onClick={() => {
                                                                updateLessonExerciseMutation.mutate({
                                                                  lessonId: lesson.id,
                                                                  exerciseId: exercise.id,
                                                                });
                                                                setExercisePickerLessonId(null);
                                                              }}
                                                            >
                                                              {exercise.title}
                                                            </div>
                                                          ))
                                                        )}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              ))
                                            ) : (
                                              <p className="text-xs text-muted-foreground text-center py-2">
                                                Nessuna lezione in questo modulo
                                              </p>
                                            )}
                                          </div>
                                        </CollapsibleContent>
                                      </div>
                                    </Collapsible>
                                  ))}
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nessuna struttura definita per questo template</p>
                  </div>
                )}
              </div>
            ) : null}
          </ScrollArea>
        </SheetContent>
      </Sheet>


      <ConsultantAIAssistant />
    </div>
  );
}