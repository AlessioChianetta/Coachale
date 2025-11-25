import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Search, 
  Plus, 
  Filter, 
  Grid3X3, 
  List,
  BookOpen,
  Globe,
  Lock,
  Trash2,
  Copy
} from "lucide-react";
import TemplateCard from "@/components/template-card";
import TemplateForm from "@/components/template-form";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { type ExerciseTemplate, type InsertExerciseTemplate } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

type ViewMode = "grid" | "list";
type TemplateFilter = "all" | "my" | "public";

export default function TemplateLibrary() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [filterMode, setFilterMode] = useState<TemplateFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ExerciseTemplate | undefined>();
  const [deletingTemplate, setDeletingTemplate] = useState<string | undefined>();

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

  // Filter templates based on mode
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    if (filterMode === "my" && currentUser) {
      filtered = templates.filter((template: ExerciseTemplate) => 
        template.createdBy === currentUser.id
      );
    } else if (filterMode === "public") {
      filtered = templates.filter((template: ExerciseTemplate) => 
        template.isPublic
      );
    }

    return filtered;
  }, [templates, filterMode, currentUser]);

  // Get unique categories from templates
  const categories = useMemo(() => {
    const cats = new Set((templates as ExerciseTemplate[]).map(t => t.category));
    return Array.from(cats).sort();
  }, [templates]);

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (templateData: InsertExerciseTemplate) => {
      const response = await apiRequest("POST", "/api/templates", templateData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setShowForm(false);
      setEditingTemplate(undefined);
      toast({
        title: "Template creato",
        description: "Il template è stato creato con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la creazione del template",
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
      setShowForm(false);
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
    mutationFn: async (templateId: string) => {
      const response = await apiRequest("DELETE", `/api/templates/${templateId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      setDeletingTemplate(undefined);
      toast({
        title: "Template eliminato",
        description: "Il template è stato eliminato con successo",
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

  // Use template mutation (create exercise from template)
  const useTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiRequest("POST", `/api/templates/${templateId}/use`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] }); // Refresh to update usage count
      toast({
        title: "Esercizio creato",
        description: "L'esercizio è stato creato dal template con successo",
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

  const handleDeleteTemplate = (templateId: string) => {
    setDeletingTemplate(templateId);
  };

  const confirmDeleteTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || "Failed to delete template");
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast.success("Template eliminato con successo");
      return true;
    } catch (error: any) {
      console.error('Delete template error:', error);
      toast.error("Errore durante l'eliminazione del template: " + error.message);
      throw error;
    }
  };

  const handleUseTemplate = (templateId: string) => {
    useTemplateMutation.mutate(templateId);
  };

  const handleEditTemplate = (template: ExerciseTemplate) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleViewTemplate = (template: ExerciseTemplate) => {
    // For now, just show edit form in read-only mode or implement a view modal
    setEditingTemplate(template);
    setShowForm(true);
  };

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              setShowForm(false);
              setEditingTemplate(undefined);
            }}
            data-testid="button-back-to-library"
          >
            ← Torna alla Libreria
          </Button>
        </div>

        <TemplateForm
          template={editingTemplate}
          onSubmit={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
          onCancel={() => {
            setShowForm(false);
            setEditingTemplate(undefined);
          }}
          isLoading={createTemplateMutation.isPending || updateTemplateMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="template-library">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Libreria Template
          </h1>
          <p className="text-muted-foreground">
            Crea e gestisci i tuoi template di esercizi
          </p>
        </div>

        <Button
          onClick={() => setShowForm(true)}
          data-testid="button-create-template"
        >
          <Plus size={16} className="mr-2" />
          Nuovo Template
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Filter size={16} />
              <span className="font-medium">Filtri</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
                data-testid="button-grid-view"
              >
                <Grid3X3 size={16} />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                data-testid="button-list-view"
              >
                <List size={16} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cerca template..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-templates"
              />
            </div>

            {/* Filter Mode */}
            <Select value={filterMode} onValueChange={(value: TemplateFilter) => setFilterMode(value)}>
              <SelectTrigger data-testid="select-filter-mode">
                <SelectValue placeholder="Tutti i template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i template</SelectItem>
                <SelectItem value="my">I miei template</SelectItem>
                <SelectItem value="public">Template pubblici</SelectItem>
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger data-testid="select-category-filter">
                <SelectValue placeholder="Tutte le categorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le categorie</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger data-testid="select-type-filter">
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

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Badge variant="outline">
            {filteredTemplates.length} template
          </Badge>
          {filterMode !== "all" && (
            <Badge variant="secondary">
              {filterMode === "my" && <Lock size={12} className="mr-1" />}
              {filterMode === "public" && <Globe size={12} className="mr-1" />}
              {filterMode === "my" ? "Solo miei" : "Solo pubblici"}
            </Badge>
          )}
        </div>
      </div>

      {/* Templates Grid/List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2 mb-4"></div>
              <div className="h-8 bg-muted rounded w-full"></div>
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="p-8 text-center">
          <BookOpen size={48} className="mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">
            {searchTerm || categoryFilter !== "all" || typeFilter !== "all" || filterMode !== "all"
              ? "Nessun template trovato"
              : "Nessun template disponibile"
            }
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || categoryFilter !== "all" || typeFilter !== "all" || filterMode !== "all"
              ? "Prova a modificare i filtri di ricerca"
              : "Inizia creando il tuo primo template di esercizio"
            }
          </p>
          <Button onClick={() => setShowForm(true)} data-testid="button-create-first-template">
            <Plus size={16} className="mr-2" />
            Crea Primo Template
          </Button>
        </Card>
      ) : (
        <div className={viewMode === "grid" 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
          : "space-y-4"
        }>
          {filteredTemplates.map((template: ExerciseTemplate) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={handleUseTemplate}
              onEdit={handleEditTemplate}
              onDelete={(templateId) => {
                  setDeletingTemplate(templateId);
                  // La conferma sarà gestita dal dialog
                }}
              onView={handleViewTemplate}
              isOwner={currentUser?.id === template.createdBy}
              showActions={true}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog 
        open={!!deletingTemplate} 
        onOpenChange={() => setDeletingTemplate(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo template? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                  await confirmDeleteTemplate(deletingTemplate!);
                  setDeletingTemplate(undefined); // Close dialog after attempt
                }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 size={16} className="mr-2" />
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}