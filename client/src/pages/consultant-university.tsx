import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  GraduationCap, 
  Plus,
  Calendar,
  BookOpen,
  FileText,
  ChevronDown,
  ChevronRight,
  Award,
  CheckCircle2,
  Star,
  TrendingUp,
  LayoutDashboard,
  Users,
  Sparkles,
  Target,
  UserPlus,
  X,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FolderKanban,
  PlayCircle,
  Lock,
  Unlock
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { AIPathwayWizard } from "@/components/ai-pathway-wizard";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, formatDistanceToNow } from "date-fns";
import it from "date-fns/locale/it";


interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
}

interface UniversityYear {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  isLocked: boolean; // Lock/unlock like a videogame level
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  templateId?: string; // Aggiunto per tenere traccia del templateId
}

interface UniversityTrimester {
  id: string;
  yearId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface UniversityModule {
  id: string;
  trimesterId: string;
  title: string;
  description: string | null;
  resourceUrl: string | null;
  exerciseId: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface UniversityLesson {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  resourceUrl: string | null;
  exerciseId: string | null;
  libraryDocumentId: string | null; // Aggiunto per collegare al documento della libreria
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Exercise {
  id: string;
  title: string;
  category: string;
  createdAt?: Date | string;
}

interface UniversityStats {
  totalLessons: number;
  completedLessons: number;
  completionPercentage: number;
  averageGrade: number | null;
  totalCertificates: number;
}

interface ExistingGrade {
  id: string;
  referenceType: "module" | "trimester" | "year";
  referenceId: string;
  grade: number;
  feedback?: string;
}

interface ExistingCertificate {
  id: string;
  certificateType: "trimester" | "year";
  referenceId: string;
  issuedAt: Date;
}

interface ClientStats extends UniversityStats {
  clientId: string;
  clientName: string;
  clientEmail: string;
  enrolledAt: Date | null;
  currentPath: string;
  currentYear: string | null;
  currentTrimester: string | null;
  currentModule: string | null;
}

interface YearAssignment {
  clientId: string;
  client: Client;
}

// Componente tabella per selezionare un documento dalla libreria
function LibraryDocumentTableSelector({ selectedDocumentId, onDocumentSelect }: { selectedDocumentId: string; onDocumentSelect: (documentId: string) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [localSelectedId, setLocalSelectedId] = useState<string>(selectedDocumentId);
  const itemsPerPage = 5;
  
  // Sincronizza lo stato locale con il prop quando cambia dall'esterno
  React.useEffect(() => {
    setLocalSelectedId(selectedDocumentId);
  }, [selectedDocumentId]);
  
  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ["/api/library/documents"],
  });

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["/api/library/categories"],
  });

  const isLoading = docsLoading || catsLoading;

  // Filtra documenti in base alla ricerca e categoria
  const filteredDocuments = documents.filter((doc: any) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || doc.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Calcola paginazione
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDocuments = filteredDocuments.slice(startIndex, endIndex);

  // Reset pagina quando cambia il filtro
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  const getCategoryName = (categoryId: string) => {
    const category = categories.find((c: any) => c.id === categoryId);
    return category?.name || "Altro";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-base font-semibold">
          <BookOpen className="h-4 w-4 text-primary" />
          Lezione del Corso Collegata
        </Label>
        {filteredDocuments.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {filteredDocuments.length} {filteredDocuments.length === 1 ? 'trovata' : 'trovate'}
          </Badge>
        )}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca lezione..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Tutte le categorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le categorie</SelectItem>
            {categories.map((cat: any) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Document selezionato */}
      {localSelectedId && (
        <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-purple-800 dark:text-purple-200 flex items-center gap-2 min-w-0 flex-1">
              <BookOpen className="h-4 w-4 flex-shrink-0" />
              <span className="flex-shrink-0"><strong>Selezionato:</strong></span>
              <span className="truncate">{documents.find((d: any) => d.id === localSelectedId)?.title}</span>
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLocalSelectedId("");
                onDocumentSelect("");
              }}
              className="h-6 w-6 p-0 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto min-h-[280px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Titolo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Livello</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-16">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Caricamento...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-16 text-muted-foreground">
                  Nessuna lezione trovata
                </TableCell>
              </TableRow>
            ) : (
              <>
                <TableRow 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setLocalSelectedId("");
                    onDocumentSelect("");
                  }}
                >
                  <TableCell>
                    <div className={`h-4 w-4 rounded-full border-2 ${!localSelectedId ? 'bg-primary border-primary' : 'border-muted'}`}>
                      {!localSelectedId && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-muted-foreground" />
                      Nessun documento collegato
                    </div>
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                </TableRow>
                {paginatedDocuments.map((doc: any) => (
                  <TableRow 
                    key={doc.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setLocalSelectedId(doc.id);
                      onDocumentSelect(doc.id);
                    }}
                  >
                    <TableCell>
                      <div className={`h-4 w-4 rounded-full border-2 ${localSelectedId === doc.id ? 'bg-primary border-primary' : 'border-muted'}`}>
                        {localSelectedId === doc.id && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell>{getCategoryName(doc.categoryId)}</TableCell>
                    <TableCell>
                      {doc.level && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            doc.level === 'avanzato' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                            doc.level === 'intermedio' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                            'bg-green-50 text-green-600 border-green-200'
                          }`}
                        >
                          {doc.level}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginazione */}
      {filteredDocuments.length > itemsPerPage && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
          <p className="text-sm text-muted-foreground">
            Mostrando {startIndex + 1}-{Math.min(endIndex, filteredDocuments.length)} di {filteredDocuments.length}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
              Precedente
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="w-8 h-8 p-0"
                >
                  {page}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Successivo
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConsultantUniversity() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [expandedYears, setExpandedYears] = useState<string[]>([]);
  const [expandedTrimesters, setExpandedTrimesters] = useState<string[]>([]);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [expandedDashboardClients, setExpandedDashboardClients] = useState<string[]>([]);
  const [yearDialogOpen, setYearDialogOpen] = useState(false);
  const [trimesterDialogOpen, setTrimesterDialogOpen] = useState(false);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [selectedTrimesterId, setSelectedTrimesterId] = useState<string>("");
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [gradeContext, setGradeContext] = useState<{
    type: "module" | "trimester" | "year";
    id: string;
    title: string;
  } | null>(null);
  const [certificateDialogOpen, setCertificateDialogOpen] = useState(false);
  const [certificateContext, setCertificateContext] = useState<{
    type: "trimester" | "year";
    id: string;
    title: string;
  } | null>(null);
  const [selectedClientsForYear, setSelectedClientsForYear] = useState<string[]>([]);
  const [manageAssignmentsYearId, setManageAssignmentsYearId] = useState<string>("");
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof ClientStats | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editYearDialogOpen, setEditYearDialogOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<UniversityYear | null>(null);
  const [editTrimesterDialogOpen, setEditTrimesterDialogOpen] = useState(false);
  const [editingTrimester, setEditingTrimester] = useState<UniversityTrimester | null>(null);
  const [editModuleDialogOpen, setEditModuleDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<UniversityModule | null>(null);
  const [editLessonDialogOpen, setEditLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<UniversityLesson | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [applyTemplateDialogOpen, setApplyTemplateDialogOpen] = useState(false);
  const [templateToApply, setTemplateToApply] = useState<string>("");
  const [aiWizardOpen, setAiWizardOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Fetch only active clients
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients", "active"],
    queryFn: async () => {
      const response = await fetch("/api/clients?activeOnly=true", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch years assigned to selected client (for Manage Client tab)
  const { data: clientYears = [], isLoading: clientYearsLoading } = useQuery<UniversityYear[]>({
    queryKey: ["/api/university/clients", selectedClientId, "years"],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const response = await fetch(`/api/university/clients/${selectedClientId}/years`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch client years");
      return response.json();
    },
    enabled: !!selectedClientId,
    staleTime: 3 * 60 * 1000, // Cache for 3 minutes
  });

  // Auto-espandi tutti gli anni quando viene selezionato un cliente (non carica i dati, solo espande la UI)
  useEffect(() => {
    if (selectedClientId && clientYears.length > 0) {
      const allYearIds = clientYears.map(year => year.id);
      setExpandedYears(allYearIds);
    }
  }, [selectedClientId, clientYears]);

  // Fetch all years for consultant (for All Paths tab)
  const { data: allYears = [], isLoading: allYearsLoading } = useQuery<UniversityYear[]>({
    queryKey: ["/api/university/years"],
    queryFn: async () => {
      const response = await fetch("/api/university/years", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch years");
      return response.json();
    },
    staleTime: 3 * 60 * 1000, // Cache for 3 minutes
  });

  // Fetch client-specific stats
  const { data: stats } = useQuery<UniversityStats>({
    queryKey: ["/api/university/stats", selectedClientId],
    queryFn: async () => {
      const response = await fetch(`/api/university/stats/${selectedClientId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: !!selectedClientId,
  });

  // Fetch overview stats only for active clients
  const { data: overviewStats = [] } = useQuery<ClientStats[]>({
    queryKey: ["/api/university/stats/overview", "active"],
    queryFn: async () => {
      const response = await fetch("/api/university/stats/overview?activeOnly=true", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch overview stats");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch all exercises for the consultant
  const { data: allConsultantExercises = [] } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
    queryFn: async () => {
      const response = await fetch("/api/exercises", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch exercises");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch templates
  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/university/templates"],
    queryFn: async () => {
      const response = await fetch("/api/university/templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });

  // Fetch existing grades for selected client
  const { data: existingGrades = [] } = useQuery<ExistingGrade[]>({
    queryKey: ["/api/university/grades", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const response = await fetch(`/api/university/grades/${selectedClientId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch grades");
      return response.json();
    },
    enabled: !!selectedClientId,
  });

  // Fetch existing certificates for selected client
  const { data: existingCertificates = [] } = useQuery<ExistingCertificate[]>({
    queryKey: ["/api/university/certificates", selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const response = await fetch(`/api/university/certificates/${selectedClientId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch certificates");
      return response.json();
    },
    enabled: !!selectedClientId,
  });

  // Create year mutation
  const createYearMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; sortOrder: number; templateId?: string }) => {
      if (selectedClientsForYear.length === 0) {
        throw new Error("Devi selezionare almeno un cliente");
      }
      return await apiRequest("POST", "/api/university/years", data);
    },
    onSuccess: async (newYear) => {
      if (selectedClientsForYear.length > 0) {
        try {
          await apiRequest("POST", `/api/university/years/${newYear.id}/assignments`, {
            clientIds: selectedClientsForYear
          });
        } catch (error) {
          console.error("Error assigning clients:", error);
          toast({ 
            title: "Attenzione", 
            description: "Anno creato ma errore nell'assegnazione dei clienti", 
            variant: "destructive" 
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/university/years"] });
      queryClient.invalidateQueries({ queryKey: ["/api/university/stats/overview"] });
      selectedClientsForYear.forEach(clientId => {
        queryClient.invalidateQueries({ queryKey: ["/api/university/clients", clientId, "years"] });
      });
      setYearDialogOpen(false);
      setSelectedClientsForYear([]);
      toast({ title: "Anno creato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Create trimester mutation
  const createTrimesterMutation = useMutation({
    mutationFn: async (data: { yearId: string; title: string; description: string; sortOrder: number }) => {
      return await apiRequest("POST", "/api/university/trimesters", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/years"] });
      setTrimesterDialogOpen(false);
      toast({ title: "Trimestre creato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Create module mutation
  const createModuleMutation = useMutation({
    mutationFn: async (data: { trimesterId: string; title: string; description: string; sortOrder: number }) => {
      return await apiRequest("POST", "/api/university/modules", data);
    },
    onSuccess: (_, variables) => {
      // Invalidate years queries
      queryClient.invalidateQueries({ queryKey: ["/api/university/years"] });
      // Invalidate the specific trimester's modules query
      queryClient.invalidateQueries({ queryKey: ["/api/university/trimesters", variables.trimesterId, "modules"] });
      // Invalidate all trimesters queries to ensure consistency
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/university/trimesters" && query.queryKey[2] === "modules"
      });
      setModuleDialogOpen(false);
      toast({ title: "Modulo creato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Create lesson mutation
  const createLessonMutation = useMutation({
    mutationFn: async (data: { moduleId: string; title: string; description: string; resourceUrl?: string; exerciseId?: string; sortOrder: number; libraryDocumentId?: string }) => {
      return await apiRequest("POST", "/api/university/lessons", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/years"] });
      queryClient.invalidateQueries({ queryKey: ["/api/university/stats/overview"] });
      if (selectedClientId) {
        queryClient.invalidateQueries({ queryKey: ["/api/university/stats", selectedClientId] });
      }
      setLessonDialogOpen(false);
      toast({ title: "Lezione creata con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Create grade mutation
  const createGradeMutation = useMutation({
    mutationFn: async (data: { clientId: string; referenceType: string; referenceId: string; grade: number; feedback?: string }) => {
      return await apiRequest("POST", "/api/university/grades", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/stats", selectedClientId] });
      setGradeDialogOpen(false);
      setGradeContext(null);
      toast({ title: "Voto assegnato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Force complete lesson mutation
  const forceCompleteLessonMutation = useMutation({
    mutationFn: async ({ lessonId }: { lessonId: string }) => {
      return await apiRequest("PUT", `/api/university/progress/${selectedClientId}/${lessonId}`, {
        isCompleted: true,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/years"] });
      queryClient.invalidateQueries({ queryKey: ["/api/university/stats", selectedClientId] });
      // Invalida specificamente il progresso di questa lezione
      queryClient.invalidateQueries({ 
        queryKey: ["/api/university/progress", selectedClientId, variables.lessonId] 
      });
      // Invalida tutte le query di progresso per questo cliente
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/university/progress" && query.queryKey[1] === selectedClientId
      });
      toast({ title: "Lezione completata forzatamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Create certificate mutation
  const createCertificateMutation = useMutation({
    mutationFn: async (data: { clientId: string; certificateType: "trimester" | "year"; referenceId: string }) => {
      return await apiRequest("POST", "/api/university/certificates", data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/stats", selectedClientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/university/stats/overview"] });
      setCertificateDialogOpen(false);
      setCertificateContext(null);
      toast({ 
        title: "Attestato emesso con successo!", 
        description: `PDF generato e salvato correttamente${data.pdfUrl ? `: ${data.pdfUrl}` : ''}` 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Errore nell'emissione dell'attestato", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // Add client to year mutation
  const addClientToYearMutation = useMutation({
    mutationFn: async ({ yearId, clientIds }: { yearId: string; clientIds: string[] }) => {
      return await apiRequest("POST", `/api/university/years/${yearId}/assignments`, { clientIds });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/years", variables.yearId, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/university/stats/overview"] });
      variables.clientIds.forEach(clientId => {
        queryClient.invalidateQueries({ queryKey: ["/api/university/clients", clientId, "years"] });
      });
      toast({ title: "Cliente assegnato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Remove client from year mutation
  const removeClientFromYearMutation = useMutation({
    mutationFn: async ({ yearId, clientId }: { yearId: string; clientId: string }) => {
      return await apiRequest("DELETE", `/api/university/years/${yearId}/assignments/${clientId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/years", variables.yearId, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/university/stats/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/university/clients", variables.clientId, "years"] });
      toast({ title: "Cliente rimosso dall'anno" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Update year mutation
  const updateYearMutation = useMutation({
    mutationFn: async (data: { id: string; title: string; description: string; sortOrder: number }) => {
      console.log("🔄 Updating year with data:", data);
      const { id, ...updates } = data;
      return await apiRequest("PUT", `/api/university/years/${id}`, updates);
    },
    onSuccess: () => {
      // Invalidate all university years queries
      queryClient.invalidateQueries({ queryKey: ["/api/university/years"] });
      // Invalidate client-specific years query if a client is selected
      if (selectedClientId) {
        queryClient.invalidateQueries({ queryKey: ["/api/university/clients", selectedClientId, "years"] });
      }
      // Invalidate all client years queries to ensure consistency
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/university/clients" && query.queryKey[2] === "years"
      });
      setEditYearDialogOpen(false);
      setEditingYear(null);
      toast({ title: "Anno aggiornato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Delete year mutation
  const deleteYearMutation = useMutation({
    mutationFn: async (yearId: string) => {
      return await apiRequest("DELETE", `/api/university/years/${yearId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/years"] });
      queryClient.invalidateQueries({ queryKey: ["/api/university/stats/overview"] });
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/university/clients" && query.queryKey[2] === "years"
      });
      toast({ title: "Anno eliminato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Toggle year lock mutation
  const toggleYearLockMutation = useMutation({
    mutationFn: async ({ yearId, isLocked }: { yearId: string; isLocked: boolean }) => {
      return await apiRequest("PATCH", `/api/university/years/${yearId}/lock`, { isLocked });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/years"] });
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0] === "/api/university/clients" && query.queryKey[2] === "years"
      });
      toast({ 
        title: variables.isLocked ? "Anno bloccato" : "Anno sbloccato",
        description: variables.isLocked 
          ? "L'anno è ora visibile solo come 'da sbloccare' per i clienti" 
          : "L'anno è ora accessibile ai clienti" 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Update trimester mutation
  const updateTrimesterMutation = useMutation({
    mutationFn: async (data: { id: string; yearId: string; title: string; description: string; sortOrder: number }) => {
      const { id, ...updates } = data;
      return await apiRequest("PUT", `/api/university/trimesters/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/years"] });
      setEditTrimesterDialogOpen(false);
      setEditingTrimester(null);
      toast({ title: "Trimestre aggiornato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Delete trimester mutation
  const deleteTrimesterMutation = useMutation({
    mutationFn: async (trimesterId: string) => {
      return await apiRequest("DELETE", `/api/university/trimesters/${trimesterId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/years"] });
      toast({ title: "Trimestre eliminato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Update module mutation
  const updateModuleMutation = useMutation({
    mutationFn: async (data: { id: string; trimesterId: string; title: string; description: string; sortOrder: number }) => {
      const { id, ...updates } = data;
      return await apiRequest("PUT", `/api/university/modules/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/years"] });
      setEditModuleDialogOpen(false);
      setEditingModule(null);
      toast({ title: "Modulo aggiornato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Delete module mutation
  const deleteModuleMutation = useMutation({
    mutationFn: async (moduleId: string) => {
      return await apiRequest("DELETE", `/api/university/modules/${moduleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/years"] });
      toast({ title: "Modulo eliminato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Update lesson mutation
  const updateLessonMutation = useMutation({
    mutationFn: async (data: { id: string; moduleId: string; title: string; description: string; resourceUrl?: string; exerciseId?: string; sortOrder: number; libraryDocumentId?: string }) => {
      const { id, ...updates } = data;
      return await apiRequest("PUT", `/api/university/lessons/${id}`, updates);
    },
    onSuccess: (_, variables) => {
      // Invalidate years queries
      queryClient.invalidateQueries({ queryKey: ["/api/university/years"] });
      // Invalidate the specific module's lessons query to refresh the UI immediately
      queryClient.invalidateQueries({ queryKey: ["/api/university/modules", variables.moduleId, "lessons"] });
      // Invalidate all module lessons queries to ensure consistency
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          query.queryKey[0] === "/api/university/modules" && query.queryKey[2] === "lessons"
      });
      setEditLessonDialogOpen(false);
      setEditingLesson(null);
      toast({ title: "Lezione aggiornata con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Delete lesson mutation
  const deleteLessonMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      return await apiRequest("DELETE", `/api/university/lessons/${lessonId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/years"] });
      toast({ title: "Lezione eliminata con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; isActive: boolean }) => {
      return await apiRequest("POST", "/api/university/templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates"] });
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
      toast({ title: "Template creato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Apply template to selected client
  const applyTemplateToClientMutation = useMutation({
    mutationFn: async (data: { templateId: string; clientId: string; yearTitle: string }) => {
      const yearResponse = await apiRequest("POST", "/api/university/years", {
        title: data.yearTitle,
        description: `Anno creato da template`,
        sortOrder: 0,
        templateId: data.templateId
      });

      await apiRequest("POST", `/api/university/years/${yearResponse.id}/assignments`, {
        clientIds: [data.clientId]
      });

      return yearResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/years"] });
      queryClient.invalidateQueries({ queryKey: ["/api/university/stats/overview"] });
      if (selectedClientId) {
        queryClient.invalidateQueries({ queryKey: ["/api/university/clients", selectedClientId, "years"] });
      }
      setApplyTemplateDialogOpen(false);
      setTemplateToApply("");
      toast({ title: "Template applicato con successo al cliente" });
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
      toast({ title: "Template eliminato con successo" });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const toggleYear = (yearId: string) => {
    setExpandedYears(prev => 
      prev.includes(yearId) ? prev.filter(id => id !== yearId) : [...prev, yearId]
    );
  };

  const toggleTrimester = (trimesterId: string) => {
    setExpandedTrimesters(prev => 
      prev.includes(trimesterId) ? prev.filter(id => id !== trimesterId) : [...prev, trimesterId]
    );
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => 
      prev.includes(moduleId) ? prev.filter(id => id !== moduleId) : [...prev, moduleId]
    );
  };

  const handleCreateYear = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const yearData: any = {
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
    };

    if (selectedTemplateId) {
      yearData.templateId = selectedTemplateId;
    }

    createYearMutation.mutate(yearData);
  };

  const handleCreateTrimester = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createTrimesterMutation.mutate({
      yearId: selectedYearId,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
    });
  };

  const handleCreateModule = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createModuleMutation.mutate({
      trimesterId: selectedTrimesterId,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
    });
  };

  const handleCreateLesson = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createLessonMutation.mutate({
      moduleId: selectedModuleId,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      resourceUrl: formData.get("resourceUrl") as string || undefined,
      exerciseId: selectedExerciseId && selectedExerciseId !== "none" ? selectedExerciseId : undefined,
      libraryDocumentId: formData.get("libraryDocumentId") as string || undefined,
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
    });
  };

  const handleCreateGrade = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!gradeContext || !selectedClientId) return;

    const formData = new FormData(e.currentTarget);
    const gradeValue = parseFloat(formData.get("grade") as string);

    if (isNaN(gradeValue) || gradeValue < 1 || gradeValue > 10) {
      toast({ 
        title: "Errore", 
        description: "Il voto deve essere tra 1 e 10", 
        variant: "destructive" 
      });
      return;
    }

    createGradeMutation.mutate({
      clientId: selectedClientId,
      referenceType: gradeContext.type,
      referenceId: gradeContext.id,
      grade: gradeValue,
      feedback: formData.get("feedback") as string || undefined,
    });
  };

  const handleIssueCertificate = () => {
    if (!certificateContext || !selectedClientId) return;

    createCertificateMutation.mutate({
      clientId: selectedClientId,
      certificateType: certificateContext.type,
      referenceId: certificateContext.id,
    });
  };

  const useTrimesters = (yearId: string) => {
    return useQuery<UniversityTrimester[]>({
      queryKey: ["/api/university/years", yearId, "trimesters"],
      queryFn: async () => {
        const response = await fetch(`/api/university/years/${yearId}/trimesters`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error("Failed to fetch trimesters");
        return response.json();
      },
      enabled: expandedYears.includes(yearId),
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });
  };

  const useModules = (trimesterId: string) => {
    return useQuery<UniversityModule[]>({
      queryKey: ["/api/university/trimesters", trimesterId, "modules"],
      queryFn: async () => {
        const response = await fetch(`/api/university/trimesters/${trimesterId}/modules`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error("Failed to fetch modules");
        return response.json();
      },
      enabled: expandedTrimesters.includes(trimesterId),
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });
  };

  const useLessons = (moduleId: string) => {
    return useQuery<UniversityLesson[]>({
      queryKey: ["/api/university/modules", moduleId, "lessons"],
      queryFn: async () => {
        const response = await fetch(`/api/university/modules/${moduleId}/lessons`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error("Failed to fetch lessons");
        return response.json();
      },
      enabled: expandedModules.includes(moduleId),
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });
  };

  const useYearAssignments = (yearId: string) => {
    return useQuery<YearAssignment[]>({
      queryKey: ["/api/university/years", yearId, "assignments"],
      queryFn: async () => {
        const response = await fetch(`/api/university/years/${yearId}/assignments`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error("Failed to fetch assignments");
        return response.json();
      },
      staleTime: 3 * 60 * 1000, // Cache for 3 minutes
    });
  };

  const useClientYears = (clientId: string) => {
    return useQuery<UniversityYear[]>({
      queryKey: ["/api/university/clients", clientId, "years"],
      queryFn: async () => {
        if (!clientId) return [];
        const response = await fetch(`/api/university/clients/${clientId}/years`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error("Failed to fetch client years");
        return response.json();
      },
      enabled: !!clientId,
      staleTime: 3 * 60 * 1000, // Cache for 3 minutes
    });
  };

  // Hook for fetching lesson progress
  const useLessonProgress = (clientId: string | null, lessonId: string) => {
    return useQuery<any | null>({
      queryKey: ["/api/university/progress", clientId, lessonId],
      queryFn: async () => {
        if (!clientId) return null;
        try {
          const response = await fetch(`/api/university/progress/${clientId}/${lessonId}`, {
            headers: getAuthHeaders(),
          });
          if (!response.ok) {
            // If lesson progress is not found, it's considered not completed
            return null; 
          }
          return await response.json();
        } catch (error) {
          console.error("Error fetching lesson progress:", error);
          return null;
        }
      },
      enabled: !!clientId && !!lessonId,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const toggleClientSelection = (clientId: string) => {
    setSelectedClientsForYear(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleSort = (column: keyof ClientStats) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const formatEnrollmentDate = (date: Date | null) => {
    if (!date) return "-";
    const enrollDate = new Date(date);
    const daysDiff = Math.floor((new Date().getTime() - enrollDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff < 30) {
      return formatDistanceToNow(enrollDate, { addSuffix: true, locale: it });
    }
    return format(enrollDate, "dd/MM/yyyy", { locale: it });
  };

  const filteredAndSortedStats = useMemo(() => {
    let filtered = overviewStats.filter((stat) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        (stat.clientName && stat.clientName.toLowerCase().includes(searchLower)) ||
        (stat.clientEmail && stat.clientEmail.toLowerCase().includes(searchLower)) ||
        (stat.currentPath && stat.currentPath.toLowerCase().includes(searchLower))
      );
    });

    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aValue = a[sortColumn];
        let bValue = b[sortColumn];

        if (sortColumn === "enrolledAt") {
          aValue = aValue ? new Date(aValue as Date).getTime() : 0;
          bValue = bValue ? new Date(bValue as Date).getTime() : 0;
        }

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (typeof aValue === "string" && typeof bValue === "string") {
          return sortDirection === "asc" 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }

        if (typeof aValue === "number" && typeof bValue === "number") {
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
        }

        return 0;
      });
    }

    return filtered;
  }, [overviewStats, searchQuery, sortColumn, sortDirection]);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [clients]);

  // Helper to get exercise status badge
  const getExerciseStatusBadge = (assignment: any) => {
    switch (assignment.status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500 text-white text-xs mr-2">Completato</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="text-blue-600 border-blue-200 text-xs mr-2">In corso</Badge>;
      case 'not_started':
      default:
        return <Badge variant="outline" className="text-orange-600 border-orange-200 text-xs mr-2">Non iniziato</Badge>;
    }
  };

return (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
    {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
    <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
      <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-y-auto bg-transparent">
        <div className="container mx-auto px-4 lg:px-8 pt-6 pb-8">
          {/* Header Moderno Minimalista */}
          <div className="mb-8">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 lg:p-8 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
              {/* Accenti decorativi */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl"></div>

              <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl shadow-lg shadow-cyan-500/25">
                    <GraduationCap className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">La Mia Università</h1>
                    <p className="text-slate-400 text-sm lg:text-base mt-0.5">
                      Gestisci i percorsi formativi dei tuoi clienti
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => setAiWizardOpen(true)}
                    className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white border-0 shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl"
                    size="default"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Crea con AI
                  </Button>
                  <Button
                    onClick={() => {
                      if (selectedClientId) {
                        setApplyTemplateDialogOpen(true);
                      } else {
                        setEditingTemplate(null);
                        setTemplateDialogOpen(true);
                      }
                    }}
                    variant="outline"
                    className="bg-slate-800/50 hover:bg-slate-700/50 text-white border-slate-600 hover:border-slate-500"
                    size="default"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Template
                  </Button>
                  <Button
                    onClick={() => setYearDialogOpen(true)}
                    className="bg-white text-slate-900 hover:bg-slate-100 border-0 font-semibold"
                    size="default"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nuovo Anno
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard Clienti
              </TabsTrigger>
              <TabsTrigger value="manage" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Gestione Cliente
              </TabsTrigger>
              <TabsTrigger 
                value="templates" 
                className="flex items-center gap-2"
                onClick={(e) => {
                  e.preventDefault();
                  setLocation("/consultant/templates");
                }}
              >
                <FolderKanban className="h-4 w-4" />
                Template
              </TabsTrigger>
            </TabsList>

            {/* Dashboard Tab */}
            <TabsContent value="dashboard">
              <div className="space-y-6">
                {/* Header con ricerca */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Panoramica Clienti</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {overviewStats.length} {overviewStats.length === 1 ? 'cliente attivo' : 'clienti attivi'}
                    </p>
                  </div>
                  {overviewStats.length > 0 && (
                    <div className="relative w-full sm:w-auto">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Cerca cliente..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 w-full sm:w-72 bg-background border-border"
                      />
                    </div>
                  )}
                </div>

                {overviewStats.length === 0 ? (
                  <Card className="border border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <Users className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground text-center">Nessun cliente con percorso universitario attivo</p>
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => setYearDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Crea primo percorso
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {/* Sorting Pills */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleSort("clientName")}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                          sortColumn === "clientName" 
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' 
                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        }`}
                      >
                        Nome {sortColumn === "clientName" && (sortDirection === "asc" ? "↑" : "↓")}
                      </button>
                      <button
                        onClick={() => handleSort("completionPercentage")}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                          sortColumn === "completionPercentage" 
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' 
                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        }`}
                      >
                        Progresso {sortColumn === "completionPercentage" && (sortDirection === "asc" ? "↑" : "↓")}
                      </button>
                      <button
                        onClick={() => handleSort("averageGrade")}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                          sortColumn === "averageGrade" 
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' 
                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        }`}
                      >
                        Media {sortColumn === "averageGrade" && (sortDirection === "asc" ? "↑" : "↓")}
                      </button>
                      <button
                        onClick={() => handleSort("enrolledAt")}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                          sortColumn === "enrolledAt" 
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' 
                            : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        }`}
                      >
                        Data {sortColumn === "enrolledAt" && (sortDirection === "asc" ? "↑" : "↓")}
                      </button>
                    </div>

                    {/* Client Cards */}
                    {filteredAndSortedStats.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        Nessun risultato trovato per "{searchQuery}"
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredAndSortedStats.map((clientStats) => {
                          const isExpanded = expandedDashboardClients.includes(clientStats.clientId);
                          const client = clients.find(c => c.id === clientStats.clientId);
                          return (
                            <div key={clientStats.clientId}>
                              <div 
                                className={`bg-card border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                                  isExpanded ? 'border-cyan-500/50 shadow-sm' : 'border-border hover:border-border/80'
                                }`}
                                onClick={() => {
                                  setExpandedDashboardClients(prev => 
                                    prev.includes(clientStats.clientId) 
                                      ? prev.filter(id => id !== clientStats.clientId)
                                      : [...prev, clientStats.clientId]
                                  );
                                }}
                              >
                                <div className="flex items-center gap-4">
                                  {/* Avatar */}
                                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                    {clientStats.clientName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </div>
                                  
                                  {/* Info principale */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h3 className="font-semibold text-foreground truncate">{clientStats.clientName}</h3>
                                      <span className="text-xs text-muted-foreground hidden sm:inline">
                                        · {formatEnrollmentDate(clientStats.enrolledAt)}
                                      </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground truncate">
                                      {clientStats.currentPath || "Nessun percorso attivo"}
                                    </p>
                                  </div>

                                  {/* Stats compatte */}
                                  <div className="hidden md:flex items-center gap-6">
                                    {/* Progresso */}
                                    <div className="flex items-center gap-2">
                                      <div className="w-24">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-xs text-muted-foreground">Progresso</span>
                                          <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">{clientStats.completionPercentage}%</span>
                                        </div>
                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full transition-all"
                                            style={{ width: `${clientStats.completionPercentage}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    {/* Media */}
                                    <div className="text-center">
                                      <p className="text-xs text-muted-foreground mb-0.5">Media</p>
                                      <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                                        {clientStats.averageGrade ? clientStats.averageGrade.toFixed(1) : '-'}
                                      </p>
                                    </div>

                                    {/* Attestati */}
                                    <div className="text-center">
                                      <p className="text-xs text-muted-foreground mb-0.5">Attestati</p>
                                      <p className="text-sm font-semibold">{clientStats.totalCertificates}</p>
                                    </div>
                                  </div>

                                  {/* Expand arrow */}
                                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>

                                {/* Stats mobile */}
                                <div className="flex md:hidden items-center gap-4 mt-3 pt-3 border-t">
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs text-muted-foreground">Progresso</span>
                                      <span className="text-xs font-semibold text-cyan-600">{clientStats.completionPercentage}%</span>
                                    </div>
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full"
                                        style={{ width: `${clientStats.completionPercentage}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1">
                                      <Star className="h-3 w-3 text-amber-500" />
                                      <span className="text-xs font-medium">{clientStats.averageGrade ? clientStats.averageGrade.toFixed(1) : '-'}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Award className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-xs font-medium">{clientStats.totalCertificates}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Expanded content */}
                              {isExpanded && client && (
                                <div className="mt-2 ml-4 pl-4 border-l-2 border-cyan-500/30">
                                  <div className="bg-muted/30 rounded-xl p-4">
                                    <ClientPathsInline
                                      client={client}
                                      useClientYears={useClientYears}
                                      useTrimesters={useTrimesters}
                                      onEditYear={(year: UniversityYear) => {
                                        setEditingYear(year);
                                        setEditYearDialogOpen(true);
                                      }}
                                      onDeleteYear={(yearId: string) => {
                                        deleteYearMutation.mutate(yearId);
                                      }}
                                      onToggleLock={(yearId: string, isLocked: boolean) => {
                                        toggleYearLockMutation.mutate({ yearId, isLocked });
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Manage Client Tab */}
            <TabsContent value="manage">
              <div className="space-y-6">
                {!selectedClientId ? (
                  <Card className="border-0 shadow-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-1">
                      <div className="bg-background p-8 rounded-t-lg">
                        <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
                          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mb-6">
                            <Users className="h-10 w-10 text-indigo-600" />
                          </div>
                          <h3 className="text-2xl font-bold mb-3">Seleziona un Cliente</h3>
                          <p className="text-muted-foreground mb-6">
                            Scegli un cliente dall'elenco per gestire il suo percorso universitario
                          </p>
                          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                            <SelectTrigger className="w-full max-w-md h-14 text-lg border-2 border-primary/30 hover:border-primary focus:border-primary transition-colors">
                              <SelectValue placeholder="🎓 Seleziona cliente..." />
                            </SelectTrigger>
                            <SelectContent>
                              {clients.map((client) => (
                                <SelectItem key={client.id} value={client.id} className="text-base py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                                      {client.firstName[0]}{client.lastName[0]}
                                    </div>
                                    <div className="text-left">
                                      <div className="font-medium">{client.firstName} {client.lastName}</div>
                                      <div className="text-xs text-muted-foreground">{client.email}</div>
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <>
                    {/* Client Info Bar - Spostato in alto, fuori dal mapping degli anni */}
                    <Card className="border-0 shadow-lg sticky top-0 z-10 bg-background/95 backdrop-blur">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                              {selectedClient?.firstName[0]}{selectedClient?.lastName[0]}
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{selectedClient?.firstName} {selectedClient?.lastName}</h3>
                              <p className="text-sm text-muted-foreground">{selectedClient?.email}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedClientId("")}
                            className="shrink-0"
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Cambia Cliente
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Stats Cards - Design Minimalista */}
                    {stats && (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Card Completamento */}
                        <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/50 dark:to-emerald-800/50 rounded-xl flex items-center justify-center">
                            <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={24} />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Completamento</p>
                            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completionPercentage}%</p>
                          </div>
                        </div>

                        {/* Card Lezioni */}
                        <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-cyan-200 dark:from-cyan-900/50 dark:to-cyan-800/50 rounded-xl flex items-center justify-center">
                            <BookOpen className="text-cyan-600 dark:text-cyan-400" size={24} />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Lezioni</p>
                            <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{stats.completedLessons}/{stats.totalLessons}</p>
                          </div>
                        </div>

                        {/* Card Media Voti */}
                        <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/50 dark:to-amber-800/50 rounded-xl flex items-center justify-center">
                            <Star className="text-amber-600 dark:text-amber-400" size={24} />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Media Voti</p>
                            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                              {stats.averageGrade ? stats.averageGrade.toFixed(1) : '-'}/10
                            </p>
                          </div>
                        </div>

                        {/* Card Attestati */}
                        <div className="bg-card border rounded-xl p-4 flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-violet-100 to-violet-200 dark:from-violet-900/50 dark:to-violet-800/50 rounded-xl flex items-center justify-center">
                            <Award className="text-violet-600 dark:text-violet-400" size={24} />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Attestati</p>
                            <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{stats.totalCertificates}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {selectedClientId && (
                  <>
                    {clientYearsLoading ? (
                      <div className="text-center py-12">Caricamento...</div>
                    ) : clientYears.length === 0 ? (
                      <Card className="border border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <GraduationCap className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-semibold mb-2">Nessun anno accademico</h3>
                          <p className="text-muted-foreground text-center mb-4">Inizia creando il primo anno del percorso universitario</p>
                          <div className="flex gap-3">
                            <Button onClick={() => setYearDialogOpen(true)} variant="outline">
                              <Plus className="h-4 w-4 mr-2" />
                              Crea Primo Anno
                            </Button>
                            {templates.filter((t: any) => t.isActive).length > 0 && (
                              <Button 
                                onClick={() => setApplyTemplateDialogOpen(true)} 
                                className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Assegna da Template
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {clientYears.map((year) => (
                          <YearCard
                            key={year.id}
                            year={year}
                            selectedClientId={selectedClientId}
                            isExpanded={expandedYears.includes(year.id)}
                            onToggle={() => toggleYear(year.id)}
                            useTrimesters={useTrimesters}
                            useYearAssignments={useYearAssignments}
                            clients={clients}
                            expandedTrimesters={expandedTrimesters}
                            toggleTrimester={toggleTrimester}
                            useModules={useModules}
                            expandedModules={expandedModules}
                            toggleModule={toggleModule}
                            useLessons={useLessons}
                            allConsultantExercises={allConsultantExercises}
                            existingGrades={existingGrades}
                            existingCertificates={existingCertificates}
                            onAddTrimester={() => {
                              setSelectedYearId(year.id);
                              setTrimesterDialogOpen(true);
                            }}
                            onAddModule={(trimesterId: string) => {
                              setSelectedTrimesterId(trimesterId);
                              setModuleDialogOpen(true);
                            }}
                            onAddLesson={(moduleId: string) => {
                              setSelectedModuleId(moduleId);
                              setLessonDialogOpen(true);
                            }}
                            onAssignGrade={(type: "module" | "trimester" | "year", id: string, title: string) => {
                              setGradeContext({ type, id, title });
                              setGradeDialogOpen(true);
                            }}
                            onIssueCertificate={(type: "trimester" | "year", id: string, title: string) => {
                              setCertificateContext({ type, id, title });
                              setCertificateDialogOpen(true);
                            }}
                            onForceComplete={(lessonId: string) => {
                              forceCompleteLessonMutation.mutate({ lessonId });
                            }}
                            onAddClientToYear={(yearId: string, clientIds: string[]) => {
                              addClientToYearMutation.mutate({ yearId, clientIds });
                            }}
                            onRemoveClientFromYear={(yearId: string, clientId: string) => {
                              removeClientFromYearMutation.mutate({ yearId, clientId });
                            }}
                            onEditYear={(year: UniversityYear) => {
                              console.log("🔧 Setting editingYear in Manage Client tab:", year);
                              console.log("🔧 Year details:", {
                                id: year.id,
                                title: year.title,
                                description: year.description,
                                sortOrder: year.sortOrder
                              });
                              setEditingYear(year);
                              setEditYearDialogOpen(true);
                            }}
                            onDeleteYear={(yearId: string) => {
                              deleteYearMutation.mutate(yearId);
                            }}
                            onEditTrimester={(trimester: UniversityTrimester) => {
                              setEditingTrimester(trimester);
                              setEditTrimesterDialogOpen(true);
                            }}
                            onDeleteTrimester={(trimesterId: string) => {
                              deleteTrimesterMutation.mutate(trimesterId);
                            }}
                            onEditModule={(module: UniversityModule) => {
                              setEditingModule(module);
                              setEditModuleDialogOpen(true);
                            }}
                            onDeleteModule={(moduleId: string) => {
                              deleteModuleMutation.mutate(moduleId);
                            }}
                            onEditLesson={(lesson: UniversityLesson) => {
                              setEditingLesson(lesson);
                              setSelectedExerciseId(lesson.exerciseId || "");
                              setEditLessonDialogOpen(true);
                            }}
                            onDeleteLesson={(lessonId: string) => {
                              deleteLessonMutation.mutate(lessonId);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Apply Template Dialog */}
                <Dialog open={applyTemplateDialogOpen} onOpenChange={setApplyTemplateDialogOpen}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Applica Template al Cliente</DialogTitle>
                      <DialogDescription>
                        Seleziona un template da applicare a {selectedClient?.firstName} {selectedClient?.lastName}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                      e.preventDefault();

                      if (!templateToApply || !selectedClientId) {
                        toast({ 
                          title: "Errore", 
                          description: "Seleziona un template", 
                          variant: "destructive" 
                        });
                        return;
                      }

                      // Trova il template selezionato per prendere il nome
                      const selectedTemplate = templates.find(t => t.id === templateToApply);
                      if (!selectedTemplate) {
                        toast({ 
                          title: "Errore", 
                          description: "Template non trovato", 
                          variant: "destructive" 
                        });
                        return;
                      }

                      applyTemplateToClientMutation.mutate({
                        templateId: templateToApply,
                        clientId: selectedClientId,
                        yearTitle: selectedTemplate.name // Usa il nome del template come titolo anno
                      });
                    }} className="space-y-4">
                      <div>
                        <Label htmlFor="templateSelect">Seleziona Template *</Label>
                        <Select value={templateToApply} onValueChange={setTemplateToApply} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Scegli un template..." />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.filter(t => t.isActive).map((template: any) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                                {template.description && (
                                  <span className="text-xs text-muted-foreground block">
                                    {template.description}
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {templateToApply && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Titolo Anno:</strong> {templates.find(t => t.id === templateToApply)?.name}
                          </p>
                        </div>
                      )}

                      <div className="flex justify-end gap-3 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => {
                            setApplyTemplateDialogOpen(false);
                            setTemplateToApply("");
                          }}
                        >
                          Annulla
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={applyTemplateToClientMutation.isPending}
                          className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600"
                        >
                          {applyTemplateToClientMutation.isPending ? "Applicazione..." : "Applica Template"}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={yearDialogOpen} onOpenChange={(open) => {
                  setYearDialogOpen(open);
                  if (!open) setSelectedClientsForYear([]);
                }}>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Crea Nuovo Anno Accademico</DialogTitle>
                      <DialogDescription>
                        Aggiungi un nuovo anno al percorso universitario. È obbligatorio assegnare almeno un cliente.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateYear} className="space-y-4">
                      <div>
                        <Label htmlFor="title">Titolo *</Label>
                        <Input id="title" name="title" placeholder="es. Anno 1 - Fondazioni" required />
                      </div>
                      <div>
                        <Label htmlFor="description">Descrizione</Label>
                        <Textarea id="description" name="description" placeholder="Descrizione dell'anno accademico" />
                      </div>
                      <div>
                        <Label htmlFor="sortOrder">Ordine</Label>
                        <Input id="sortOrder" name="sortOrder" type="number" defaultValue="0" />
                      </div>

                      {templates.filter(t => t.isActive).length > 0 && (
                        <div>
                          <Label htmlFor="templateId">Template (opzionale)</Label>
                          <Select value={selectedTemplateId || "none"} onValueChange={(value) => setSelectedTemplateId(value === "none" ? "" : value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona un template..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nessun template</SelectItem>
                              {templates.filter(t => t.isActive).map((template: any) => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedTemplateId && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Il template verrà utilizzato per pre-compilare la struttura dell'anno
                            </p>
                          )}
                        </div>
                      )}

                      <div className="border-t pt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <UserPlus className="h-4 w-4 text-primary" />
                          <Label className="text-base font-semibold">Assegna Clienti *</Label>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          Seleziona almeno un cliente da assegnare a questo anno accademico
                        </p>
                        {clients.length === 0 ? (
                          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                            <p className="text-sm text-destructive font-medium">Nessun cliente disponibile</p>
                            <p className="text-xs text-muted-foreground mt-1">Devi avere almeno un cliente attivo per creare un anno accademico</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-muted/20">
                            {clients.map((client) => (
                              <div
                                key={client.id}
                                className="flex items-start space-x-3 p-2 rounded-md hover:bg-accent transition-colors"
                              >
                                <Checkbox
                                  id={`client-${client.id}`}
                                  checked={selectedClientsForYear.includes(client.id)}
                                  onCheckedChange={() => toggleClientSelection(client.id)}
                                />
                                <label
                                  htmlFor={`client-${client.id}`}
                                  className="flex-1 cursor-pointer"
                                >
                                  <div className="font-medium text-sm">
                                    {client.firstName} {client.lastName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {client.email}
                                  </div>
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                        {selectedClientsForYear.length === 0 && clients.length > 0 && (
                          <p className="text-sm text-destructive mt-2 font-medium">
                            ⚠️ Devi selezionare almeno un cliente
                          </p>
                        )}
                        {selectedClientsForYear.length > 0 && (
                          <p className="text-sm text-primary mt-2">
                            {selectedClientsForYear.length} cliente{selectedClientsForYear.length > 1 ? 'i' : ''} selezionato{selectedClientsForYear.length > 1 ? 'i' : ''}
                          </p>
                        )}
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={createYearMutation.isPending || selectedClientsForYear.length === 0 || clients.length === 0}
                      >
                        {createYearMutation.isPending ? "Creazione..." : "Crea Anno"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>

                {/* Template Management Dialog */}
                <Dialog open={templateDialogOpen} onOpenChange={(open) => {
                  setTemplateDialogOpen(open);
                  if (!open) setEditingTemplate(null);
                }}>
                  <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingTemplate ? "Modifica Template" : "Gestisci Template Universitari"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingTemplate
                          ? "Modifica il template universitario"
                          : "Crea e gestisci template per facilitare la creazione di anni accademici"}
                      </DialogDescription>
                    </DialogHeader>

                    {!editingTemplate && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-semibold">Template Disponibili</h3>
                          <Button
                            onClick={() => setEditingTemplate({})}
                            size="sm"
                            variant="outline"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Nuovo Template
                          </Button>
                        </div>

                        {templates.length === 0 ? (
                          <div className="text-center py-8 bg-muted/30 rounded-lg">
                            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                            <p className="text-muted-foreground">Nessun template disponibile</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Crea il tuo primo template per iniziare
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {templates.map((template: any) => (
                              <div
                                key={template.id}
                                className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <h4 className="font-semibold">{template.name}</h4>
                                    <Badge variant={template.isActive ? "default" : "secondary"}>
                                      {template.isActive ? "Attivo" : "Inattivo"}
                                    </Badge>
                                  </div>
                                  {template.description && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {template.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => setEditingTemplate(template)}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    Modifica
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      if (confirm("Sei sicuro di voler eliminare questo template?")) {
                                        deleteTemplateMutation.mutate(template.id);
                                      }
                                    }}
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {editingTemplate && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const data = {
                            name: formData.get("name") as string,
                            description: formData.get("description") as string,
                            isActive: formData.get("isActive") === "on",
                          };

                          if (editingTemplate.id) {
                            updateTemplateMutation.mutate({ id: editingTemplate.id, ...data });
                          } else {
                            createTemplateMutation.mutate(data);
                          }
                        }}
                        className="space-y-4"
                      >
                        <div>
                          <Label htmlFor="template-name">Nome Template *</Label>
                          <Input
                            id="template-name"
                            name="name"
                            defaultValue={editingTemplate.name || ""}
                            placeholder="es. Template Base Università"
                            required
                          />
                        </div>

                        <div>
                          <Label htmlFor="template-description">Descrizione</Label>
                          <Textarea
                            id="template-description"
                            name="description"
                            defaultValue={editingTemplate.description || ""}
                            placeholder="Descrizione del template..."
                            rows={3}
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="template-isActive"
                            name="isActive"
                            defaultChecked={editingTemplate.isActive ?? true}
                          />
                          <Label
                            htmlFor="template-isActive"
                            className="text-sm font-normal cursor-pointer"
                          >
                            Template attivo (disponibile per la selezione)
                          </Label>
                        </div>

                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setEditingTemplate(null)}
                            className="flex-1"
                          >
                            Annulla
                          </Button>
                          <Button type="submit" className="flex-1">
                            {editingTemplate.id ? "Aggiorna" : "Crea"} Template
                          </Button>
                        </div>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>

                <Dialog open={trimesterDialogOpen} onOpenChange={setTrimesterDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Crea Nuovo Trimestre</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateTrimester} className="space-y-4">
                      <div>
                        <Label htmlFor="trimester-title">Titolo *</Label>
                        <Input id="trimester-title" name="title" placeholder="es. Q1 - Mindset e Diagnosi" required />
                      </div>
                      <div>
                        <Label htmlFor="trimester-description">Descrizione</Label>
                        <Textarea id="trimester-description" name="description" />
                      </div>
                      <div>
                        <Label htmlFor="trimester-sortOrder">Ordine</Label>
                        <Input id="trimester-sortOrder" name="sortOrder" type="number" defaultValue="0" />
                      </div>
                      <Button type="submit" className="w-full">Crea Trimestre</Button>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Crea Nuovo Modulo</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateModule} className="space-y-4">
                      <div>
                        <Label htmlFor="module-title">Titolo *</Label>
                        <Input id="module-title" name="title" placeholder="es. Fondamenti di Marketing" required />
                      </div>
                      <div>
                        <Label htmlFor="module-description">Descrizione</Label>
                        <Textarea id="module-description" name="description" />
                      </div>
                      <div>
                        <Label htmlFor="module-sortOrder">Ordine</Label>
                        <Input id="module-sortOrder" name="sortOrder" type="number" defaultValue="0" />
                      </div>
                      <Button type="submit" className="w-full">Crea Modulo</Button>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={lessonDialogOpen} onOpenChange={(open) => {
                  setLessonDialogOpen(open);
                  if (!open) setSelectedExerciseId("");
                }}>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-xl">
                        <BookOpen className="h-5 w-5 text-indigo-600" />
                        Crea Nuova Lezione
                      </DialogTitle>
                      <DialogDescription>
                        Configura tutti i dettagli della lezione per il tuo cliente
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateLesson} className="space-y-6">
                      {/* Informazioni Base */}
                      <div className="space-y-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl border-2 border-blue-100 dark:border-blue-900">
                        <h3 className="font-semibold text-base flex items-center gap-2 text-blue-900 dark:text-blue-100">
                          <BookOpen className="h-4 w-4" />
                          Informazioni Base
                        </h3>

                        <div>
                          <Label htmlFor="lesson-title">Titolo *</Label>
                          <Input 
                            id="lesson-title" 
                            name="title" 
                            placeholder="es. Introduzione al Marketing Digitale" 
                            required 
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label htmlFor="lesson-description">Descrizione</Label>
                          <Textarea 
                            id="lesson-description" 
                            name="description" 
                            placeholder="Descrivi gli obiettivi e i contenuti della lezione..."
                            rows={3}
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label htmlFor="lesson-sortOrder">Ordine</Label>
                          <Input 
                            id="lesson-sortOrder" 
                            name="sortOrder" 
                            type="number" 
                            defaultValue="0"
                            className="mt-2"
                          />
                        </div>
                      </div>

                      {/* Risorse e Materiali */}
                      <div className="space-y-4 p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl border-2 border-purple-100 dark:border-purple-900">
                        <h3 className="font-semibold text-base flex items-center gap-2 text-purple-900 dark:text-purple-100">
                          <Target className="h-4 w-4" />
                          Risorse e Materiali
                        </h3>

                        <div>
                          <Label htmlFor="lesson-resourceUrl">Link Risorsa Esterna</Label>
                          <Input 
                            id="lesson-resourceUrl" 
                            name="resourceUrl" 
                            type="url" 
                            placeholder="https://..."
                            className="mt-2"
                          />
                        </div>

                        {/* Esercizio Collegato */}
                        <div className="border-t pt-4">
                          <EditLessonExerciseSelector
                            selectedClientId={selectedClientId}
                            allConsultantExercises={allConsultantExercises}
                            selectedExerciseId={selectedExerciseId}
                            setSelectedExerciseId={setSelectedExerciseId}
                          />
                        </div>
                      </div>

                      {/* Lezione Corso Collegata */}
                      <div className="space-y-4 p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-xl border-2 border-amber-100 dark:border-amber-900">
                        <h3 className="font-semibold text-base flex items-center gap-2 text-amber-900 dark:text-amber-100">
                          <BookOpen className="h-4 w-4" />
                          Lezione del Corso
                        </h3>
                        
                        <LibraryDocumentTableSelector
                          selectedDocumentId=""
                          onDocumentSelect={(documentId) => {
                            const input = document.querySelector('input[name="libraryDocumentId"]') as HTMLInputElement;
                            if (input) input.value = documentId;
                          }}
                        />
                        <input
                          type="hidden"
                          name="libraryDocumentId"
                          defaultValue=""
                        />
                      </div>

                      {/* Bottoni Azione */}
                      <div className="flex gap-3 pt-2">
                        <Button 
                          type="button"
                          variant="outline" 
                          onClick={() => setLessonDialogOpen(false)}
                          className="flex-1"
                        >
                          Annulla
                        </Button>
                        <Button 
                          type="submit" 
                          className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Crea Lezione
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={gradeDialogOpen} onOpenChange={setGradeDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Assegna Voto</DialogTitle>
                      <DialogDescription>
                        {gradeContext && `Assegna voto per: ${gradeContext.title}`}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateGrade} className="space-y-4">
                      <div>
                        <Label htmlFor="grade">Voto (1-10) *</Label>
                        <Input 
                          id="grade" 
                          name="grade" 
                          type="number" 
                          min="1" 
                          max="10" 
                          step="0.1"
                          required 
                          placeholder="es. 8.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="feedback">Feedback (opzionale)</Label>
                        <Textarea 
                          id="feedback" 
                          name="feedback" 
                          placeholder="Inserisci un feedback per il cliente..."
                          rows={4}
                        />
                      </div>
                      <Button type="submit" className="w-full">Assegna Voto</Button>
                    </form>
                  </DialogContent>
                </Dialog>

                <Dialog open={editYearDialogOpen && !!editingYear} onOpenChange={(open) => {
                  console.log("🔄 Edit Year Dialog open changed:", open, "editingYear:", editingYear);
                  setEditYearDialogOpen(open);
                  if (!open) setEditingYear(null);
                }}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Modifica Anno Accademico</DialogTitle>
                      <DialogDescription>
                        Modifica il titolo e l'ordine dell'anno. Il titolo viene recuperato dal template, l'ordine determina la sequenza di visualizzazione.
                      </DialogDescription>
                    </DialogHeader>
                    {editingYear && (
                      <form key={editingYear.id} onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        console.log("📤 Form submission - editingYear:", editingYear);
                        console.log("📤 Form data:", {
                          title: formData.get("title"),
                          description: formData.get("description"),
                          sortOrder: formData.get("sortOrder")
                        });
                        updateYearMutation.mutate({
                          id: editingYear.id,
                          title: formData.get("title") as string,
                          description: formData.get("description") as string,
                          sortOrder: parseInt(formData.get("sortOrder") as string) || editingYear.sortOrder,
                        });
                      }} className="space-y-4">
                        <div>
                          <Label htmlFor="edit-year-title">Titolo Anno *</Label>
                          <Input 
                            id="edit-year-title" 
                            name="title" 
                            defaultValue={editingYear.title} 
                            placeholder="es. Anno 1 – Costruzione delle Fondamenta"
                            required 
                            onFocus={() => {
                              console.log("📝 Title field focused - current value:", editingYear.title);
                              console.log("📝 Full editingYear object:", editingYear);
                            }}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Il titolo viene dal template selezionato in fase di creazione
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="edit-year-description">Descrizione</Label>
                          <Textarea 
                            id="edit-year-description" 
                            name="description" 
                            defaultValue={editingYear.description || ""} 
                            placeholder="Descrizione dettagliata dell'anno..."
                            rows={3}
                            onFocus={() => {
                              console.log("📝 Description field focused - current value:", editingYear.description);
                            }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-year-sortOrder">Ordine di Visualizzazione</Label>
                          <Input 
                            id="edit-year-sortOrder" 
                            name="sortOrder" 
                            type="number" 
                            defaultValue={editingYear.sortOrder?.toString() || "0"} 
                            onFocus={() => {
                              console.log("📝 SortOrder field focused - current value:", editingYear.sortOrder);
                            }}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Numeri più bassi appariranno prima (Anno 1 = ordine 1, Anno 2 = ordine 2, ecc.)
                          </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => {
                              setEditYearDialogOpen(false);
                              setEditingYear(null);
                            }}
                            className="flex-1"
                          >
                            Annulla
                          </Button>
                          <Button 
                            type="submit" 
                            className="flex-1"
                            disabled={updateYearMutation.isPending}
                          >
                            {updateYearMutation.isPending ? "Salvataggio..." : "Salva Modifiche"}
                          </Button>
                        </div>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>

                <Dialog open={editTrimesterDialogOpen} onOpenChange={setEditTrimesterDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Modifica Trimestre</DialogTitle>
                    </DialogHeader>
                    {editingTrimester && (
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        updateTrimesterMutation.mutate({
                          id: editingTrimester.id,
                          yearId: editingTrimester.yearId,
                          title: formData.get("title") as string,
                          description: formData.get("description") as string,
                          sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
                        });
                      }} className="space-y-4">
                        <div>
                          <Label htmlFor="edit-trimester-title">Titolo *</Label>
                          <Input id="edit-trimester-title" name="title" defaultValue={editingTrimester.title} required />
                        </div>
                        <div>
                          <Label htmlFor="edit-trimester-description">Descrizione</Label>
                          <Textarea id="edit-trimester-description" name="description" defaultValue={editingTrimester.description || ""} />
                        </div>
                        <div>
                          <Label htmlFor="edit-trimester-sortOrder">Ordine</Label>
                          <Input id="edit-trimester-sortOrder" name="sortOrder" type="number" defaultValue={editingTrimester.sortOrder} />
                        </div>
                        <Button type="submit" className="w-full">Salva Modifiche</Button>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>

                <Dialog open={editModuleDialogOpen} onOpenChange={setEditModuleDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Modifica Modulo</DialogTitle>
                    </DialogHeader>
                    {editingModule && (
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        updateModuleMutation.mutate({
                          id: editingModule.id,
                          trimesterId: editingModule.trimesterId,
                          title: formData.get("title") as string,
                          description: formData.get("description") as string,
                          sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
                        });
                      }} className="space-y-4">
                        <div>
                          <Label htmlFor="edit-module-title">Titolo *</Label>
                          <Input id="edit-module-title" name="title" defaultValue={editingModule.title} required />
                        </div>
                        <div>
                          <Label htmlFor="edit-module-description">Descrizione</Label>
                          <Textarea id="edit-module-description" name="description" defaultValue={editingModule.description || ""} />
                        </div>
                        <div>
                          <Label htmlFor="edit-module-sortOrder">Ordine</Label>
                          <Input id="edit-module-sortOrder" name="sortOrder" type="number" defaultValue={editingModule.sortOrder} />
                        </div>
                        <Button type="submit" className="w-full">Salva Modifiche</Button>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>

                <Dialog open={editLessonDialogOpen} onOpenChange={(open) => {
                  setEditLessonDialogOpen(open);
                  if (!open) {
                    setEditingLesson(null);
                    setSelectedExerciseId("");
                  }
                }}>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-xl">
                        <FileText className="h-5 w-5 text-indigo-600" />
                        Modifica Lezione
                      </DialogTitle>
                      <DialogDescription>
                        Aggiorna i dettagli della lezione e gestisci l'esercizio collegato
                      </DialogDescription>
                    </DialogHeader>
                    {editingLesson && (
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        updateLessonMutation.mutate({
                          id: editingLesson.id,
                          moduleId: editingLesson.moduleId,
                          title: formData.get("title") as string,
                          description: formData.get("description") as string || null,
                          resourceUrl: formData.get("resourceUrl") as string || null,
                          exerciseId: selectedExerciseId && selectedExerciseId !== "none" ? selectedExerciseId : null,
                          libraryDocumentId: formData.get("libraryDocumentId") as string || null,
                          sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
                        });
                      }} className="space-y-6">
                        {/* Informazioni Base */}
                        <div className="space-y-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl border-2 border-blue-100 dark:border-blue-900">
                          <h3 className="font-semibold text-base flex items-center gap-2 text-blue-900 dark:text-blue-100">
                            <BookOpen className="h-4 w-4" />
                            Informazioni Base
                          </h3>

                          <div>
                            <Label htmlFor="edit-lesson-title">Titolo *</Label>
                            <Input 
                              id="edit-lesson-title" 
                              name="title" 
                              defaultValue={editingLesson.title} 
                              required 
                              className="mt-2"
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-lesson-description">Descrizione</Label>
                            <Textarea 
                              id="edit-lesson-description" 
                              name="description" 
                              defaultValue={editingLesson.description || ""} 
                              rows={3}
                              className="mt-2"
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-lesson-sortOrder">Ordine</Label>
                            <Input 
                              id="edit-lesson-sortOrder" 
                              name="sortOrder" 
                              type="number" 
                              defaultValue={editingLesson.sortOrder} 
                              className="mt-2"
                            />
                          </div>
                        </div>

                        {/* Risorse e Esercizi */}
                        <div className="space-y-4 p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl border-2 border-purple-100 dark:border-purple-900">
                          <h3 className="font-semibold text-base flex items-center gap-2 text-purple-900 dark:text-purple-100">
                            <Target className="h-4 w-4" />
                            Risorse e Materiali
                          </h3>

                          <div>
                            <Label htmlFor="edit-lesson-resourceUrl">Link Risorsa Esterna</Label>
                            <Input 
                              id="edit-lesson-resourceUrl" 
                              name="resourceUrl" 
                              type="url" 
                              defaultValue={editingLesson.resourceUrl || ""} 
                              placeholder="https://..."
                              className="mt-2"
                            />
                          </div>

                          <EditLessonExerciseSelector
                            selectedClientId={selectedClientId}
                            allConsultantExercises={allConsultantExercises}
                            selectedExerciseId={selectedExerciseId}
                            setSelectedExerciseId={setSelectedExerciseId}
                          />
                        </div>

                        {/* Lezione Corso Collegata */}
                        <div className="space-y-4 p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-xl border-2 border-amber-100 dark:border-amber-900">
                          <h3 className="font-semibold text-base flex items-center gap-2 text-amber-900 dark:text-amber-100">
                            <BookOpen className="h-4 w-4" />
                            Lezione del Corso
                          </h3>
                          
                          <LibraryDocumentTableSelector
                            selectedDocumentId={editingLesson?.libraryDocumentId || ""}
                            onDocumentSelect={(documentId) => {
                              // Aggiorna il valore nel form
                              const input = document.querySelector('input[name="libraryDocumentId"]') as HTMLInputElement;
                              if (input) input.value = documentId;
                            }}
                          />
                          <input
                            type="hidden"
                            name="libraryDocumentId"
                            defaultValue={editingLesson?.libraryDocumentId || ""}
                          />
                        </div>

                        <div className="flex gap-3 pt-2">
                          <Button 
                            type="button"
                            variant="outline" 
                            onClick={() => setEditLessonDialogOpen(false)}
                            className="flex-1"
                          >
                            Annulla
                          </Button>
                          <Button 
                            type="submit" 
                            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                          >
                            Salva Modifiche
                          </Button>
                        </div>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>

                <Dialog open={certificateDialogOpen} onOpenChange={setCertificateDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-purple-600" />
                        Emetti Attestato
                      </DialogTitle>
                      <DialogDescription>
                        {certificateContext && `Stai per emettere un attestato per: ${certificateContext.title}`}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                          Verifica Completamento
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Il sistema verificherà automaticamente che tutte le lezioni del {certificateContext?.type === 'year' ? 'anno' : 'trimestre'} siano completate e calcolerà la media dei voti.
                        </p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg">
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-amber-600" />
                          Generazione PDF
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Verrà generato un attestato professionale in formato PDF con tutti i dati del percorso completato.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setCertificateDialogOpen(false)}
                          className="flex-1"
                        >
                          Annulla
                        </Button>
                        <Button 
                          onClick={handleIssueCertificate}
                          disabled={createCertificateMutation.isPending}
                          className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-600"
                        >
                          {createCertificateMutation.isPending ? (
                            <>Generazione PDF...</>
                          ) : (
                            <>
                              <Award className="h-4 w-4 mr-2" />
                              Emetti Attestato
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      <AIPathwayWizard 
        open={aiWizardOpen} 
        onOpenChange={setAiWizardOpen}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/university"] });
          toast({
            title: "Percorso creato con successo!",
            description: "Il nuovo percorso universitario è stato creato.",
          });
        }}
      />
      <ConsultantAIAssistant />
    </div>
  </div>
);
}

// Year Card Component - Layout Timeline Laterale
function YearCard({ 
  year, 
  selectedClientId,
  isExpanded, 
  onToggle, 
  useTrimesters,
  useYearAssignments,
  clients,
  expandedTrimesters,
  toggleTrimester,
  useModules,
  expandedModules,
  toggleModule,
  useLessons,
  allConsultantExercises,
  existingGrades = [],
  existingCertificates = [],
  onAddTrimester,
  onAddModule,
  onAddLesson,
  onAssignGrade,
  onIssueCertificate,
  onForceComplete,
  onAddClientToYear,
  onRemoveClientFromYear,
  onEditYear,
  onDeleteYear,
  onEditTrimester,
  onDeleteTrimester,
  onEditModule,
  onDeleteModule,
  onEditLesson,
  onDeleteLesson
}: any) {
  const { data: trimesters = [] } = useTrimesters(year.id);
  const { data: assignments = [] } = useYearAssignments(year.id);

  // Calcola statistiche e progresso
  const yearGrade = existingGrades.find(g => g.referenceType === "year" && g.referenceId === year.id);
  const yearCert = existingCertificates.find(c => c.certificateType === "year" && c.referenceId === year.id);
  
  // Calculate completion percentage based on certifications or grades
  let completionPercentage = 0;
  if (yearCert) {
      completionPercentage = 100;
  } else if (yearGrade) {
      completionPercentage = 75; // Assume 75% if grade exists but no cert
  } else if (trimesters && trimesters.length > 0) {
      // Estimate progress if there are trimesters but no grade/cert yet
      let completedLessonsCount = 0;
      let totalLessonsCount = 0;
      trimesters.forEach((tri: any) => {
          if (tri.modules) {
              tri.modules.forEach((mod: any) => {
                  if (mod.lessons) {
                      totalLessonsCount += mod.lessons.length;
                      mod.lessons.forEach((lesson: any) => {
                          // Check if lesson is completed via progress endpoint or has a grade
                          const lessonProgress = existingGrades.find(g => g.referenceType === 'lesson' && g.referenceId === lesson.id);
                          if (lessonProgress || lesson.isCompleted) { // Assuming lesson.isCompleted might be available from API
                              completedLessonsCount++;
                          }
                      });
                  }
              });
          }
      });
      if (totalLessonsCount > 0) {
          completionPercentage = Math.round((completedLessonsCount / totalLessonsCount) * 100);
      } else {
          completionPercentage = 25; // Base percentage if year exists but no content yet
      }
  } else {
      completionPercentage = 25; // Base percentage if year exists but no content yet
  }

  return (
    <Card className="border rounded-xl overflow-hidden bg-card hover:shadow-lg transition-all duration-300">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 text-white relative">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500"></div>
        
        <div className="flex items-center gap-4">
          <button onClick={onToggle} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-cyan-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-slate-400" />
            )}
          </button>
          
          <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl shadow-lg">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold truncate">{year.title}</h3>
              <Badge className={`text-xs ${
                completionPercentage === 100 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                completionPercentage >= 50 ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' :
                'bg-slate-500/20 text-slate-300 border-slate-500/30'
              }`}>
                {completionPercentage}%
              </Badge>
            </div>
            {year.description && (
              <p className="text-sm text-slate-400 truncate mt-0.5">{year.description}</p>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => onEditYear(year)} className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-white/10">
              <FileText className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Elimina "${year.title}"?`)) onDeleteYear(year.id); }} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-px bg-border">
        <div className="bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Trimestri</p>
          <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{trimesters.length}</p>
        </div>
        <div className="bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Moduli</p>
          <p className="text-lg font-bold text-teal-600 dark:text-teal-400">{trimesters.reduce((acc: number, tri: any) => acc + (tri.modules?.length || 0), 0)}</p>
        </div>
        <div className="bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Lezioni</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{trimesters.reduce((acc: number, tri: any) => acc + (tri.modules?.reduce((mAcc: number, mod: any) => mAcc + (mod.lessons?.length || 0), 0) || 0), 0)}</p>
        </div>
        <div className="bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Clienti</p>
          <p className="text-lg font-bold text-violet-600 dark:text-violet-400">{assignments.length}</p>
        </div>
      </div>
      
      {/* Actions Row */}
      <div className="flex items-center justify-between p-3 border-t bg-muted/30">
        <div className="flex items-center gap-2">
          {yearGrade ? (
            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
              <Star className="h-3 w-3 mr-1 fill-amber-500" />
              {yearGrade.grade.toFixed(1)}/10
            </Badge>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => onAssignGrade("year", year.id, year.title)} className="h-7 text-xs">
              <Star className="h-3 w-3 mr-1 text-amber-500" /> Voto
            </Button>
          )}
          
          {yearCert ? (
            <Badge variant="outline" className="bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300">
              <Award className="h-3 w-3 mr-1 fill-violet-500" />
              Attestato
            </Badge>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => onIssueCertificate("year", year.id, year.title)} className="h-7 text-xs">
              <Award className="h-3 w-3 mr-1 text-violet-500" /> Attestato
            </Button>
          )}
        </div>
        
        <Button size="sm" onClick={onAddTrimester} className="h-8 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white text-xs">
          <Plus className="h-3 w-3 mr-1" />
          Aggiungi Trimestre
        </Button>
      </div>

      {isExpanded && (
        <div className="border-t">
          {trimesters.length === 0 ? (
            <div className="text-center py-8 m-4 border border-dashed rounded-xl">
              <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">Nessun trimestre. Aggiungi il primo!</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {trimesters.map((trimester: UniversityTrimester) => (
                <TrimesterCard
                  key={trimester.id}
                  trimester={trimester}
                  selectedClientId={selectedClientId}
                  isExpanded={expandedTrimesters.includes(trimester.id)}
                  onToggle={() => toggleTrimester(trimester.id)}
                  useModules={useModules}
                  expandedModules={expandedModules}
                  toggleModule={toggleModule}
                  useLessons={useLessons}
                  allConsultantExercises={allConsultantExercises}
                  existingGrades={existingGrades}
                  existingCertificates={existingCertificates}
                  onAddModule={() => onAddModule(trimester.id)}
                  onAddLesson={onAddLesson}
                  onAssignGrade={onAssignGrade}
                  onIssueCertificate={onIssueCertificate}
                  onForceComplete={onForceComplete}
                  onEditTrimester={onEditTrimester}
                  onDeleteTrimester={onDeleteTrimester}
                  onEditModule={onEditModule}
                  onDeleteModule={onDeleteModule}
                  onEditLesson={onEditLesson}
                  onDeleteLesson={onDeleteLesson}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// Trimester Card Component modernizzato
function TrimesterCard({ 
  trimester, 
  selectedClientId,
  isExpanded, 
  onToggle, 
  useModules, 
  expandedModules, 
  toggleModule, 
  useLessons,
  allConsultantExercises,
  existingGrades = [],
  existingCertificates = [],
  onAddModule, 
  onAddLesson,
  onAssignGrade,
  onIssueCertificate,
  onForceComplete,
  onEditTrimester,
  onDeleteTrimester,
  onEditModule,
  onDeleteModule,
  onEditLesson,
  onDeleteLesson
}: any) {
  const { data: modules = [] } = useModules(trimester.id);

  const trimesterGrade = existingGrades.find((g: ExistingGrade) => g.referenceType === "trimester" && g.referenceId === trimester.id);
  const trimesterCert = existingCertificates.find((c: ExistingCertificate) => c.certificateType === "trimester" && c.referenceId === trimester.id);

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      {/* Trimester Header */}
      <div className="flex items-center justify-between p-3 bg-muted/30">
        <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={onToggle}>
          {isExpanded ? <ChevronDown className="h-4 w-4 text-cyan-600" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <div className="p-2 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">{trimester.title}</h4>
            {trimester.description && (
              <p className="text-xs text-muted-foreground truncate">{trimester.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {trimesterGrade ? (
            <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
              <Star className="h-3 w-3 mr-1 fill-amber-500" />
              {trimesterGrade.grade}/10
            </Badge>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => onAssignGrade("trimester", trimester.id, trimester.title)} className="h-7 text-xs">
              <Star className="h-3 w-3 mr-1 text-amber-500" /> Voto
            </Button>
          )}
          
          {trimesterCert ? (
            <Badge variant="outline" className="bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 text-xs">
              <Award className="h-3 w-3 mr-1 fill-violet-500" />
              Emesso
            </Badge>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => onIssueCertificate("trimester", trimester.id, trimester.title)} className="h-7 text-xs">
              <Award className="h-3 w-3 mr-1 text-violet-500" /> Attestato
            </Button>
          )}
          
          <Button size="sm" variant="ghost" onClick={onAddModule} className="h-7 text-xs text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/20">
            <Plus className="h-3 w-3 mr-1" /> Modulo
          </Button>
          
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onEditTrimester(trimester); }} className="h-7 w-7 p-0">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Elimina "${trimester.title}"?`)) onDeleteTrimester(trimester.id); }} className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-3 pt-0 space-y-2">
          {modules.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nessun modulo</p>
          ) : (
            modules.map((module: UniversityModule) => (
              <ModuleCard
                key={module.id}
                module={module}
                selectedClientId={selectedClientId}
                isExpanded={expandedModules.includes(module.id)}
                onToggle={() => toggleModule(module.id)}
                useLessons={useLessons}
                allConsultantExercises={allConsultantExercises}
                existingGrades={existingGrades}
                onAddLesson={() => onAddLesson(module.id)}
                onAssignGrade={onAssignGrade}
                onForceComplete={onForceComplete}
                onEditModule={onEditModule}
                onDeleteModule={onDeleteModule}
                onEditLesson={onEditLesson}
                onDeleteLesson={onDeleteLesson}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// All Paths Year Card - mostra solo le informazioni essenziali
function AllPathsYearCard({ 
  year,
  useYearAssignments,
  clients,
  onEditYear,
  onDeleteYear
}: {
  year: UniversityYear;
  useYearAssignments: (yearId: string) => any;
  clients: Client[];
  onEditYear: (year: UniversityYear) => void;
  onDeleteYear: (yearId: string) => void;
}) {
  const { data: assignments = [] } = useYearAssignments(year.id);

  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-card to-muted/5 overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-purple-600"></div>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2.5 bg-gradient-to-br from-primary/10 to-purple-600/10 rounded-xl">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">{year.title}</CardTitle>
              {year.description && (
                <p className="text-sm text-muted-foreground mt-1">{year.description}</p>
              )}
            </div>
            <div className="flex gap-1 mr-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEditYear(year)}
                className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all group"
                title="Modifica anno"
              >
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (window.confirm(`Sei sicuro di voler eliminare l'anno "${year.title}"?`)) {
                    onDeleteYear(year.id);
                  }
                }}
                className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all group"
                title="Elimina anno"
              >
                <X className="h-4 w-4 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-xl p-4 border-2 border-blue-100 dark:border-blue-900">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold text-sm">Clienti Assegnati</h4>
              <Badge variant="secondary" className="ml-2">
                {assignments.length}
              </Badge>
            </div>
          </div>

          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nessun cliente assegnato a questo anno</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {assignments.map((assignment: YearAssignment) => {
                const client = assignment.client;
                if (!client) return null;

                return (
                  <div
                    key={assignment.clientId}
                    className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                      {client.firstName?.[0] || ''}{client.lastName?.[0] || ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {client.firstName} {client.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Client Paths Inline - versione compatta per la dashboard espandibile
function ClientPathsInline({
  client,
  useClientYears,
  useTrimesters,
  onEditYear,
  onDeleteYear,
  onToggleLock
}: {
  client: Client;
  useClientYears: (clientId: string) => any;
  useTrimesters: (yearId: string) => any;
  onEditYear: (year: UniversityYear) => void;
  onDeleteYear: (yearId: string) => void;
  onToggleLock: (yearId: string, isLocked: boolean) => void;
}) {
  const [expandedYears, setExpandedYears] = useState<string[]>([]);
  const { data: years = [], isLoading } = useClientYears(client.id);

  const toggleYear = (yearId: string) => {
    setExpandedYears(prev =>
      prev.includes(yearId) ? prev.filter(id => id !== yearId) : [...prev, yearId]
    );
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Caricamento percorsi...</div>;
  }

  if (years.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground italic">Nessun percorso assegnato</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <FolderKanban className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium">
          {years.length} {years.length === 1 ? 'percorso' : 'percorsi'} assegnati
        </span>
      </div>
      {years.map((year: UniversityYear) => {
        const isExpanded = expandedYears.includes(year.id);
        return (
          <YearItemCard
            key={year.id}
            year={year}
            isExpanded={isExpanded}
            onToggle={() => toggleYear(year.id)}
            useTrimesters={useTrimesters}
            onEditYear={onEditYear}
            onDeleteYear={onDeleteYear}
            onToggleLock={onToggleLock}
          />
        );
      })}
    </div>
  );
}

// Client Paths Card - mostra cliente con i suoi anni assegnati
function ClientPathsCard({
  client,
  useClientYears,
  useTrimesters,
  onEditYear,
  onDeleteYear,
  onToggleLock
}: {
  client: Client;
  useClientYears: (clientId: string) => any;
  useTrimesters: (yearId: string) => any;
  onEditYear: (year: UniversityYear) => void;
  onDeleteYear: (yearId: string) => void;
  onToggleLock: (yearId: string, isLocked: boolean) => void;
}) {
  const [expandedYears, setExpandedYears] = useState<string[]>([]);
  const { data: years = [], isLoading } = useClientYears(client.id);

  const toggleYear = (yearId: string) => {
    setExpandedYears(prev =>
      prev.includes(yearId) ? prev.filter(id => id !== yearId) : [...prev, yearId]
    );
  };

  if (isLoading) {
    return null;
  }

  if (years.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-card to-muted/5 overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-purple-600"></div>
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="relative">
            {client.avatar ? (
              <img
                src={client.avatar}
                alt={`${client.firstName} ${client.lastName}`}
                className="h-16 w-16 rounded-full object-cover ring-4 ring-blue-100 dark:ring-blue-900"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold ring-4 ring-blue-100 dark:ring-blue-900">
                {client.firstName?.[0] || ''}{client.lastName?.[0] || ''}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl flex items-center gap-2">
              {client.firstName} {client.lastName}
              <Badge className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 border-0">
                <FolderKanban className="h-3 w-3 mr-1" />
                {years.length} {years.length === 1 ? 'percorso' : 'percorsi'}
              </Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{client.email}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {years.map((year: UniversityYear) => {
            const isExpanded = expandedYears.includes(year.id);
            return (
              <YearItemCard
                key={year.id}
                year={year}
                isExpanded={isExpanded}
                onToggle={() => toggleYear(year.id)}
                useTrimesters={useTrimesters}
                onEditYear={onEditYear}
                onDeleteYear={onDeleteYear}
                onToggleLock={onToggleLock}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Year Item Card - visualizza un anno all'interno della card cliente
function YearItemCard({
  year,
  isExpanded,
  onToggle,
  useTrimesters,
  onEditYear,
  onDeleteYear,
  onToggleLock
}: {
  year: UniversityYear;
  isExpanded: boolean;
  onToggle: () => void;
  useTrimesters: (yearId: string) => any;
  onEditYear: (year: UniversityYear) => void;
  onDeleteYear: (yearId: string) => void;
  onToggleLock: (yearId: string, isLocked: boolean) => void;
}) {
  const { data: trimesters = [] } = useTrimesters(year.id);

  const totalModules = trimesters.reduce((acc: number, tri: any) => {
    return acc + (tri.modules?.length || 0);
  }, 0);

  const totalLessons = trimesters.reduce((acc: number, tri: any) => {
    const moduleLessons = tri.modules?.reduce((mAcc: number, mod: any) => {
      return mAcc + (mod.lessons?.length || 0);
    }, 0) || 0;
    return acc + moduleLessons;
  }, 0);

  return (
    <div className="border-2 border-blue-100 dark:border-blue-900 rounded-xl bg-gradient-to-br from-blue-50/30 to-purple-50/30 dark:from-blue-950/10 dark:to-purple-950/10 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="mt-1 cursor-pointer" onClick={onToggle}>
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-blue-600" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 cursor-pointer" onClick={onToggle}>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Calendar className="h-4 w-4 text-blue-600" />
                <h4 className="font-semibold text-base">{year.title}</h4>
                {year.isLocked ? (
                  <Badge className="bg-gradient-to-r from-slate-400 to-slate-500 text-white border-0 shadow-sm">
                    <Lock className="h-3 w-3 mr-1" />
                    Bloccato
                  </Badge>
                ) : (
                  <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-sm">
                    <Unlock className="h-3 w-3 mr-1" />
                    Sbloccato
                  </Badge>
                )}
              </div>
              {year.description && (
                <p className="text-sm text-muted-foreground mb-2">{year.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <span className="text-muted-foreground">{trimesters.length} trimestri</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                  <span className="text-muted-foreground">{totalModules} moduli</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-muted-foreground">{totalLessons} lezioni</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-1 ml-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(year.id, !year.isLocked);
              }}
              className={`h-8 w-8 p-0 transition-all group ${
                year.isLocked 
                  ? 'hover:bg-green-100 dark:hover:bg-green-900/30' 
                  : 'hover:bg-amber-100 dark:hover:bg-amber-900/30'
              }`}
              title={year.isLocked ? "Sblocca anno per i clienti" : "Blocca anno ai clienti"}
            >
              {year.isLocked ? (
                <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
              ) : (
                <Unlock className="h-4 w-4 text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEditYear(year)}
              className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all group"
              title="Modifica anno"
            >
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (window.confirm(`Sei sicuro di voler eliminare l'anno "${year.title}"?`)) {
                  onDeleteYear(year.id);
                }
              }}
              className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all group"
              title="Elimina anno"
            >
              <X className="h-4 w-4 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform" />
            </Button>
          </div>
        </div>
      </div>

      {isExpanded && trimesters.length > 0 && (
        <div className="px-4 pb-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
            <h5 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Trimestri</h5>
            <div className="space-y-2">
              {trimesters.map((trimester: any) => (
                <div key={trimester.id} className="text-sm p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded">
                  <div className="font-medium">{trimester.title}</div>
                  {trimester.description && (
                    <div className="text-xs text-muted-foreground mt-1">{trimester.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Lesson Row Component - extracted to avoid hooks in map
function LessonRow({
  lesson,
  linkedAssignment,
  hasExercise,
  selectedClientId,
  onForceComplete,
  onEditLesson,
  onDeleteLesson
}: {
  lesson: UniversityLesson;
  linkedAssignment: any;
  hasExercise: boolean;
  selectedClientId: string;
  onForceComplete: (lessonId: string) => void;
  onEditLesson: (lesson: UniversityLesson) => void;
  onDeleteLesson: (lessonId: string) => void;
}) {
  const { data: lessonProgress, isLoading: progressLoading } = useQuery<any | null>({
    queryKey: ["/api/university/progress", selectedClientId, lesson.id],
    queryFn: async () => {
      if (!selectedClientId) return null;
      try {
        const response = await fetch(`/api/university/progress/${selectedClientId}/${lesson.id}`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) {
          // If 404, lesson progress not found - not completed
          if (response.status === 404) {
            return null;
          }
          throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching lesson progress:", error);
        return null;
      }
    },
    enabled: !!selectedClientId && !!lesson.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry on 404
  });

  // Check if lesson is already completed in university_progress
  const isLessonCompleted = lessonProgress?.isCompleted === true;



  // Track if we've already triggered auto-complete for this lesson
  const hasAutoCompleted = React.useRef(false);
  // Auto-complete lesson when exercise is completed but lesson is not
  React.useEffect(() => {
    // Only auto-complete if:
    // 1. There's a linked exercise
    // 2. The exercise is completed
    // 3. The lesson is NOT already completed
    // 4. Progress data has loaded (not loading)
    // 5. Client is selected
    // 6. We haven't already auto-completed this lesson
    if (
      lesson.exerciseId && 
      linkedAssignment && 
      linkedAssignment.status === 'completed' &&
      !isLessonCompleted &&
      !progressLoading &&
      selectedClientId &&
      !hasAutoCompleted.current
    ) {
      console.log(`Auto-completing lesson "${lesson.title}" because exercise is completed`);
      hasAutoCompleted.current = true;
      onForceComplete(lesson.id);
    }

    // Reset the flag if lesson becomes incomplete again
    if (isLessonCompleted) {
      hasAutoCompleted.current = false;
    }
  }, [lesson.exerciseId, lesson.id, lesson.title, linkedAssignment?.status, isLessonCompleted, progressLoading, selectedClientId]);
  // Show force complete button only if:
  // 1. Client is selected
  // 2. Progress is loaded (not loading)
  // 3. Lesson is not already completed
  // 4. If lesson has linked exercise, the exercise must be completed
  // Note: This button will rarely show now because auto-complete triggers first

  // Show force complete button only if:
  // 1. Client is selected
  // 2. Progress is loaded (not loading)
  // 3. Lesson is not already completed
  // 4. If lesson has linked exercise, the exercise must be completed
  const showForceComplete = selectedClientId && 
    !progressLoading &&
    !isLessonCompleted && 
    (!lesson.exerciseId || (linkedAssignment && linkedAssignment.status === 'completed'));

  return (
    <div className="flex items-center gap-2 p-2 rounded-md hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors group">
      <div className="h-2 w-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 group-hover:scale-110 transition-transform"></div>
      <div className="flex-1">
        <p className="text-sm font-medium">{lesson.title}</p>
        {lesson.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{lesson.description}</p>
        )}
        {hasExercise && linkedAssignment && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            <FileText className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground">Esercizio:</span>
            <span className="font-medium text-primary">{linkedAssignment.exercise.title}</span>
            {linkedAssignment.status === 'completed' && (
              <Badge className="bg-green-500 text-white text-xs ml-2">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completato
              </Badge>
            )}
          </div>
        )}
      </div>
      {showForceComplete && (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onForceComplete(lesson.id);
          }}
          className="h-7 px-2 text-xs hover:bg-green-50"
          title="Forza completamento"
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Forza Completamento
        </Button>
      )}
      {lesson.libraryDocumentId && (
        <a 
          href={`/consultant/library?documentId=${lesson.libraryDocumentId}`} 
          target="_blank" 
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()} // Prevent triggering parent toggle
          className="text-xs text-primary hover:underline flex items-center gap-1 px-2 py-1 rounded-md hover:bg-primary/10 transition-colors"
        >
          <BookOpen className="h-3 w-3" />
          Vai alla Lezione
        </a>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onEditLesson(lesson)}
        className="h-7 w-7 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30 opacity-0 group-hover:opacity-100 transition-all hover-group"
        title="Modifica lezione"
      >
        <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 hover-group:scale-110 transition-transform" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          if (window.confirm(`Sei sicuro di voler eliminare la lezione "${lesson.title}"?`)) {
            onDeleteLesson(lesson.id);
          }
        }}
        className="h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all hover-group"
        title="Elimina lezione"
      >
        <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400 hover-group:scale-110 transition-transform" />
      </Button>
    </div>
  );
}

// Module Card Component modernizzato
function ModuleCard({ 
  module, 
  selectedClientId,
  isExpanded, 
  onToggle, 
  useLessons,
  allConsultantExercises,
  existingGrades = [],
  onAddLesson,
  onAssignGrade,
  onForceComplete,
  onEditModule,
  onDeleteModule,
  onEditLesson,
  onDeleteLesson
}: any) {
  const { data: lessons = [] } = useLessons(module.id);
  const moduleGrade = existingGrades.find((g: ExistingGrade) => g.referenceType === "module" && g.referenceId === module.id);

  // Fetch exercise assignments for the selected client
  const { data: clientAssignments = [], isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ["/api/exercise-assignments/consultant", selectedClientId],
    queryFn: async () => {
      const response = await fetch(`/api/exercise-assignments/consultant`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        return [];
      }
      const allAssignments = await response.json();
      return allAssignments.filter((a: any) => a.clientId === selectedClientId);
    },
    enabled: !!selectedClientId,
  });

  return (
    <div className="border-0 rounded-lg p-3 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 hover:shadow-sm transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={onToggle}>
          {isExpanded ? <ChevronDown className="h-3 w-3 text-indigo-600" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <div className="p-1.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-md shadow-sm">
            <FileText className="h-3 w-3 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{module.title}</p>
            {module.description && (
              <p className="text-xs text-muted-foreground">{module.description}</p>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEditModule(module)}
              className="h-7 w-7 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all group"
              title="Modifica modulo"
            >
              <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (window.confirm(`Sei sicuro di voler eliminare il modulo "${module.title}"?`)) {
                  onDeleteModule(module.id);
                }
              }}
              className="h-7 w-7 p-0 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all group"
              title="Elimina modulo"
            >
              <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          {moduleGrade ? (
            <div className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-md border border-amber-300 dark:border-amber-700 text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-600" />
              {moduleGrade.grade}/10
            </div>
          ) : (
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => onAssignGrade("module", module.id, module.title)}
              className="hover:bg-amber-100"
            >
              <Star className="h-3 w-3 mr-1 text-amber-600" />
              Voto
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onAddLesson} className="hover:bg-indigo-100">
            <Plus className="h-3 w-3 mr-1 text-indigo-600" />
            Lezione
          </Button>
        </div>
      </div>
      {isExpanded && (
        <div className="ml-5 mt-2 space-y-1">
          {lessons.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessuna lezione</p>
          ) : (
            lessons.map((lesson: UniversityLesson) => {
              const linkedAssignment = clientAssignments?.find((assignment: any) => assignment.exerciseId === lesson.exerciseId);
              const hasExercise = !!lesson.exerciseId;

              return (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  linkedAssignment={linkedAssignment}
                  hasExercise={hasExercise}
                  selectedClientId={selectedClientId}
                  onForceComplete={onForceComplete}
                  onEditLesson={onEditLesson}
                  onDeleteLesson={onDeleteLesson}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// Componente separato per il selettore esercizi nella dialog di modifica lezione
function EditLessonExerciseSelector({
  selectedClientId,
  allConsultantExercises,
  selectedExerciseId,
  setSelectedExerciseId
}: {
  selectedClientId: string;
  allConsultantExercises: Exercise[];
  selectedExerciseId: string;
  setSelectedExerciseId: (id: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Fetch clients to get client name
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients", "active"],
    queryFn: async () => {
      const response = await fetch("/api/clients?activeOnly=true", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  // Fetch exercise assignments for the selected client
  const { data: clientAssignments = [], isLoading: assignmentsLoading } = useQuery<any[]>({
    queryKey: ["/api/exercise-assignments/consultant", selectedClientId],
    queryFn: async () => {
      const response = await fetch(`/api/exercise-assignments/consultant`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        return [];
      }
      const allAssignments = await response.json();
      return allAssignments.filter((a: any) => a.clientId === selectedClientId);
    },
    enabled: !!selectedClientId,
  });

  const selectedClient = clients.find(c => c.id === selectedClientId);

  // Extract exercise IDs assigned to the client
  const assignedExerciseIds = new Set(clientAssignments.map((a: any) => a.exerciseId));

  // Filter consultant exercises to only show those assigned to this client
  const clientExercises = allConsultantExercises.filter(ex => assignedExerciseIds.has(ex.id));

  // Get unique categories
  const categories = Array.from(new Set(clientExercises.map(e => e.category))).sort();

  // Filter and sort exercises by creation date (most recent first)
  const filteredExercises = clientExercises
    .filter(exercise => {
      const matchesSearch = exercise.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "all" || exercise.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      // Sort by creation date descending (most recent first)
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

  const clientName = selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : 'questo cliente';

  if (!selectedClientId) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Esercizio Collegato
        </Label>
        <p className="text-sm text-muted-foreground mb-2">
          Seleziona un cliente per vedere gli esercizi assegnati
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Esercizio Collegato
        </Label>
        {clientExercises.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {clientExercises.length} disponibili
          </Badge>
        )}
      </div>

      {assignmentsLoading ? (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Caricamento esercizi di {clientName}...
          </p>
        </div>
      ) : clientExercises.length === 0 ? (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Nessun esercizio assegnato a <strong>{clientName}</strong>
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            Vai alla sezione "Esercizi" per assegnare esercizi al cliente.
          </p>
        </div>
      ) : (
        <>
          {/* Search and Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca esercizio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <Button
                  key={cat}
                  type="button"
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(selectedCategory === cat ? "all" : cat)}
                  className="text-xs whitespace-nowrap"
                >
                  {cat.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </Button>
              ))}
            </div>
          </div>

          {/* Selected Exercise Display */}
          {selectedExerciseId && selectedExerciseId !== "none" && (
            <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 truncate">
                    ✓ Selezionato: {clientExercises.find(e => e.id === selectedExerciseId)?.title}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedExerciseId("")}
                  className="h-6 w-6 p-0 flex-shrink-0 hover:bg-green-100 dark:hover:bg-green-900/30"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Scrollable Exercise List */}
          <div className="border rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
            <div className="max-h-[200px] sm:max-h-[300px] overflow-y-auto">
              {filteredExercises.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nessun esercizio trovato
                </div>
              ) : (
                <div className="divide-y">
                  {filteredExercises.map((exercise) => (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => setSelectedExerciseId(exercise.id)}
                      className={`w-full p-3 text-left hover:bg-accent/50 transition-colors ${
                        selectedExerciseId === exercise.id ? 'bg-accent' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5">
                          {selectedExerciseId === exercise.id ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-muted" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2">
                            {exercise.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {exercise.category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Mostrando {filteredExercises.length} di {clientExercises.length} esercizi assegnati a {clientName}
          </p>
        </>
      )}
      <ConsultantAIAssistant />
    </div>
  );
}