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
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import type { UniversityTemplate, TemplateTrimester, TemplateModule, TemplateLesson } from "@shared/schema";
import LibraryDocumentTableSelector from "@/components/library-document-table-selector";

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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
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
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
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
                      <Button onClick={() => handleOpenTrimesterDialog()} className="bg-gradient-to-r from-purple-600 to-indigo-600">
                        <Plus className="mr-2 h-4 w-4" />
                        Aggiungi Trimestre
                      </Button>
                    </div>

                    {!selectedTemplate.trimesters || selectedTemplate.trimesters.length === 0 ? (
                      <Card>
                        <CardContent className="p-12 text-center">
                          <div className="w-20 h-20 bg-gradient-to-r from-purple-500/10 to-indigo-600/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Calendar size={40} className="text-muted-foreground" />
                          </div>
                          <h3 className="text-xl font-semibold mb-3">Nessun trimestre ancora</h3>
                          <p className="text-muted-foreground mb-4">Inizia creando il primo trimestre del template</p>
                          <Button onClick={() => handleOpenTrimesterDialog()}>
                            <Plus className="mr-2 h-4 w-4" />
                            Aggiungi Primo Trimestre
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <Accordion type="multiple" className="space-y-2">
                        {selectedTemplate.trimesters.sort((a, b) => a.sortOrder - b.sortOrder).map((trimester) => (
                          <AccordionItem key={trimester.id} value={trimester.id} className="border rounded-lg px-4">
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
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
                                    <Card key={module.id} className="border-l-4 border-l-indigo-500">
                                      <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                                              <Layers className="text-indigo-600 dark:text-indigo-400" size={16} />
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
                                                  <BookOpen className="text-purple-600 dark:text-purple-400" size={16} />
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}

      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
            <div className="relative">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                      <GraduationCap size={18} className="text-white" />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                      Gestione Template Universitari
                    </h1>
                  </div>
                  <p className="text-muted-foreground md:text-lg">
                    Crea e gestisci i template per i percorsi universitari dei clienti
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    onClick={() => handleOpenTemplateDialog()}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Sparkles size={16} className="mr-2" />
                    Nuovo Template
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Template Totali</p>
                      <p className="text-2xl md:text-3xl font-bold text-purple-900 dark:text-purple-100">{templates.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                      <GraduationCap className="text-white" size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">Template Attivi</p>
                      <p className="text-2xl md:text-3xl font-bold text-green-900 dark:text-green-100">
                        {templates.filter(t => t.isActive).length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="text-white" size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Template Inattivi</p>
                      <p className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-blue-100">
                        {templates.filter(t => !t.isActive).length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                      <FileText className="text-white" size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>
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
              <Card className="border-0 shadow-lg">
                <CardContent className="p-12 text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-purple-500/10 to-indigo-600/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <GraduationCap size={40} className="text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">Nessun template ancora</h3>
                  <p className="text-muted-foreground text-lg mb-4">
                    Inizia creando il tuo primo template universitario
                  </p>
                  <Button onClick={() => handleOpenTemplateDialog()}>
                    <Plus size={16} className="mr-2" />
                    Crea Primo Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                {templates.map((template) => {
                  const counts = calculateTemplateCounts(template);
                  return (
                    <Card
                      key={template.id}
                      className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 overflow-hidden cursor-pointer"
                      onClick={() => handleSelectTemplate(template.id)}
                    >
                      <CardContent className="p-0 h-full flex flex-col">
                        <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 dark:from-purple-500/20 dark:to-indigo-500/20 p-4 border-b border-purple-100 dark:border-purple-800">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start space-x-3 flex-1 min-w-0">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xl flex-shrink-0 shadow-lg">
                                <GraduationCap className="text-white" size={24} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-base font-bold text-foreground mb-1 line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                  {template.name}
                                </h4>
                                <Badge variant={template.isActive ? "default" : "outline"} className="text-xs">
                                  {template.isActive ? 'Attivo' : 'Inattivo'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 flex-1">
                          {template.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{template.description}</p>
                          )}
                          <div className="flex gap-2 mb-4">
                            <Badge variant="secondary" className="text-xs">
                              <Calendar className="mr-1 h-3 w-3" />
                              {counts.trimesterCount} trimestri
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              <Layers className="mr-1 h-3 w-3" />
                              {counts.moduleCount} moduli
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              <BookOpen className="mr-1 h-3 w-3" />
                              {counts.lessonCount} lezioni
                            </Badge>
                          </div>
                        </div>

                        <div className="p-4 pt-0 flex flex-col gap-2">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenTemplateDialog(template);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Modifica
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewTemplateId(template.id);
                                setPreviewDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget({ type: "template", id: template.id });
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateTemplateMutation.mutate(template.id);
                            }}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Duplica Template
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
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
                        <div className="w-8 h-8 bg-purple-500 text-white rounded-lg flex items-center justify-center font-bold text-sm">
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
                            <div key={module.id} className="border-l-2 border-indigo-200 pl-4 py-2 space-y-2">
                              <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-indigo-500 text-white rounded flex items-center justify-center font-semibold text-xs">
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
      <ConsultantAIAssistant />
    </div>
  );
}