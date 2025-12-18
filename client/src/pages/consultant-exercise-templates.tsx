import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  BookOpen,
  Search,
  Filter,
  Edit,
  Eye,
  Copy,
  Trash2,
  Plus,
  Clock,
  TrendingUp,
  Globe,
  Lock,
  Tag,
  Sparkles,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import TemplateForm from "@/components/template-form";
import ExerciseForm from "@/components/exercise-form";
import TemplateCard from "@/components/template-card";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { type ExerciseTemplate, type InsertExerciseTemplate } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";

export default function ConsultantTemplates() {
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [filterMode, setFilterMode] = useState<"all" | "my" | "public">("all");
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ExerciseTemplate | undefined>();
  const [usingTemplate, setUsingTemplate] = useState<ExerciseTemplate | undefined>();
  const [deletingTemplate, setDeletingTemplate] = useState<string | undefined>();
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string, hasExercises: boolean, exerciseCount: number } | undefined>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["/api/templates", {
      search: searchTerm,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      type: typeFilter !== "all" ? typeFilter : undefined,
      isPublic: filterMode === "public" ? true : undefined
    }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (filterMode === "public") params.append("isPublic", "true");

      const response = await fetch(`/api/templates?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });

  // Get current user for ownership checks
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch("/api/auth/me", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch user");
      return response.json();
    },
  });

  // Query for checking associated exercises when deleting
  const { data: associatedExercises, refetch: checkAssociatedExercises } = useQuery({
    queryKey: ["/api/templates", deletingTemplate, "associated-exercises"],
    queryFn: async () => {
      if (!deletingTemplate) return null;
      const response = await fetch(`/api/templates/${deletingTemplate}/associated-exercises`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch associated exercises");
      return response.json();
    },
    enabled: !!deletingTemplate,
  });



  // Filter templates based on mode
  const filteredTemplates = templates.filter((template: ExerciseTemplate) => {
    if (filterMode === "my" && currentUser) {
      return template.createdBy === currentUser.id;
    } else if (filterMode === "public") {
      return template.isPublic;
    }
    return true;
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (exerciseData: any) => {
      // Transform exercise data to template format
      const templateData: InsertExerciseTemplate = {
        name: exerciseData.title,
        description: exerciseData.description,
        category: exerciseData.category,
        type: exerciseData.type || "general",
        estimatedDuration: exerciseData.estimatedDuration,
        timeLimit: exerciseData.timeLimit,
        instructions: exerciseData.instructions,
        questions: exerciseData.questions || [],
        workPlatform: exerciseData.workPlatform || undefined,
        libraryDocumentId: exerciseData.libraryDocumentId || undefined,
        tags: [],
        isPublic: false,
      };
      const response = await apiRequest("POST", "/api/templates", templateData);

      // Save client associations if selectedClients exist
      if (response && response.id && exerciseData.selectedClients && exerciseData.selectedClients.length > 0) {
        try {
          await apiRequest("POST", `/api/templates/${response.id}/associate-clients`, {
            clientIds: exerciseData.selectedClients,
          });
        } catch (error) {
          console.error('Failed to save template associations:', error);
        }
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setShowExerciseForm(false);
      setEditingTemplate(undefined);
      toast({
        title: "Template creato",
        description: "Il template è stato creato con successo",
      });
    },
    onError: (error) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la creazione del template",
        variant: "destructive",
      });
    },
  });

  // Create exercise from template mutation
  const createExerciseMutation = useMutation({
    mutationFn: async (exerciseData: any) => {
      const response = await apiRequest("POST", "/api/exercises", exerciseData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      setShowExerciseForm(false);
      setUsingTemplate(undefined);
      toast({
        title: "Esercizio creato e assegnato",
        description: "L'esercizio è stato creato e assegnato ai clienti selezionati",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la creazione dell'esercizio",
        variant: "destructive",
      });
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, templateData }: { id: string; templateData: InsertExerciseTemplate }) => {
      const response = await apiRequest("PUT", `/api/templates/${id}`, templateData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setShowExerciseForm(false);
      setEditingTemplate(undefined);
      toast({
        title: "Template aggiornato",
        description: "Il template è stato aggiornato con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento del template",
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async ({ templateId, deleteAssociatedExercises }: { templateId: string; deleteAssociatedExercises: boolean }) => {
      const params = deleteAssociatedExercises ? "?deleteAssociatedExercises=true" : "";
      const response = await apiRequest("DELETE", `/api/templates/${templateId}${params}`);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] }); // Refresh exercises if they were deleted
      setDeletingTemplate(undefined);
      setTemplateToDelete(undefined);
      toast({
        title: "Template eliminato",
        description: data.message || "Il template è stato eliminato con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'eliminazione del template",
        variant: "destructive",
      });
    },
  });





  const handleCreateTemplate = (templateData: InsertExerciseTemplate) => {
    createTemplateMutation.mutate(templateData);
  };

  const handleUpdateTemplate = (templateData: InsertExerciseTemplate) => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        templateData
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    setDeletingTemplate(templateId);
    // The query will automatically fetch associated exercises when deletingTemplate changes
  };

  const confirmDeleteTemplate = (deleteAssociatedExercises: boolean = false) => {
    if (deletingTemplate) {
      deleteTemplateMutation.mutate({ templateId: deletingTemplate, deleteAssociatedExercises });
    }
  };

  // Check for associated exercises when deletingTemplate changes
  React.useEffect(() => {
    if (deletingTemplate && associatedExercises) {
      setTemplateToDelete({
        id: deletingTemplate,
        hasExercises: associatedExercises.count > 0,
        exerciseCount: associatedExercises.count
      });
    }
  }, [deletingTemplate, associatedExercises]);

  const handleUseTemplate = (templateId: string) => {
    // Find the template and open exercise form directly
    const template = templates.find((t: ExerciseTemplate) => t.id === templateId);
    if (template) {
      setUsingTemplate(template);
      setShowExerciseForm(true);
    }
  };

  const handleEditTemplate = (template: ExerciseTemplate) => {
    setEditingTemplate(template);
    setShowExerciseForm(true);
  };

  const handleViewTemplate = (template: ExerciseTemplate) => {
    setEditingTemplate(template);
    setShowExerciseForm(true);
  };



  // Get unique categories from templates with display name mapping
  const categoryDisplayNames: Record<string, string> = {
    'newsletter': 'Metodo Orbitale - Finanza',
    'Risparmio e Investimenti': 'Risparmio e Investimenti',
    'Imprenditoria': 'Imprenditoria'
  };

  const categories = Array.from(new Set(templates.map((t: ExerciseTemplate) => t.category))).sort();

  // Funzione per ordinamento naturale - estrae tutti i numeri dal testo per confronto
  const naturalSortKey = (name: string): number[] => {
    const numbers = name.match(/\d+/g);
    if (numbers) {
      return numbers.map(n => parseInt(n, 10));
    }
    return [999999];
  };

  // Confronto naturale tra due array di numeri  
  const compareArrays = (a: number[], b: number[]): number => {
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      const aVal = a[i] ?? 999999;
      const bVal = b[i] ?? 999999;
      if (aVal !== bVal) {
        return aVal - bVal;
      }
    }
    return 0;
  };

  // Ordina i template filtrati per numeri nel nome (Modulo, Lezione, Esercizio, etc)
  const sortedFilteredTemplates = useMemo(() => {
    return [...filteredTemplates].sort((a: ExerciseTemplate, b: ExerciseTemplate) => {
      const aKey = naturalSortKey(a.name);
      const bKey = naturalSortKey(b.name);
      const numCompare = compareArrays(aKey, bKey);
      if (numCompare !== 0) return numCompare;
      // Se i numeri sono uguali, ordina alfabeticamente
      return a.name.localeCompare(b.name);
    });
  }, [filteredTemplates]);

  // Calcola la paginazione
  const totalPages = Math.ceil(sortedFilteredTemplates.length / itemsPerPage);
  const paginatedTemplates = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedFilteredTemplates.slice(startIndex, endIndex);
  }, [sortedFilteredTemplates, currentPage, itemsPerPage]);

  // Reset alla prima pagina quando cambiano i filtri
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, typeFilter, filterMode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}

      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
            {/* Header */}
            <div className="relative">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                      <BookOpen size={18} className="text-white" />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                      Esercizi da Assegnare
                    </h1>
                  </div>
                  <p className="text-muted-foreground md:text-lg">
                    Gestisci i tuoi esercizi modello per assegnarli rapidamente ai clienti
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    onClick={() => setShowExerciseForm(true)}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Sparkles size={16} className="mr-2" />
                    Nuovo Esercizio Modello
                  </Button>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Esercizi Modello</p>
                      <p className="text-2xl md:text-3xl font-bold text-purple-900 dark:text-purple-100">{templates.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                      <BookOpen className="text-white" size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">Miei Esercizi Modello</p>
                      <p className="text-2xl md:text-3xl font-bold text-green-900 dark:text-green-100">
                        {currentUser ? templates.filter((t: ExerciseTemplate) => t.createdBy === currentUser.id).length : 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                      <Lock className="text-white" size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Esercizi Modello Pubblici</p>
                      <p className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-blue-100">
                        {templates.filter((t: ExerciseTemplate) => t.isPublic).length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                      <Globe className="text-white" size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/50 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Assegnazioni Totali</p>
                      <p className="text-2xl md:text-3xl font-bold text-orange-900 dark:text-orange-100">
                        {templates.reduce((sum: number, t: ExerciseTemplate) => sum + (t.usageCount || 0), 0)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                      <TrendingUp className="text-white" size={24} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="shadow-sm border-muted/40">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                      <Input
                        placeholder="Cerca esercizi modello..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-11 border-muted/60 focus:border-purple-500 transition-colors"
                        data-testid="input-search-templates"
                      />
                    </div>
                  </div>
                  <Select value={filterMode} onValueChange={(value: "all" | "my" | "public") => setFilterMode(value)}>
                    <SelectTrigger className="w-full lg:w-56 h-11 border-muted/60">
                      <SelectValue placeholder="Tutti gli esercizi modello" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti gli esercizi modello</SelectItem>
                      <SelectItem value="my">I miei esercizi modello</SelectItem>
                      <SelectItem value="public">Esercizi modello pubblici</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full lg:w-56 h-11 border-muted/60">
                      <SelectValue placeholder="Tutte le categorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte le categorie</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {categoryDisplayNames[category] || category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full lg:w-56 h-11 border-muted/60">
                      <SelectValue placeholder="Tutti i tipi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti i tipi</SelectItem>
                      <SelectItem value="general">Generale</SelectItem>
                      <SelectItem value="personalized">Personalizzato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Templates View with Tabs */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i} className="p-3 animate-pulse">
                    <div className="h-3 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-2 bg-muted rounded w-1/2 mb-3"></div>
                    <div className="h-6 bg-muted rounded w-full"></div>
                  </Card>
                ))}
              </div>
            ) : sortedFilteredTemplates.length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-12 text-center">
                  <div className="w-20 h-20 bg-gradient-to-r from-purple-500/10 to-indigo-600/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <BookOpen size={40} className="text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">Nessun esercizio modello trovato</h3>
                  <p className="text-muted-foreground text-lg mb-4">
                    {searchTerm || categoryFilter !== "all" || typeFilter !== "all" || filterMode !== "all"
                      ? "Prova a modificare i filtri di ricerca."
                      : "Inizia creando il tuo primo esercizio modello."}
                  </p>
                  <Button onClick={() => setShowExerciseForm(true)}>
                    <Plus size={16} className="mr-2" />
                    Crea Primo Esercizio Modello
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="all">Tutti ({sortedFilteredTemplates.length})</TabsTrigger>
                  {categories.map((category) => {
                    const count = sortedFilteredTemplates.filter((t: ExerciseTemplate) => t.category === category).length;
                    const displayName = categoryDisplayNames[category] || category;
                    return count > 0 ? (
                      <TabsTrigger key={category} value={category}>
                        {displayName} ({count})
                      </TabsTrigger>
                    ) : null;
                  })}
                </TabsList>

                <TabsContent value="all">
                  <div className="space-y-3">
                    {paginatedTemplates.map((template: ExerciseTemplate) => {
                      const isOwner = currentUser?.id === template.createdBy;
                      const categoryEmoji = template.category === 'Metodo Orbitale - Finanza' ? '📧' :
                        template.category === 'Risparmio e Investimenti' ? '📊' :
                          template.category === 'Imprenditoria' ? '🚀' : '📝';

                      return (
                        <Card
                          key={template.id}
                          className="group hover:shadow-lg transition-all duration-200 border overflow-hidden"
                          data-testid={`card-template-${template.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              {/* Icon */}
                              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-2xl flex-shrink-0">
                                {categoryEmoji}
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <h4 className="text-base font-bold text-foreground" data-testid={`text-template-name-${template.id}`}>
                                    {template.name}
                                  </h4>

                                  {/* Badges */}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge variant={template.isPublic ? "default" : "outline"} className="text-xs">
                                      {template.isPublic ? <Globe size={12} className="mr-1" /> : <Lock size={12} className="mr-1" />}
                                      {template.isPublic ? 'Pubblico' : 'Privato'}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {template.type === 'general' ? 'Generale' : 'Personalizzato'}
                                    </Badge>
                                  </div>
                                </div>

                                {/* Description */}
                                <p className="text-sm text-muted-foreground mb-3 line-clamp-2" data-testid={`text-template-description-${template.id}`}>
                                  {template.description}
                                </p>

                                {/* Category & Stats */}
                                <div className="flex items-center gap-4 mb-3">
                                  <Badge variant="outline" className="text-xs font-medium">
                                    <Tag size={12} className="mr-1" />
                                    {categoryDisplayNames[template.category] || template.category}
                                  </Badge>
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Clock size={14} className="text-blue-600 dark:text-blue-400" />
                                    <span>{template.timeLimit || 0} min</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <TrendingUp size={14} className="text-green-600 dark:text-green-400" />
                                    <span>{template.usageCount || 0} usi</span>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => handleUseTemplate(template.id)}
                                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                                    size="sm"
                                  >
                                    <Plus size={16} className="mr-2" />
                                    Assegna
                                  </Button>

                                  {isOwner && (
                                    <>
                                      <Button
                                        onClick={() => handleEditTemplate(template)}
                                        variant="outline"
                                        size="sm"
                                        className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                      >
                                        <Edit size={16} className="mr-2" />
                                        Modifica
                                      </Button>
                                      <Button
                                        onClick={() => handleDeleteTemplate(template.id)}
                                        variant="outline"
                                        size="sm"
                                        className="hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
                                      >
                                        <Trash2 size={16} className="mr-2" />
                                        Elimina
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Paginazione */}
                  {totalPages > 1 && (
                    <div className="mt-6">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (currentPage > 1) setCurrentPage(currentPage - 1);
                              }}
                              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>

                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <PaginationItem key={page}>
                              <PaginationLink
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setCurrentPage(page);
                                }}
                                isActive={currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          ))}

                          <PaginationItem>
                            <PaginationNext
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                              }}
                              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </TabsContent>

                {categories.map((category) => {
                  const categoryTemplates = sortedFilteredTemplates.filter((t: ExerciseTemplate) => t.category === category);
                  if (categoryTemplates.length === 0) return null;

                  return (
                    <TabsContent key={category} value={category}>
                      <div className="space-y-3">
                        {categoryTemplates.map((template: ExerciseTemplate) => {
                          const isOwner = currentUser?.id === template.createdBy;
                          const categoryEmoji = template.category === 'Metodo Orbitale - Finanza' ? '📧' :
                            template.category === 'Risparmio e Investimenti' ? '📊' :
                              template.category === 'Imprenditoria' ? '🚀' : '📝';

                          return (
                            <Card
                              key={template.id}
                              className="group hover:shadow-lg transition-all duration-200 border overflow-hidden"
                              data-testid={`card-template-${template.id}`}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start gap-4">
                                  {/* Icon */}
                                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-2xl flex-shrink-0">
                                    {categoryEmoji}
                                  </div>

                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                      <h4 className="text-base font-bold text-foreground" data-testid={`text-template-name-${template.id}`}>
                                        {template.name}
                                      </h4>

                                      {/* Badges */}
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <Badge variant={template.isPublic ? "default" : "outline"} className="text-xs">
                                          {template.isPublic ? <Globe size={12} className="mr-1" /> : <Lock size={12} className="mr-1" />}
                                          {template.isPublic ? 'Pubblico' : 'Privato'}
                                        </Badge>
                                        <Badge variant="secondary" className="text-xs">
                                          {template.type === 'general' ? 'Generale' : 'Personalizzato'}
                                        </Badge>
                                      </div>
                                    </div>

                                    {/* Description */}
                                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2" data-testid={`text-template-description-${template.id}`}>
                                      {template.description}
                                    </p>

                                    {/* Category & Stats */}
                                    <div className="flex items-center gap-4 mb-3">
                                      <Badge variant="outline" className="text-xs font-medium">
                                        <Tag size={12} className="mr-1" />
                                        {categoryDisplayNames[template.category] || template.category}
                                      </Badge>
                                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <Clock size={14} className="text-blue-600 dark:text-blue-400" />
                                        <span>{template.timeLimit || 0} min</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                        <TrendingUp size={14} className="text-green-600 dark:text-green-400" />
                                        <span>{template.usageCount || 0} usi</span>
                                      </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={() => handleUseTemplate(template.id)}
                                        className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                                        size="sm"
                                      >
                                        <Plus size={16} className="mr-2" />
                                        Assegna
                                      </Button>

                                      {isOwner && (
                                        <>
                                          <Button
                                            onClick={() => handleEditTemplate(template)}
                                            variant="outline"
                                            size="sm"
                                            className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                          >
                                            <Edit size={16} className="mr-2" />
                                            Modifica
                                          </Button>
                                          <Button
                                            onClick={() => handleDeleteTemplate(template.id)}
                                            variant="outline"
                                            size="sm"
                                            className="hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
                                          >
                                            <Trash2 size={16} className="mr-2" />
                                            Elimina
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}
          </div>
        </main>
      </div>

      {/* Exercise Form Modal */}
      {showExerciseForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <ExerciseForm
              existingExercise={editingTemplate ? {
                ...editingTemplate,
                title: editingTemplate?.name,
                workPlatform: editingTemplate?.workPlatform || "",
                questions: editingTemplate?.questions || [],
                isPublic: editingTemplate?.isPublic || false,
                isExam: (editingTemplate as any)?.isExam || false,
                autoCorrect: (editingTemplate as any)?.autoCorrect || false,
                createdBy: undefined, // Remove createdBy to indicate this is a template being edited
              } : undefined}
              templateData={usingTemplate}
              onSubmit={editingTemplate ? handleUpdateTemplate : (usingTemplate ? createExerciseMutation.mutate : createTemplateMutation.mutate)}
              onCancel={() => {
                setEditingTemplate(undefined);
                setUsingTemplate(undefined);
                setShowExerciseForm(false);
              }}
              onSuccess={() => {
                // Called when template assignment is complete (closes modal)
                setEditingTemplate(undefined);
                setUsingTemplate(undefined);
                setShowExerciseForm(false);
                queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
              }}
              isLoading={createTemplateMutation.isPending || updateTemplateMutation.isPending || createExerciseMutation.isPending}
            />
          </div>
        </div>
      )}



      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!templateToDelete}
        onOpenChange={() => {
          setDeletingTemplate(undefined);
          setTemplateToDelete(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione Template</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Sei sicuro di voler eliminare questo template? Questa azione non può essere annullata.</p>
                {templateToDelete?.hasExercises && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                      ⚠️ Attenzione: Esercizi Associati
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Questo template ha <strong>{templateToDelete.exerciseCount}</strong> esercizio
                      {templateToDelete.exerciseCount !== 1 ? "i" : ""} associato
                      {templateToDelete.exerciseCount !== 1 ? "i" : ""}.
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Vuoi eliminare anche tutti gli esercizi creati da questo template?
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
            <AlertDialogCancel className="w-full sm:w-auto">
              Annulla
            </AlertDialogCancel>
            {templateToDelete?.hasExercises ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => confirmDeleteTemplate(false)}
                  className="w-full sm:w-auto"
                  disabled={deleteTemplateMutation.isPending}
                >
                  <Trash2 size={16} className="mr-2" />
                  Solo Template
                </Button>
                <AlertDialogAction
                  onClick={() => confirmDeleteTemplate(true)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                  disabled={deleteTemplateMutation.isPending}
                >
                  <Trash2 size={16} className="mr-2" />
                  Template + Esercizi
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={() => confirmDeleteTemplate(false)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
                disabled={deleteTemplateMutation.isPending}
              >
                <Trash2 size={16} className="mr-2" />
                Elimina Template
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ConsultantAIAssistant />
    </div>
  );
}
