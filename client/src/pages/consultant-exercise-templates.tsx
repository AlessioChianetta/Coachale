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
  ArrowLeft,
  FolderOpen,
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
  const [activeTab, setActiveTab] = useState<string | null>(null);
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

  // Ordina i template filtrati per sortOrder (priorità), poi per numeri nel nome
  const sortedFilteredTemplates = useMemo(() => {
    return [...filteredTemplates].sort((a: ExerciseTemplate, b: ExerciseTemplate) => {
      // Prima ordina per sortOrder (se presente)
      const aSortOrder = a.sortOrder ?? Infinity;
      const bSortOrder = b.sortOrder ?? Infinity;
      if (aSortOrder !== bSortOrder) {
        return aSortOrder - bSortOrder;
      }
      // Poi ordina per numeri nel nome
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}

      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
            {/* Header Moderno */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 lg:p-8 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl"></div>

              <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl shadow-lg shadow-cyan-500/25">
                    <BookOpen className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Esercizi da Assegnare</h1>
                    <p className="text-slate-400 text-sm lg:text-base mt-0.5">
                      Gestisci i tuoi esercizi modello per assegnarli ai clienti
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setShowExerciseForm(true)}
                    className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white border-0 shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl"
                    size="default"
                  >
                    <Sparkles size={16} className="mr-2" />
                    Nuovo Esercizio Modello
                  </Button>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-xl flex items-center justify-center">
                  <BookOpen className="text-slate-600 dark:text-slate-300" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Totali</p>
                  <p className="text-2xl font-bold">{templates.length}</p>
                </div>
              </div>

              <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/50 dark:to-emerald-800/50 rounded-xl flex items-center justify-center">
                  <Lock className="text-emerald-600 dark:text-emerald-400" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Miei</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {currentUser ? templates.filter((t: ExerciseTemplate) => t.createdBy === currentUser.id).length : 0}
                  </p>
                </div>
              </div>

              <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/50 rounded-xl flex items-center justify-center">
                  <Globe className="text-blue-600 dark:text-blue-400" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pubblici</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {templates.filter((t: ExerciseTemplate) => t.isPublic).length}
                  </p>
                </div>
              </div>

              <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/50 dark:to-amber-800/50 rounded-xl flex items-center justify-center">
                  <TrendingUp className="text-amber-600 dark:text-amber-400" size={24} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assegnazioni</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {templates.reduce((sum: number, t: ExerciseTemplate) => sum + (t.usageCount || 0), 0)}
                  </p>
                </div>
              </div>
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
                        className="pl-10 h-11 border-muted/60 focus:border-cyan-500 transition-colors"
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

            {/* Templates View - Category Grid or Template List */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="p-6 animate-pulse">
                    <div className="h-12 w-12 bg-muted rounded-xl mb-4"></div>
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </Card>
                ))}
              </div>
            ) : categories.length === 0 ? (
              <Card className="border-0 shadow-lg">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen size={40} className="text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">Nessun esercizio modello trovato</h3>
                  <p className="text-muted-foreground text-lg mb-4">
                    Inizia creando il tuo primo esercizio modello.
                  </p>
                  <Button onClick={() => setShowExerciseForm(true)}>
                    <Plus size={16} className="mr-2" />
                    Crea Primo Esercizio Modello
                  </Button>
                </CardContent>
              </Card>
            ) : activeTab === null ? (
              /* Category Grid View - Adaptive based on number of categories */
              <div className="space-y-6">
                {categories.length === 1 ? (
                  /* Single Category - Hero Card Layout */
                  <Card
                    className="group cursor-pointer overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-cyan-600 via-teal-600 to-emerald-700"
                    onClick={() => {
                      setActiveTab(categories[0]);
                      setCurrentPage(1);
                    }}
                  >
                    <CardContent className="p-0">
                      <div className="relative p-8 md:p-12">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-10">
                          <div className="absolute top-4 right-4 w-32 h-32 rounded-full bg-white/20 blur-2xl" />
                          <div className="absolute bottom-4 left-4 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
                        </div>
                        
                        <div className="relative flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
                          {/* Icon */}
                          <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl md:text-5xl shadow-lg border border-white/20 flex-shrink-0">
                            {categories[0] === 'Metodo Orbitale - Finanza' ? '📧' :
                              categories[0] === 'Risparmio e Investimenti' ? '📊' :
                                categories[0] === 'Imprenditoria' ? '🚀' : '📝'}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 text-white">
                            <h2 className="text-2xl md:text-3xl font-bold mb-2 group-hover:translate-x-1 transition-transform">
                              {categoryDisplayNames[categories[0]] || categories[0]}
                            </h2>
                            <p className="text-white/80 text-lg mb-6">
                              Esplora tutti gli esercizi modello di questa categoria
                            </p>
                            
                            {/* Stats Row */}
                            <div className="flex flex-wrap gap-3">
                              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm">
                                <BookOpen size={18} className="text-white/90" />
                                <span className="font-semibold">{templates.filter((t: ExerciseTemplate) => t.category === categories[0]).length}</span>
                                <span className="text-white/80">esercizi</span>
                              </div>
                              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm">
                                <TrendingUp size={18} className="text-white/90" />
                                <span className="font-semibold">
                                  {templates.filter((t: ExerciseTemplate) => t.category === categories[0]).reduce((sum: number, t: ExerciseTemplate) => sum + (t.usageCount || 0), 0)}
                                </span>
                                <span className="text-white/80">assegnazioni</span>
                              </div>
                              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm">
                                <Clock size={18} className="text-white/90" />
                                <span className="text-white/80">~{Math.round(templates.filter((t: ExerciseTemplate) => t.category === categories[0]).reduce((sum: number, t: ExerciseTemplate) => sum + (t.timeLimit || 0), 0) / Math.max(1, templates.filter((t: ExerciseTemplate) => t.category === categories[0]).length))} min</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Arrow */}
                          <div className="hidden md:flex items-center justify-center w-14 h-14 rounded-full bg-white/20 group-hover:bg-white/30 transition-colors">
                            <FolderOpen size={24} className="text-white group-hover:scale-110 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : categories.length <= 3 ? (
                  /* Few Categories - Large Cards */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categories.map((category, index) => {
                      const categoryTemplates = templates.filter((t: ExerciseTemplate) => t.category === category);
                      const count = categoryTemplates.length;
                      const totalUsage = categoryTemplates.reduce((sum: number, t: ExerciseTemplate) => sum + (t.usageCount || 0), 0);
                      const avgTime = Math.round(categoryTemplates.reduce((sum: number, t: ExerciseTemplate) => sum + (t.timeLimit || 0), 0) / Math.max(1, count));
                      const categoryEmoji = category === 'Metodo Orbitale - Finanza' ? '📧' :
                        category === 'Risparmio e Investimenti' ? '📊' :
                          category === 'Imprenditoria' ? '🚀' : '📝';
                      const displayName = categoryDisplayNames[category] || category;
                      const gradients = [
                        'from-cyan-500 via-teal-500 to-emerald-500',
                        'from-emerald-500 via-teal-500 to-cyan-500',
                        'from-orange-500 via-rose-500 to-pink-500',
                      ];

                      return (
                        <Card
                          key={category}
                          className="group cursor-pointer overflow-hidden border-0 shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                          onClick={() => {
                            setActiveTab(category);
                            setCurrentPage(1);
                          }}
                        >
                          <div className={`h-2 bg-gradient-to-r ${gradients[index % gradients.length]}`} />
                          <CardContent className="p-6">
                            <div className="flex items-start gap-4 mb-4">
                              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${gradients[index % gradients.length]} flex items-center justify-center text-3xl shadow-md`}>
                                {categoryEmoji}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-bold text-foreground mb-1 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                                  {displayName}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  Clicca per esplorare
                                </p>
                              </div>
                            </div>
                            
                            {/* Stats Grid */}
                            <div className="grid grid-cols-3 gap-3 mb-4">
                              <div className="text-center p-3 rounded-lg bg-muted/50">
                                <p className="text-2xl font-bold text-foreground">{count}</p>
                                <p className="text-xs text-muted-foreground">Esercizi</p>
                              </div>
                              <div className="text-center p-3 rounded-lg bg-muted/50">
                                <p className="text-2xl font-bold text-foreground">{totalUsage}</p>
                                <p className="text-xs text-muted-foreground">Assegnati</p>
                              </div>
                              <div className="text-center p-3 rounded-lg bg-muted/50">
                                <p className="text-2xl font-bold text-foreground">{avgTime}</p>
                                <p className="text-xs text-muted-foreground">Min. medi</p>
                              </div>
                            </div>
                            
                            <Button className={`w-full bg-gradient-to-r ${gradients[index % gradients.length]} hover:opacity-90 text-white`}>
                              <FolderOpen size={16} className="mr-2" />
                              Apri Categoria
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  /* Many Categories - Compact Grid */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {categories.map((category, index) => {
                      const count = templates.filter((t: ExerciseTemplate) => t.category === category).length;
                      const categoryEmoji = category === 'Metodo Orbitale - Finanza' ? '📧' :
                        category === 'Risparmio e Investimenti' ? '📊' :
                          category === 'Imprenditoria' ? '🚀' : '📝';
                      const displayName = categoryDisplayNames[category] || category;
                      const colors = [
                        'from-cyan-500 to-teal-500',
                        'from-emerald-500 to-teal-600',
                        'from-orange-500 to-rose-600',
                        'from-blue-500 to-cyan-600',
                        'from-pink-500 to-purple-600',
                      ];

                      return (
                        <Card
                          key={category}
                          className="group cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border overflow-hidden"
                          onClick={() => {
                            setActiveTab(category);
                            setCurrentPage(1);
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colors[index % colors.length]} flex items-center justify-center text-xl flex-shrink-0`}>
                                {categoryEmoji}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-foreground truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                                  {displayName}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {count} esercizi
                                </p>
                              </div>
                              <FolderOpen size={18} className="text-muted-foreground group-hover:text-cyan-500 transition-colors flex-shrink-0" />
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Template List View for Selected Category */
              <div className="space-y-4">
                {/* Back Button and Category Header */}
                <div className="flex items-center gap-4 mb-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab(null)}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft size={16} />
                    Torna alle categorie
                  </Button>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-lg">
                      {activeTab === 'Metodo Orbitale - Finanza' ? '📧' :
                        activeTab === 'Risparmio e Investimenti' ? '📊' :
                          activeTab === 'Imprenditoria' ? '🚀' : '📝'}
                    </div>
                    <h2 className="text-xl font-bold">
                      {categoryDisplayNames[activeTab] || activeTab}
                    </h2>
                    <Badge variant="secondary">
                      {sortedFilteredTemplates.filter((t: ExerciseTemplate) => t.category === activeTab).length} esercizi
                    </Badge>
                  </div>
                </div>

                {/* Template Cards */}
                <div className="space-y-3">
                  {sortedFilteredTemplates
                    .filter((t: ExerciseTemplate) => t.category === activeTab)
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((template: ExerciseTemplate) => {
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
                              {/* Order Number + Icon */}
                              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                {template.sortOrder ? (
                                  <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                                    {template.sortOrder}
                                  </div>
                                ) : null}
                                <div className={`${template.sortOrder ? 'w-10 h-10 text-lg' : 'w-14 h-14 text-2xl'} rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center`}>
                                  {categoryEmoji}
                                </div>
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
                                    className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white"
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

                {/* Pagination */}
                {(() => {
                  const categoryTemplates = sortedFilteredTemplates.filter((t: ExerciseTemplate) => t.category === activeTab);
                  const categoryTotalPages = Math.ceil(categoryTemplates.length / itemsPerPage);
                  
                  return categoryTotalPages > 1 ? (
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

                          {Array.from({ length: categoryTotalPages }, (_, i) => i + 1).map((page) => (
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
                                if (currentPage < categoryTotalPages) setCurrentPage(currentPage + 1);
                              }}
                              className={currentPage === categoryTotalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  ) : null;
                })()}
              </div>
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
