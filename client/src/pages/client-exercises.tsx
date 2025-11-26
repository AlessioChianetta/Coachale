import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Clock, FileText, Calendar, CheckCircle, AlertCircle, User, BookOpen, Globe, PlayCircle, Loader2, Filter, X, GraduationCap, Award, Target, Search, ChevronRight, ChevronDown, ChevronUp, Grid3x3, Columns3, TrendingUp, Menu, HelpCircle, ArrowLeft } from "lucide-react";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { usePageContext } from "@/hooks/use-page-context";
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { driverConfig } from '@/lib/tour/driver-config';
import { exercisesTourSteps } from '@/components/interactive-tour/exercises-tour-steps';

interface ExerciseAssignment {
  id: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'completed' | 'returned'; // Aggiunto 'returned' per chiarezza
  assignedAt: string;
  dueDate?: string;
  completedAt?: string;
  submittedAt?: string;
  score?: number;
  exercise: {
    id: string;
    title: string;
    description: string;
    category: string;
    type: 'general' | 'personalized';
    estimatedDuration?: number;
    questions?: any[];
  };
  consultant: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    avatar?: string;
  };
  consultantFeedback?: string | Array<{ feedback: string; date: string }>; // Modificato per gestire feedback
}

// Course categories constant - centralized definition
const COURSE_CATEGORIES = ['newsletter', 'metodo-turbo', 'metodo-hybrid'];

export default function ClientExercises() {
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [layoutView, setLayoutView] = useState<"grid" | "kanban" | "timeline">("kanban");
  const [exerciseMode, setExerciseMode] = useState<"consulenza" | "corso">("consulenza");
  const [isTourActive, setIsTourActive] = useState(false);
  const [isModeSelectorCollapsed, setIsModeSelectorCollapsed] = useState(false);
  const { toast} = useToast();
  const queryClient = useQueryClient();

  // Reset categoria quando cambia modalità
  useEffect(() => {
    setSelectedCourse(null);
  }, [exerciseMode]);

  // Collassa il selettore modalità quando viene selezionata una categoria
  useEffect(() => {
    if (selectedCourse !== null) {
      setIsModeSelectorCollapsed(true);
    } else {
      setIsModeSelectorCollapsed(false);
    }
  }, [selectedCourse]);

  // Stato per gestire l'espansione del feedback nella timeline
  const [isFeedbackExpanded, setIsFeedbackExpanded] = useState<{ [key: string]: boolean }>({});

  // Limite di caratteri per il feedback troncato
  const FEEDBACK_LIMIT = 100; // Puoi aggiustare questo valore

  const { data: assignments = [], isLoading } = useQuery<ExerciseAssignment[]>({
    queryKey: ["/api/exercise-assignments/client", { isExam: false }],
    queryFn: async () => {
      const response = await fetch("/api/exercise-assignments/client?isExam=false", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch exercises");
      return response.json();
    },
  });

  const { data: publicExercises = [], isLoading: publicLoading } = useQuery({
    queryKey: ["/api/exercises/public"],
    queryFn: async () => {
      const response = await fetch("/api/exercises/public", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch public exercises");
      return response.json();
    },
  });

  const startPublicExerciseMutation = useMutation({
    mutationFn: async (exerciseId: string) => {
      const response = await fetch(`/api/exercises/public/${exerciseId}/start`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to start exercise");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-assignments/client"] });
      toast({
        title: "Esercizio avviato",
        description: data.message || "Esercizio pubblico avviato con successo",
      });
      if (data.assignment) {
        setLocation(`/exercise/${data.assignment.exerciseId}?assignment=${data.assignment.id}`);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'avvio dell'esercizio",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string, score?: number) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-600 text-white border-0 font-medium px-3 py-1 text-xs">
            <CheckCircle size={12} className="mr-1.5" />
            Completato {score !== undefined && `(${score}/100)`}
          </Badge>
        );
      case 'submitted':
        return (
          <Badge className="bg-purple-600 text-white border-0 font-medium px-3 py-1 text-xs">
            <Clock size={12} className="mr-1.5" />
            In Revisione
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="bg-blue-600 text-white border-0 font-medium px-3 py-1 text-xs">
            <AlertCircle size={12} className="mr-1.5" />
            In Corso
          </Badge>
        );
      case 'returned': // Gestione stato 'returned'
        return (
          <Badge className="bg-orange-600 text-white border-0 font-medium px-3 py-1 text-xs">
            <AlertCircle size={12} className="mr-1.5" />
            Restituito
          </Badge>
        );
      default: // 'pending'
        return (
          <Badge className="bg-orange-600 text-white border-0 font-medium px-3 py-1 text-xs">
            <Target size={12} className="mr-1.5" />
            Da Completare
          </Badge>
        );
    }
  };

  const handleViewExercise = (assignment: ExerciseAssignment) => {
    setLocation(`/exercise/${assignment.exercise.id}?assignment=${assignment.id}`);
  };

  const handleStartPublicExercise = (exerciseId: string) => {
    startPublicExerciseMutation.mutate(exerciseId);
  };

  const startExercisesTour = () => {
    setIsTourActive(true);
    const driverObj = driver({
      ...driverConfig,
      onDestroyed: () => {
        setIsTourActive(false);
      },
    });
    driverObj.setSteps(exercisesTourSteps);
    driverObj.drive();
  };

  const isExerciseStarted = (exerciseId: string) => {
    return assignments.some((assignment: ExerciseAssignment) => assignment.exercise.id === exerciseId);
  };

  const getPublicExerciseAssignment = (exerciseId: string) => {
    return assignments.find((assignment: ExerciseAssignment) => assignment.exercise.id === exerciseId);
  };

  const getCategoryStyle = (category: string) => {
    const styles = {
      'post-consulenza': 'bg-purple-500/10 text-purple-600 border-purple-200',
      'newsletter': 'bg-green-500/10 text-green-600 border-green-200',
      'metodo-turbo': 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
      'metodo-hybrid': 'bg-cyan-500/10 text-cyan-600 border-cyan-200',
      'finanza-personale': 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
      'vendita': 'bg-orange-500/10 text-orange-600 border-orange-200',
      'marketing': 'bg-pink-500/10 text-pink-600 border-pink-200',
      'imprenditoria': 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
      'risparmio-investimenti': 'bg-blue-500/10 text-blue-600 border-blue-200',
      'contabilità': 'bg-gray-500/10 text-gray-600 border-gray-200',
      'gestione-risorse': 'bg-teal-500/10 text-teal-600 border-teal-200',
      'strategia': 'bg-red-500/10 text-red-600 border-red-200',
      'general': 'bg-blue-500/10 text-blue-600 border-blue-200',
      'financial': 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    };
    return styles[category as keyof typeof styles] || 'bg-gray-500/10 text-gray-600 border-gray-200';
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      'post-consulenza': '📋',
      'newsletter': '📧',
      'metodo-turbo': '⚡',
      'metodo-hybrid': '🔄',
      'finanza-personale': '💰',
      'vendita': '💼',
      'marketing': '📈',
      'imprenditoria': '🚀',
      'risparmio-investimenti': '📊',
      'contabilità': '🧮',
      'gestione-risorse': '⚙️',
      'strategia': '🎯',
      'general': '📚',
      'financial': '💰',
    };
    return icons[category as keyof typeof icons] || '📚';
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      'post-consulenza': 'Post Consulenza',
      'newsletter': 'Metodo Orbitale - Finanza',
      'metodo-turbo': 'Metodo Turbo - Vendita',
      'metodo-hybrid': 'Metodo Hybrid - Azienda',
      'finanza-personale': 'Finanza Personale',
      'vendita': 'Vendita',
      'marketing': 'Marketing',
      'imprenditoria': 'Imprenditoria',
      'risparmio-investimenti': 'Risparmio e Investimenti',
      'contabilità': 'Contabilità',
      'gestione-risorse': 'Gestione Risorse',
      'strategia': 'Strategia',
      'general': 'Generale',
      'financial': 'Finanza',
    };
    return labels[category as keyof typeof labels] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  const allCategories = useMemo(() => {
    let assignedCategories = assignments.map((a: ExerciseAssignment) => a.exercise.category);

    // Filtra categorie in base alla modalità usando COURSE_CATEGORIES
    if (exerciseMode === "corso") {
      assignedCategories = assignedCategories.filter(cat => COURSE_CATEGORIES.includes(cat));
    } else {
      assignedCategories = assignedCategories.filter(cat => !COURSE_CATEGORIES.includes(cat));
    }

    const publicCategories = publicExercises.map((e: any) => e.category);
    const uniqueCategories = Array.from(new Set([...assignedCategories, ...publicCategories]));
    return uniqueCategories.sort();
  }, [assignments, publicExercises, exerciseMode]);

  const filteredAssignments = useMemo(() => {
    let filtered = assignments;

    // Filtra in base alla modalità (consulenza o corso) usando COURSE_CATEGORIES
    if (exerciseMode === "corso") {
      filtered = filtered.filter((assignment: ExerciseAssignment) => COURSE_CATEGORIES.includes(assignment.exercise.category));
    } else {
      filtered = filtered.filter((assignment: ExerciseAssignment) => !COURSE_CATEGORIES.includes(assignment.exercise.category));
    }

    // Filtra per categoria se selezionata
    if (selectedCourse) {
      filtered = filtered.filter((assignment: ExerciseAssignment) => assignment.exercise.category === selectedCourse);
    }

    return filtered;
  }, [assignments, selectedCourse, exerciseMode]);

  const filteredPublicExercises = useMemo(() => {
    if (!selectedCourse) return publicExercises;
    return publicExercises.filter((exercise: any) => exercise.category === selectedCourse);
  }, [publicExercises, selectedCourse]);

  // Funzioni per raggruppare gli esercizi per stato con ordinamento per data di assegnazione
  const getAssignmentsByStatus = (status: string) => {
    return filteredAssignments
      .filter((assignment: ExerciseAssignment) => assignment.status === status)
      .sort((a, b) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime()); // Più vecchi prima (da fare per primi)
  };

  // Gli esercizi "returned" vengono mostrati insieme ai "pending" come da completare
  const pendingAssignments = useMemo(() => {
    const pending = getAssignmentsByStatus('pending');
    const returned = getAssignmentsByStatus('returned');
    return [...returned, ...pending]; // Returned in cima perché prioritari
  }, [filteredAssignments]);

  const inProgressAssignments = useMemo(() => getAssignmentsByStatus('in_progress'), [filteredAssignments]);
  const submittedAssignments = useMemo(() => getAssignmentsByStatus('submitted'), [filteredAssignments]);
  const completedAssignments = useMemo(() => getAssignmentsByStatus('completed'), [filteredAssignments]);

  // Calcola modeFilteredAssignments usando COURSE_CATEGORIES
  const modeFilteredAssignments = useMemo(() => {
    return exerciseMode === "corso"
      ? assignments.filter((a: ExerciseAssignment) => COURSE_CATEGORIES.includes(a.exercise.category))
      : assignments.filter((a: ExerciseAssignment) => !COURSE_CATEGORIES.includes(a.exercise.category));
  }, [assignments, exerciseMode]);

  // Statistiche per gli stati - considera la modalità attiva e la categoria selezionata
  const statusStats = useMemo(() => {
    return {
      pending: filteredAssignments.filter((a: ExerciseAssignment) => a.status === 'pending' || a.status === 'returned').length,
      inProgress: filteredAssignments.filter((a: ExerciseAssignment) => a.status === 'in_progress').length,
      submitted: filteredAssignments.filter((a: ExerciseAssignment) => a.status === 'submitted').length,
      completed: filteredAssignments.filter((a: ExerciseAssignment) => a.status === 'completed').length,
      total: filteredAssignments.length
    };
  }, [filteredAssignments]);

  // Memoizza exercisesListData per evitare loop infiniti
  const exercisesListData = useMemo(() => {
    console.log('📊 ESERCIZI DEBUG:', {
      totaleDatabase: assignments?.length || 0,
      modalita: exerciseMode,
      dopoFiltroModalita: modeFilteredAssignments.length,
      dopoFiltroCompleto: filteredAssignments.length,
      newsletter: assignments?.filter((a: ExerciseAssignment) => a.exercise.category === "newsletter").length || 0,
      nonNewsletter: assignments?.filter((a: ExerciseAssignment) => a.exercise.category !== "newsletter").length || 0,
    });
    
    return {
      statistics: statusStats,
      filters: {
        searchQuery: searchTerm,
        selectedStatus,
        selectedCategory: exerciseMode,
      },
      exercisesOverview: filteredAssignments.slice(0, 10).map((a: ExerciseAssignment) => ({
        id: a.id,
        title: a.exercise.title,
        category: a.exercise.category,
        status: a.status,
        dueDate: a.dueDate,
      }))
    };
  }, [statusStats, searchTerm, selectedStatus, exerciseMode, filteredAssignments, assignments, modeFilteredAssignments]);

  // Page context for AI assistant
  const pageContext = usePageContext({ exercisesListData });

  // Funzione per filtrare gli esercizi basandosi su tutti i filtri attivi
  const getFilteredAssignments = () => {
    let filtered = filteredAssignments;

    // Filtro per stato - include 'returned' insieme a 'pending'
    if (selectedStatus !== "all") {
      const statusMap: { [key: string]: string[] } = {
        'pending': ['pending', 'returned'],
        'in_progress': ['in_progress'],
        'submitted': ['submitted'],
        'completed': ['completed']
      };
      
      const allowedStatuses = statusMap[selectedStatus] || [selectedStatus];
      filtered = filtered.filter((assignment: ExerciseAssignment) => 
        allowedStatuses.includes(assignment.status)
      );
    }

    // Filtro per ricerca testuale
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((assignment: ExerciseAssignment) =>
        assignment.exercise.title.toLowerCase().includes(searchLower) ||
        assignment.exercise.description.toLowerCase().includes(searchLower) ||
        getCategoryLabel(assignment.exercise.category).toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  };

  // Componente ExerciseCard simile al layout della libreria
  const ExerciseCard = ({ assignment, onViewExercise }: { assignment: ExerciseAssignment, onViewExercise: (assignment: ExerciseAssignment) => void }) => {
    const isCompleted = assignment.status === 'completed';

    return (
      <Card className="bg-white border-gray-200 hover:border-purple-400 hover:shadow-lg transition-all duration-200 cursor-pointer group overflow-hidden">
        <div className="relative h-40 overflow-hidden" onClick={() => onViewExercise(assignment)}>
          <div className="relative w-full h-full bg-gradient-to-br from-purple-600 to-blue-700 flex items-center justify-center">
            <div className="text-4xl">{getCategoryIcon(assignment.exercise.category)}</div>
            <div className="w-14 h-14 bg-black/50 rounded-full flex items-center justify-center group-hover:bg-black/70 transition-all absolute">
              <PlayCircle size={20} className="text-white" />
            </div>
          </div>

          {/* Duration Badge */}
          {assignment.exercise.estimatedDuration !== undefined && (
            <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {assignment.exercise.estimatedDuration}min
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-3 left-3">
            {getStatusBadge(assignment.status, assignment.score)}
          </div>

          {/* Completed Check */}
          {isCompleted && (
            <div className="absolute bottom-3 right-3 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle size={16} className="text-white" />
            </div>
          )}
        </div>

        <CardContent className="p-4" onClick={() => onViewExercise(assignment)}>
          {/* Category Path */}
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
            <span>{getCategoryLabel(assignment.exercise.category)}</span>
          </div>

          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors text-base">
            {assignment.exercise.title}
          </h3>

          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
            {assignment.exercise.description}
          </p>

          {/* Assigned Date */}
          {assignment.assignedAt && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
              <Calendar size={12} className="text-gray-400" />
              <span>Assegnato il {new Date(assignment.assignedAt).toLocaleDateString('it-IT')}</span>
            </div>
          )}

          {/* Status and Duration */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-purple-500'}`}></div>
              <span className={`text-xs font-medium ${isCompleted ? 'text-green-600' : 'text-purple-600'}`}>
                {isCompleted ? 'Completato' : assignment.status === 'submitted' ? 'In Revisione' : assignment.status === 'in_progress' ? 'In Corso' : 'Disponibile'}
              </span>
            </div>
            <div className="flex items-center text-xs text-gray-500">
              <Clock size={12} className="mr-1" />
              {assignment.exercise.estimatedDuration !== undefined ? assignment.exercise.estimatedDuration : 5}min
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Kanban Card Component con design pulito e professionale
  const KanbanCard = ({ assignment, onViewExercise, isFirstCard }: { assignment: ExerciseAssignment, onViewExercise: (assignment: ExerciseAssignment) => void, isFirstCard?: boolean }) => {
    const getCategoryColor = (category: string) => {
      const colors = {
        'imprenditoria': 'indigo',
        'post-consulenza': 'purple',
        'newsletter': 'green',
        'finanza-personale': 'emerald',
        'vendita': 'orange',
        'marketing': 'pink',
        'risparmio-investimenti': 'blue',
        'contabilità': 'gray',
        'gestione-risorse': 'teal',
        'strategia': 'red',
      };
      return colors[category as keyof typeof colors] || 'blue';
    };

    const color = getCategoryColor(assignment.exercise.category);
    const isReturned = assignment.status === 'returned';
    
    // Check if exercise is new (assigned in last 24 hours)
    const isNew = assignment.assignedAt && 
      (new Date().getTime() - new Date(assignment.assignedAt).getTime()) < 24 * 60 * 60 * 1000;

    // Get latest feedback for returned exercises
    const getLatestFeedback = () => {
      if (!isReturned || !assignment.consultantFeedback) return null;

      try {
        if (Array.isArray(assignment.consultantFeedback) && assignment.consultantFeedback.length > 0) {
          const sortedFeedback = [...assignment.consultantFeedback].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          return sortedFeedback[0].feedback;
        } else if (typeof assignment.consultantFeedback === 'string') {
          try {
            const parsed = JSON.parse(assignment.consultantFeedback);
            if (Array.isArray(parsed) && parsed.length > 0) {
               const sortedParsedFeedback = [...parsed].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              return sortedParsedFeedback[0].feedback;
            }
            return assignment.consultantFeedback;
          } catch {
            return assignment.consultantFeedback;
          }
        }
      } catch (e) {
        console.error('Error parsing feedback:', e);
      }
      return null;
    };

    const latestFeedback = getLatestFeedback();

    return (
      <Card
        className={`bg-white dark:bg-gray-800 border transition-all duration-200 group relative overflow-hidden ${
          isReturned 
            ? 'border-orange-400 dark:border-orange-700 shadow-md shadow-orange-100 dark:shadow-orange-900/30 hover:shadow-lg hover:shadow-orange-200 dark:hover:shadow-orange-900/50' 
            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md'
        }`}
        data-tour={isFirstCard ? "exercises-card-example" : undefined}
      >
        {/* New Badge - Positioned absolutely */}
        {isNew && !isReturned && (
          <div className="absolute top-2 right-2 z-10">
            <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[10px] px-2 py-0.5 font-bold shadow-md animate-pulse">
              ✨ NUOVO
            </Badge>
          </div>
        )}
        
        <CardContent className="p-5">
          {/* Icon e Titolo */}
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-14 h-14 rounded-xl ${isReturned ? 'bg-gradient-to-br from-orange-500 to-orange-600 ring-2 ring-orange-300' : `bg-gradient-to-br from-${color}-500 to-${color}-600`} flex items-center justify-center text-3xl flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
              {getCategoryIcon(assignment.exercise.category)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-base text-gray-900 dark:text-white line-clamp-2 mb-1 leading-tight group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                {assignment.exercise.title}
              </h4>
            </div>
          </div>

          {/* Returned Feedback Alert - MIGLIORATO */}
          {isReturned && latestFeedback && (
            <div className="mb-4 p-3 bg-gradient-to-r from-orange-50 dark:from-orange-900/30 to-orange-100 dark:to-orange-900/20 border-l-4 border-orange-500 dark:border-orange-600 rounded-lg shadow-sm">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={14} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-orange-900 dark:text-orange-200 mb-1.5 flex items-center gap-1">
                    <span>💬</span> Da correggere
                  </p>
                  <p className="text-sm text-orange-800 dark:text-orange-300 leading-relaxed line-clamp-3">
                    {latestFeedback}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Description - Solo se NON è returned */}
          {assignment.exercise.description && !isReturned && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 leading-relaxed">
              {assignment.exercise.description}
            </p>
          )}

          {/* Category Badge e Duration */}
          <div className="flex items-center justify-between mb-4">
            <Badge
              variant="outline"
              className={`text-sm font-medium px-2.5 py-1 ${isReturned ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200 border-orange-200 dark:border-orange-700' : `bg-${color}-50 dark:bg-${color}-900/30 text-${color}-700 dark:text-${color}-200 border-${color}-200 dark:border-${color}-700`}`}
            >
              {getCategoryLabel(assignment.exercise.category)}
            </Badge>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <Clock size={14} className="text-gray-400 dark:text-gray-500" />
              <span className="font-semibold">{assignment.exercise.estimatedDuration !== undefined ? assignment.exercise.estimatedDuration : 5} min</span>
            </div>
          </div>

          {/* Assigned Date */}
          {assignment.assignedAt && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
              <Calendar size={14} className="text-gray-400 dark:text-gray-500" />
              <span>Assegnato il {new Date(assignment.assignedAt).toLocaleDateString('it-IT')}</span>
            </div>
          )}

          {/* CTA Button - NUOVO */}
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onViewExercise(assignment);
            }}
            className={`w-full ${
              isReturned 
                ? 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800' 
                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
            } text-white shadow-md hover:shadow-lg transition-all duration-200 group/btn`}
            size="default"
          >
            <PlayCircle size={16} className="mr-2 group-hover/btn:scale-110 transition-transform" />
            {isReturned ? 'Correggi ora' : 'Inizia esercizio'}
          </Button>
        </CardContent>
      </Card>
    );
  };

  // Timeline Card Component
  const TimelineCard = ({ assignment, onViewExercise }: { assignment: ExerciseAssignment, onViewExercise: (assignment: ExerciseAssignment) => void }) => {
    const isCompleted = assignment.status === 'completed';
    const isReturned = assignment.status === 'returned';

    const getStatusColor = () => {
      switch (assignment.status) {
        case 'completed': return 'bg-green-500';
        case 'submitted': return 'bg-purple-500';
        case 'in_progress': return 'bg-blue-500';
        case 'returned': return 'bg-orange-500';
        default: return 'bg-orange-500'; // 'pending'
      }
    };

    // Get latest feedback for returned exercises
    const getLatestFeedback = () => {
      if (!isReturned || !assignment.consultantFeedback) return null;

      try {
        if (Array.isArray(assignment.consultantFeedback) && assignment.consultantFeedback.length > 0) {
          // Cerca il feedback più recente basato sulla data se disponibile, altrimenti prendi il primo
          const sortedFeedback = [...assignment.consultantFeedback].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          return sortedFeedback[0].feedback;
        } else if (typeof assignment.consultantFeedback === 'string') {
          try {
            const parsed = JSON.parse(assignment.consultantFeedback);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const sortedParsedFeedback = [...parsed].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              return sortedParsedFeedback[0].feedback;
            }
            return assignment.consultantFeedback;
          } catch {
            return assignment.consultantFeedback;
          }
        }
      } catch (e) {
        console.error('Error parsing feedback:', e);
      }
      return null;
    };

    const latestFeedback = getLatestFeedback();
    const isFeedbackLong = latestFeedback ? latestFeedback.length > FEEDBACK_LIMIT : false;
    const feedbackExpanded = isFeedbackExpanded[assignment.id] || false;

    // Funzione per gestire l'espansione del feedback
    const toggleFeedbackExpansion = () => {
      setIsFeedbackExpanded(prev => ({ ...prev, [assignment.id]: !prev[assignment.id] }));
    };

    return (
      <div className="relative pb-8">
        {/* Timeline line */}
        <div className="absolute left-8 top-8 bottom-0 w-0.5 bg-gray-200"></div>

        {/* Timeline dot */}
        <div className={`absolute left-6 top-6 w-5 h-5 rounded-full ${getStatusColor()} border-4 border-white shadow-md ${isReturned ? 'animate-pulse' : ''}`}></div>

        {/* Content */}
        <Card
          className={`ml-16 bg-white dark:bg-gray-800 hover:shadow-lg transition-all duration-200 cursor-pointer ${
            isReturned ? 'border-orange-300 dark:border-orange-700 bg-orange-50/20 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-600'
          }`}
          onClick={() => onViewExercise(assignment)}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="text-3xl">{getCategoryIcon(assignment.exercise.category)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusBadge(assignment.status, assignment.score)}
                  <span className="text-xs text-gray-500 dark:text-gray-400">{getCategoryLabel(assignment.exercise.category)}</span>
                </div>

                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {assignment.exercise.title}
                </h4>

                {/* Returned Feedback Alert - Modificato per troncamento */}
                {isReturned && latestFeedback && (
                  <div className="mb-3 p-3 bg-orange-100 dark:bg-orange-900/30 border-l-4 border-orange-500 dark:border-orange-600 rounded">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-orange-800 dark:text-orange-200 mb-1">💬 Feedback del Consulente:</p>
                        <div className="text-sm text-orange-700 dark:text-orange-300 leading-relaxed">
                          <p className="whitespace-pre-wrap">
                            {feedbackExpanded || !isFeedbackLong
                              ? latestFeedback
                              : `${latestFeedback.substring(0, FEEDBACK_LIMIT)}...`}
                          </p>
                          {isFeedbackLong && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Previene l'attivazione di onViewExercise
                                toggleFeedbackExpansion();
                              }}
                              className="mt-2 text-xs font-semibold text-orange-800 dark:text-orange-200 hover:text-orange-900 dark:hover:text-orange-100 underline focus:outline-none"
                            >
                              {feedbackExpanded ? '← Mostra meno' : 'Leggi tutto →'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!isReturned && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                    {assignment.exercise.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{assignment.exercise.estimatedDuration !== undefined ? assignment.exercise.estimatedDuration : 5} min</span>
                  </div>
                  {assignment.assignedAt && (
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      <span>Assegnato il {new Date(assignment.assignedAt).toLocaleDateString('it-IT')}</span>
                    </div>
                  )}
                  {assignment.completedAt && (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircle size={12} />
                      <span>Completato il {new Date(assignment.completedAt).toLocaleDateString('it-IT')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768; // Simple check for mobile view

  if (isLoading || publicLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
        <div className="flex h-screen">
          <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 overflow-y-auto">
            {/* Integrated Header with Menu Button */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
              <div className="px-4 md:px-8 py-3 flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(true)}
                  className="h-11 w-11 min-h-[44px] min-w-[44px] md:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
                    I Tuoi Esercizi
                  </h1>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 overflow-y-auto">
          {/* Integrated Header with Menu Button */}
          <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
            <div className="px-4 md:px-8 py-3 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="h-11 w-11 min-h-[44px] min-w-[44px] md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2 flex-1">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
                  I Tuoi Esercizi
                </h1>
              </div>
              {!isTourActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startExercisesTour}
                  className="gap-2 border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  <HelpCircle size={16} />
                  <span className="hidden sm:inline">Guida Interattiva</span>
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 max-w-7xl mx-auto space-y-6 p-6">
            {/* STEP 1: Exercise Mode Selector - Enhanced Card Layout */}
            <div 
              className={`relative overflow-hidden bg-gradient-to-br from-white via-purple-50/30 to-blue-50/30 dark:from-gray-800 dark:via-purple-900/20 dark:to-blue-900/20 rounded-2xl shadow-xl border-2 border-purple-100 dark:border-purple-800 transition-all duration-300 ${
                isModeSelectorCollapsed ? 'cursor-pointer hover:shadow-2xl' : ''
              }`}
              onClick={isModeSelectorCollapsed ? () => setIsModeSelectorCollapsed(false) : undefined}
            >
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-400/10 to-transparent rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-blue-400/10 to-transparent rounded-full blur-3xl"></div>
              
              {isModeSelectorCollapsed ? (
                /* Collapsed View - Compact Header */
                <div className="relative z-10 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg ${
                      exerciseMode === "consulenza" 
                        ? "bg-gradient-to-br from-purple-500 to-purple-600" 
                        : "bg-gradient-to-br from-green-500 to-green-600"
                    }`}>
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-gray-900 dark:text-white">
                        Esercizi {exerciseMode === "corso" ? "Corso" : "Consulenza"}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {exerciseMode === "corso" ? "Newsletter e materiali del percorso formativo" : "Esercizi personalizzati dal consulente"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={exerciseMode === "consulenza" ? "bg-purple-600 text-white" : "bg-green-600 text-white"}>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        Attiva
                      </div>
                    </Badge>
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              ) : (
                /* Expanded View - Full Cards */
                <div className="relative z-10 p-8">
                  {/* Minimize Button */}
                  <button
                    onClick={() => setIsModeSelectorCollapsed(true)}
                    className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-white/80 hover:bg-white dark:bg-gray-800/80 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200 group"
                    title="Minimizza"
                  >
                    <ChevronUp className="h-5 w-5 text-gray-400 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400" />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                  {/* Consulenza Card - Enhanced */}
                  <button
                    onClick={() => setExerciseMode("consulenza")}
                    className={`group relative p-8 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${
                      exerciseMode === "consulenza"
                        ? "border-purple-500 bg-gradient-to-br from-purple-500/10 via-purple-400/5 to-transparent dark:from-purple-800/30 dark:via-purple-800/20 dark:to-transparent shadow-xl scale-[1.03] ring-4 ring-purple-500/20 dark:ring-purple-700/30"
                        : "border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-lg hover:scale-[1.02]"
                    }`}
                    data-tour="exercises-mode-consulenza"
                  >
                    {/* Animated background gradient */}
                    {exerciseMode === "consulenza" && (
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-purple-400/5 animate-pulse"></div>
                    )}
                    
                    <div className="relative z-10 flex flex-col gap-4">
                      {/* Icon and Badge */}
                      <div className="flex items-center justify-between">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-all duration-300 shadow-lg ${
                          exerciseMode === "consulenza" 
                            ? "bg-gradient-to-br from-purple-500 to-purple-600 scale-110" 
                            : "bg-gradient-to-br from-gray-100 to-gray-200 group-hover:scale-105"
                        }`}>
                          {exerciseMode === "consulenza" ? (
                            <CheckCircle className="h-8 w-8 text-white" />
                          ) : (
                            <span>📋</span>
                          )}
                        </div>
                        {exerciseMode === "consulenza" && (
                          <Badge className="bg-purple-600 text-white shadow-md">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                              Attiva
                            </div>
                          </Badge>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div>
                        <h4 className={`text-xl font-bold mb-2 transition-colors ${
                          exerciseMode === "consulenza" ? "text-purple-700 dark:text-purple-300" : "text-gray-900 dark:text-white"
                        }`}>
                          Esercizi Consulenza
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                          Esercizi personalizzati assegnati dal tuo consulente per il tuo percorso specifico
                        </p>
                        
                        {/* Stats */}
                        <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2 text-xs">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              exerciseMode === "consulenza" ? "bg-purple-100 dark:bg-purple-900/40" : "bg-gray-100 dark:bg-gray-800"
                            }`}>
                              <Target className={`h-4 w-4 ${exerciseMode === "consulenza" ? "text-purple-600 dark:text-purple-400" : "text-gray-600 dark:text-gray-400"}`} />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {assignments.filter((a: ExerciseAssignment) => !COURSE_CATEGORIES.includes(a.exercise.category)).length}
                              </p>
                              <p className="text-gray-500 dark:text-gray-400">Totali</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              exerciseMode === "consulenza" ? "bg-orange-100 dark:bg-orange-900/40" : "bg-gray-100 dark:bg-gray-800"
                            }`}>
                              <Clock className={`h-4 w-4 ${exerciseMode === "consulenza" ? "text-orange-600 dark:text-orange-400" : "text-gray-600 dark:text-gray-400"}`} />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {assignments.filter((a: ExerciseAssignment) => 
                                  !COURSE_CATEGORIES.includes(a.exercise.category) && 
                                  (a.status === 'pending' || a.status === 'returned')
                                ).length}
                              </p>
                              <p className="text-gray-500 dark:text-gray-400">Da fare</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Hover arrow */}
                      <div className={`absolute bottom-4 right-4 transition-all duration-300 ${
                        exerciseMode === "consulenza" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}>
                        <ChevronRight className={`h-6 w-6 ${exerciseMode === "consulenza" ? "text-purple-600" : "text-gray-400"}`} />
                      </div>
                    </div>
                  </button>

                  {/* Corso Card - Enhanced */}
                  <button
                    onClick={() => setExerciseMode("corso")}
                    className={`group relative p-8 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden ${
                      exerciseMode === "corso"
                        ? "border-green-500 bg-gradient-to-br from-green-500/10 via-green-400/5 to-transparent dark:from-green-800/30 dark:via-green-800/20 dark:to-transparent shadow-xl scale-[1.03] ring-4 ring-green-500/20 dark:ring-green-700/30"
                        : "border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm hover:border-green-400 dark:hover:border-green-600 hover:shadow-lg hover:scale-[1.02]"
                    }`}
                    data-tour="exercises-mode-corso"
                  >
                    {/* Animated background gradient */}
                    {exerciseMode === "corso" && (
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-green-400/5 animate-pulse"></div>
                    )}
                    
                    <div className="relative z-10 flex flex-col gap-4">
                      {/* Icon and Badge */}
                      <div className="flex items-center justify-between">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl transition-all duration-300 shadow-lg ${
                          exerciseMode === "corso" 
                            ? "bg-gradient-to-br from-green-500 to-green-600 scale-110" 
                            : "bg-gradient-to-br from-gray-100 to-gray-200 group-hover:scale-105"
                        }`}>
                          {exerciseMode === "corso" ? (
                            <CheckCircle className="h-8 w-8 text-white" />
                          ) : (
                            <span>📚</span>
                          )}
                        </div>
                        {exerciseMode === "corso" && (
                          <Badge className="bg-green-600 text-white shadow-md">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                              Attiva
                            </div>
                          </Badge>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div>
                        <h4 className={`text-xl font-bold mb-2 transition-colors ${
                          exerciseMode === "corso" ? "text-green-700 dark:text-green-300" : "text-gray-900 dark:text-white"
                        }`}>
                          Esercizi Corso
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                          Newsletter e materiali del percorso formativo strutturato
                        </p>
                        
                        {/* Stats */}
                        <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2 text-xs">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              exerciseMode === "corso" ? "bg-green-100 dark:bg-green-900/40" : "bg-gray-100 dark:bg-gray-800"
                            }`}>
                              <GraduationCap className={`h-4 w-4 ${exerciseMode === "corso" ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}`} />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {assignments.filter((a: ExerciseAssignment) => COURSE_CATEGORIES.includes(a.exercise.category)).length}
                              </p>
                              <p className="text-gray-500 dark:text-gray-400">Totali</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              exerciseMode === "corso" ? "bg-orange-100 dark:bg-orange-900/40" : "bg-gray-100 dark:bg-gray-800"
                            }`}>
                              <Clock className={`h-4 w-4 ${exerciseMode === "corso" ? "text-orange-600 dark:text-orange-400" : "text-gray-600 dark:text-gray-400"}`} />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {assignments.filter((a: ExerciseAssignment) => 
                                  COURSE_CATEGORIES.includes(a.exercise.category) && 
                                  (a.status === 'pending' || a.status === 'returned')
                                ).length}
                              </p>
                              <p className="text-gray-500 dark:text-gray-400">Da fare</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Hover arrow */}
                      <div className={`absolute bottom-4 right-4 transition-all duration-300 ${
                        exerciseMode === "corso" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}>
                        <ChevronRight className={`h-6 w-6 ${exerciseMode === "corso" ? "text-green-600" : "text-gray-400"}`} />
                      </div>
                    </div>
                  </button>
                </div>
                </div>
              )}
            </div>

            {/* STEP 2: Category Selection View */}
            {selectedCourse === null && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Quali esercizi vuoi fare?</h3>
                  <p className="text-gray-600 dark:text-gray-400">Scegli una categoria per iniziare</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allCategories.map((category) => {
                    const categoryAssignments = modeFilteredAssignments.filter((a: ExerciseAssignment) => a.exercise.category === category);
                    const pendingCount = categoryAssignments.filter((a: ExerciseAssignment) => a.status === 'pending' || a.status === 'returned').length;
                    const completedCount = categoryAssignments.length - pendingCount;
                    const progressPercentage = categoryAssignments.length > 0 ? (completedCount / categoryAssignments.length) * 100 : 0;
                    
                    const getCategoryGradient = (cat: string) => {
                      const gradients = {
                        'finanza-personale': 'from-emerald-500 via-emerald-600 to-teal-600',
                        'risparmio-investimenti': 'from-blue-500 via-blue-600 to-indigo-600',
                        'vendita': 'from-orange-500 via-orange-600 to-red-600',
                        'marketing': 'from-pink-500 via-pink-600 to-rose-600',
                        'imprenditoria': 'from-indigo-500 via-indigo-600 to-purple-600',
                        'post-consulenza': 'from-purple-500 via-purple-600 to-indigo-600',
                        'newsletter': 'from-green-500 via-green-600 to-emerald-600',
                        'metodo-turbo': 'from-yellow-500 via-yellow-600 to-orange-500',
                        'metodo-hybrid': 'from-cyan-500 via-cyan-600 to-blue-600',
                        'contabilità': 'from-gray-500 via-gray-600 to-slate-600',
                        'gestione-risorse': 'from-teal-500 via-teal-600 to-cyan-600',
                        'strategia': 'from-red-500 via-red-600 to-rose-600'
                      };
                      return gradients[cat as keyof typeof gradients] || 'from-gray-500 via-gray-600 to-slate-600';
                    };

                    const getCategoryTextGradient = (cat: string) => {
                      const textGradients = {
                        'finanza-personale': 'from-emerald-600 via-emerald-700 to-teal-700',
                        'risparmio-investimenti': 'from-blue-600 via-blue-700 to-indigo-700',
                        'vendita': 'from-orange-600 via-orange-700 to-red-700',
                        'marketing': 'from-pink-600 via-pink-700 to-rose-700',
                        'imprenditoria': 'from-indigo-600 via-indigo-700 to-purple-700',
                        'post-consulenza': 'from-purple-600 via-purple-700 to-indigo-700',
                        'newsletter': 'from-green-600 via-green-700 to-emerald-700',
                        'metodo-turbo': 'from-yellow-600 via-yellow-700 to-orange-600',
                        'metodo-hybrid': 'from-cyan-600 via-cyan-700 to-blue-700',
                        'contabilità': 'from-gray-600 via-gray-700 to-slate-700',
                        'gestione-risorse': 'from-teal-600 via-teal-700 to-cyan-700',
                        'strategia': 'from-red-600 via-red-700 to-rose-700'
                      };
                      return textGradients[cat as keyof typeof textGradients] || 'from-gray-600 via-gray-700 to-slate-700';
                    };

                    const gradient = getCategoryGradient(category);
                    const textGradient = getCategoryTextGradient(category);

                    return (
                      <button
                        key={category}
                        onClick={() => setSelectedCourse(category)}
                        className="group relative p-6 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-transparent hover:shadow-2xl transition-all duration-500 text-left overflow-hidden transform hover:-translate-y-2"
                      >
                        {/* Animated background gradient */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`}></div>
                        
                        {/* Shimmer effect on hover */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                        </div>
                        
                        {/* Content */}
                        <div className="relative z-10">
                          {/* Icon with gradient background */}
                          <div className={`w-20 h-20 bg-gradient-to-br ${gradient} rounded-2xl flex items-center justify-center text-4xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg`}>
                            <span className="filter drop-shadow-lg">{getCategoryIcon(category)}</span>
                          </div>
                          
                          {/* Category Name */}
                          <h4 className="font-bold text-xl text-gray-900 dark:text-white mb-3 transition-colors duration-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                            {getCategoryLabel(category)}
                          </h4>
                          
                          {/* Stats with icons */}
                          <div className="flex items-center gap-4 text-sm mb-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg group-hover:bg-white/80 dark:group-hover:bg-gray-600/80 transition-colors">
                              <BookOpen size={16} className="text-gray-500 dark:text-gray-400" />
                              <span className="font-semibold text-gray-700 dark:text-gray-200">{categoryAssignments.length}</span>
                              <span className="text-gray-500 dark:text-gray-400">totali</span>
                            </div>
                            {pendingCount > 0 && (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/30 rounded-lg border border-orange-200 dark:border-orange-700 animate-pulse">
                                <Target size={16} className="text-orange-500 dark:text-orange-400" />
                                <span className="font-semibold text-orange-600 dark:text-orange-300">{pendingCount}</span>
                                <span className="text-orange-500 dark:text-orange-400">da fare</span>
                              </div>
                            )}
                          </div>

                          {/* Progress bar with percentage */}
                          {categoryAssignments.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                                <span className="font-medium">Progresso</span>
                                <span className="font-bold">{Math.round(progressPercentage)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-3 overflow-hidden shadow-inner">
                                <div 
                                  className={`bg-gradient-to-r ${gradient} h-3 rounded-full transition-all duration-700 ease-out relative overflow-hidden`}
                                  style={{ width: `${progressPercentage}%` }}
                                >
                                  {/* Shine effect on progress bar */}
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer"></div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Hover arrow with glow */}
                        <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <div className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center shadow-lg`}>
                            <ChevronRight size={20} className="text-white" />
                          </div>
                        </div>

                        {/* Corner decoration */}
                        <div className={`absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-20 rounded-full transition-opacity duration-500`}></div>
                      </button>
                    );
                  })}
                </div>

                {allCategories.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BookOpen size={32} className="text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Nessuna categoria disponibile</h3>
                    <p className="text-gray-600 dark:text-gray-400">Non ci sono esercizi disponibili per questa modalità.</p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Exercises View (only when a category is selected) */}
            {selectedCourse !== null && (
              <>
                {/* Sticky Header Wrapper */}
                <div className="sticky top-0 z-50 bg-white dark:bg-gray-800 space-y-4 shadow-sm">
                  {/* Back button and Breadcrumb */}
                  <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCourse(null)}
                          className="gap-2 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          <ArrowLeft size={16} />
                          Indietro
                        </Button>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600 dark:text-gray-400">
                            Esercizi {exerciseMode === "corso" ? "Corso" : "Consulenza"}
                          </span>
                          <ChevronRight size={14} className="text-gray-400 dark:text-gray-600" />
                          <span className="font-semibold text-purple-600 dark:text-purple-400">
                            {getCategoryLabel(selectedCourse)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Layout Switcher */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant={layoutView === "kanban" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLayoutView("kanban")}
                          className={layoutView === "kanban" ? "bg-purple-600 hover:bg-purple-700" : ""}
                        >
                          <Columns3 size={16} className="mr-2" />
                          Kanban
                        </Button>
                        <Button
                          variant={layoutView === "timeline" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setLayoutView("timeline")}
                          className={layoutView === "timeline" ? "bg-purple-600 hover:bg-purple-700" : ""}
                        >
                          <TrendingUp size={16} className="mr-2" />
                          Timeline
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Status Filters */}
                  <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin snap-x snap-mandatory px-1">
                    {/* All */}
                    <button
                      onClick={() => setSelectedStatus("all")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap shrink-0 snap-start ${
                        selectedStatus === "all"
                          ? "bg-purple-600 text-white shadow-md"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      <BookOpen size={16} className="shrink-0" />
                      Tutti
                      <Badge className={`${selectedStatus === "all" ? "bg-purple-500" : "bg-gray-400"} text-white ml-1 shrink-0`}>
                        {statusStats.total}
                      </Badge>
                    </button>

                    {/* Da Completare */}
                    <button
                      onClick={() => setSelectedStatus("pending")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap shrink-0 snap-start ${
                        selectedStatus === "pending"
                          ? "bg-orange-600 text-white shadow-md"
                          : "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200 hover:bg-orange-100 dark:hover:bg-orange-900/50 border border-orange-200 dark:border-orange-800"
                      }`}
                    >
                      <Target size={16} className="shrink-0" />
                      Da Completare
                      <Badge className={`${selectedStatus === "pending" ? "bg-orange-500" : "bg-orange-400"} text-white ml-1 shrink-0`}>
                        {statusStats.pending}
                      </Badge>
                    </button>

                    {/* In Corso */}
                    <button
                      onClick={() => setSelectedStatus("in_progress")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap shrink-0 snap-start ${
                        selectedStatus === "in_progress"
                          ? "bg-blue-600 text-white shadow-md"
                          : "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800"
                      }`}
                    >
                      <PlayCircle size={16} className="shrink-0" />
                      In Corso
                      <Badge className={`${selectedStatus === "in_progress" ? "bg-blue-500" : "bg-blue-400"} text-white ml-1 shrink-0`}>
                        {statusStats.inProgress}
                      </Badge>
                    </button>

                    {/* In Revisione */}
                    <button
                      onClick={() => setSelectedStatus("submitted")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap shrink-0 snap-start ${
                        selectedStatus === "submitted"
                          ? "bg-purple-600 text-white shadow-md"
                          : "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800"
                      }`}
                    >
                      <Clock size={16} className="shrink-0" />
                      In Revisione
                      <Badge className={`${selectedStatus === "submitted" ? "bg-purple-500" : "bg-purple-400"} text-white ml-1 shrink-0`}>
                        {statusStats.submitted}
                      </Badge>
                    </button>

                    {/* Completati */}
                    <button
                      onClick={() => setSelectedStatus("completed")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap shrink-0 snap-start ${
                        selectedStatus === "completed"
                          ? "bg-green-600 text-white shadow-md"
                          : "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900/50 border border-green-200 dark:border-green-800"
                      }`}
                    >
                      <CheckCircle size={16} className="shrink-0" />
                      Completati
                      <Badge className={`${selectedStatus === "completed" ? "bg-green-500" : "bg-green-400"} text-white ml-1 shrink-0`}>
                        {statusStats.completed}
                      </Badge>
                    </button>
                  </div>
                  </div>
                </div>

                {/* Main Content */}
                <Card className="p-6 bg-white dark:bg-gray-800 shadow-sm relative mt-2">
                  {/* Exercises Content - Conditional Rendering */}
                  {layoutView === "grid" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                      {getFilteredAssignments().length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-16">
                          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                            <BookOpen size={32} className="text-gray-400 dark:text-gray-500" />
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Nessun esercizio trovato</h3>
                          <p className="text-gray-600 dark:text-gray-400 text-center">
                            {searchTerm || selectedCourse || selectedStatus !== "all"
                              ? "Prova a modificare i filtri di ricerca."
                              : "Non ci sono ancora esercizi disponibili."}
                          </p>
                        </div>
                      ) : (
                        getFilteredAssignments().map((assignment: ExerciseAssignment) => (
                          <ExerciseCard key={assignment.id} assignment={assignment} onViewExercise={handleViewExercise} />
                        ))
                      )}
                    </div>
                  )}

                  {layoutView === "kanban" && (
                    <div className="space-y-6">
                      {/* Mostra tutte le colonne se filtro è "all" */}
                      {selectedStatus === "all" && (
                        <>
                          {/* Prima riga - Da Completare e In Corso */}
                          {(pendingAssignments.length > 0 || inProgressAssignments.length > 0) && (
                            <div className={`grid grid-cols-1 ${pendingAssignments.length > 0 && inProgressAssignments.length > 0 ? 'lg:grid-cols-2' : ''} gap-4`}>
                              {/* Da Completare Column */}
                              {pendingAssignments.length > 0 && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-2 border-orange-200 dark:border-orange-800" data-tour="exercises-kanban-pending">
                                  <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-orange-100 dark:border-orange-800 bg-gradient-to-r from-orange-50 dark:from-orange-900/20 to-orange-100 dark:to-orange-900/10 -m-4 p-4 rounded-t-xl">
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md">
                                        <Target size={22} className="text-white" />
                                      </div>
                                      <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-base">Da Completare</h3>
                                        <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">Esercizi da iniziare</p>
                                      </div>
                                    </div>
                                    <Badge className="bg-orange-600 text-white font-bold px-3 py-1 text-sm shadow-md">
                                      {pendingAssignments.length}
                                    </Badge>
                                  </div>
                                  <div className="space-y-2 min-h-[250px] max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                    {pendingAssignments.map((assignment: ExerciseAssignment, index: number) => (
                                      <KanbanCard key={assignment.id} assignment={assignment} onViewExercise={handleViewExercise} isFirstCard={index === 0} />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* In Corso Column */}
                              {inProgressAssignments.length > 0 && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-2 border-blue-200 dark:border-blue-800" data-tour="exercises-kanban-inprogress">
                                  <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-blue-100 dark:border-blue-800 bg-gradient-to-r from-blue-50 dark:from-blue-900/20 to-blue-100 dark:to-blue-900/10 -m-4 p-4 rounded-t-xl">
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                                        <PlayCircle size={22} className="text-white" />
                                      </div>
                                      <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-base">In Corso</h3>
                                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Esercizi iniziati</p>
                                      </div>
                                    </div>
                                    <Badge className="bg-blue-600 text-white font-bold px-3 py-1 text-sm shadow-md">
                                      {inProgressAssignments.length}
                                    </Badge>
                                  </div>
                                  <div className="space-y-2 min-h-[250px] max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                    {inProgressAssignments.map((assignment: ExerciseAssignment) => (
                                      <KanbanCard key={assignment.id} assignment={assignment} onViewExercise={handleViewExercise} />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Seconda riga - In Revisione e Completati */}
                          {(submittedAssignments.length > 0 || completedAssignments.length > 0) && (
                            <div className={`grid grid-cols-1 ${submittedAssignments.length > 0 && completedAssignments.length > 0 ? 'lg:grid-cols-2' : ''} gap-4`}>
                              {/* In Revisione Column */}
                              {submittedAssignments.length > 0 && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-2 border-purple-200 dark:border-purple-800">
                                  <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-purple-100 dark:border-purple-800 bg-gradient-to-r from-purple-50 dark:from-purple-900/20 to-purple-100 dark:to-purple-900/10 -m-4 p-4 rounded-t-xl">
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                                        <Clock size={22} className="text-white" />
                                      </div>
                                      <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-base">In Revisione</h3>
                                        <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">In attesa di valutazione</p>
                                      </div>
                                    </div>
                                    <Badge className="bg-purple-600 text-white font-bold px-3 py-1 text-sm shadow-md">
                                      {submittedAssignments.length}
                                    </Badge>
                                  </div>
                                  <div className="space-y-2 min-h-[250px] max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                    {submittedAssignments.map((assignment: ExerciseAssignment) => (
                                      <KanbanCard key={assignment.id} assignment={assignment} onViewExercise={handleViewExercise} />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Completati Column */}
                              {completedAssignments.length > 0 && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-2 border-green-200 dark:border-green-800">
                                  <div className="flex items-center justify-between mb-4 pb-4 border-b-2 border-green-100 dark:border-green-800 bg-gradient-to-r from-green-50 dark:from-green-900/20 to-green-100 dark:to-green-900/10 -m-4 p-4 rounded-t-xl">
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-md">
                                        <CheckCircle size={22} className="text-white" />
                                      </div>
                                      <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-base">Completati</h3>
                                        <p className="text-xs text-green-700 dark:text-green-300 font-medium">Esercizi terminati</p>
                                      </div>
                                    </div>
                                    <Badge className="bg-green-600 text-white font-bold px-3 py-1 text-sm shadow-md">
                                      {completedAssignments.length}
                                    </Badge>
                                  </div>
                                  <div className="space-y-2 min-h-[250px] max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                    {completedAssignments.map((assignment: ExerciseAssignment) => (
                                      <KanbanCard key={assignment.id} assignment={assignment} onViewExercise={handleViewExercise} />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Messaggio se non ci sono esercizi */}
                          {pendingAssignments.length === 0 && inProgressAssignments.length === 0 && submittedAssignments.length === 0 && completedAssignments.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-16">
                              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                <BookOpen size={32} className="text-gray-400 dark:text-gray-500" />
                              </div>
                              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Nessun esercizio disponibile</h3>
                              <p className="text-gray-600 dark:text-gray-400 text-center">
                                Non ci sono ancora esercizi in nessuna categoria.
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      {/* Mostra solo colonna specifica se filtrato */}
                      {selectedStatus === "pending" && (
                        <div className="max-w-2xl mx-auto">
                          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-6 pb-5 border-b-2 border-orange-100 dark:border-orange-800">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-md">
                                  <Target size={24} className="text-white" />
                                </div>
                                <div>
                                  <h3 className="font-bold text-gray-900 dark:text-white text-xl">Da Completare</h3>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Esercizi da iniziare</p>
                                </div>
                              </div>
                              <Badge className="bg-orange-500 text-white font-bold px-4 py-2 text-base shadow-md">
                                {getFilteredAssignments().length}
                              </Badge>
                            </div>
                            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                              {getFilteredAssignments().map((assignment: ExerciseAssignment) => (
                                <KanbanCard key={assignment.id} assignment={assignment} onViewExercise={handleViewExercise} />
                              ))}
                              {getFilteredAssignments().length === 0 && (
                                <div className="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-gray-600">
                                  <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                    <Target size={32} className="opacity-40" />
                                  </div>
                                  <p className="text-base font-medium text-gray-500 dark:text-gray-400">Nessun esercizio da completare</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedStatus === "in_progress" && (
                        <div className="max-w-2xl mx-auto">
                          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-6 pb-5 border-b-2 border-blue-100 dark:border-blue-800">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-md">
                                  <PlayCircle size={24} className="text-white" />
                                </div>
                                <div>
                                  <h3 className="font-bold text-gray-900 dark:text-white text-xl">In Corso</h3>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Esercizi iniziati</p>
                                </div>
                              </div>
                              <Badge className="bg-blue-500 text-white font-bold px-4 py-2 text-base shadow-md">
                                {getFilteredAssignments().length}
                              </Badge>
                            </div>
                            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                              {getFilteredAssignments().map((assignment: ExerciseAssignment) => (
                                <KanbanCard key={assignment.id} assignment={assignment} onViewExercise={handleViewExercise} />
                              ))}
                              {getFilteredAssignments().length === 0 && (
                                <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <PlayCircle size={32} className="opacity-40" />
                                  </div>
                                  <p className="text-base font-medium text-gray-500">Nessun esercizio in corso</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedStatus === "submitted" && (
                        <div className="max-w-2xl mx-auto">
                          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-6 pb-5 border-b-2 border-purple-100">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center shadow-md">
                                  <Clock size={24} className="text-white" />
                                </div>
                                <div>
                                  <h3 className="font-bold text-gray-900 text-xl">In Revisione</h3>
                                  <p className="text-sm text-gray-500 mt-1">In attesa di valutazione</p>
                                </div>
                              </div>
                              <Badge className="bg-purple-500 text-white font-bold px-4 py-2 text-base shadow-md">
                                {getFilteredAssignments().length}
                              </Badge>
                            </div>
                            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                              {getFilteredAssignments().map((assignment: ExerciseAssignment) => (
                                <KanbanCard key={assignment.id} assignment={assignment} onViewExercise={handleViewExercise} />
                              ))}
                              {getFilteredAssignments().length === 0 && (
                                <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <Clock size={32} className="opacity-40" />
                                  </div>
                                  <p className="text-base font-medium text-gray-500">Nessun esercizio in revisione</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedStatus === "completed" && (
                        <div className="max-w-2xl mx-auto">
                          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-6 pb-5 border-b-2 border-green-100">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center shadow-md">
                                  <CheckCircle size={24} className="text-white" />
                                </div>
                                <div>
                                  <h3 className="font-bold text-gray-900 text-xl">Completati</h3>
                                  <p className="text-sm text-gray-500 mt-1">Esercizi terminati</p>
                                </div>
                              </div>
                              <Badge className="bg-green-500 text-white font-bold px-4 py-2 text-base shadow-md">
                                {getFilteredAssignments().length}
                              </Badge>
                            </div>
                            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                              {getFilteredAssignments().map((assignment: ExerciseAssignment) => (
                                <KanbanCard key={assignment.id} assignment={assignment} onViewExercise={handleViewExercise} />
                              ))}
                              {getFilteredAssignments().length === 0 && (
                                <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle size={32} className="opacity-40" />
                                  </div>
                                  <p className="text-base font-medium text-gray-500">Nessun esercizio completato</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {layoutView === "timeline" && (
                    <div className="max-w-4xl mx-auto">
                      {getFilteredAssignments().length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16">
                          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <BookOpen size={32} className="text-gray-400" />
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessun esercizio trovato</h3>
                          <p className="text-gray-600 text-center">
                            {searchTerm || selectedCourse || selectedStatus !== "all"
                              ? "Prova a modificare i filtri di ricerca."
                              : "Non ci sono ancora esercizi disponibili."}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-0">
                          {getFilteredAssignments()
                            .sort((a, b) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime())
                            .map((assignment: ExerciseAssignment, index: number) => (
                              <TimelineCard
                                key={assignment.id}
                                assignment={assignment}
                                onViewExercise={handleViewExercise}
                              />
                            ))}
                        </div>
                      )}
                    </div>
                  )}
            </Card>

                {/* Public Exercises Section */}
                {publicExercises.length > 0 && (
                  <Card className="p-6 bg-white dark:bg-gray-800 shadow-sm">
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Esercizi Pubblici</h2>
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        {filteredPublicExercises.length} esercizi pubblici disponibili
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                      {filteredPublicExercises.map((exercise: any) => {
                        const isStarted = isExerciseStarted(exercise.id);
                        const assignment = getPublicExerciseAssignment(exercise.id);

                        return (
                          <Card
                            key={exercise.id}
                            className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-lg transition-all duration-200 cursor-pointer group overflow-hidden"
                          >
                            <div className="relative h-40 overflow-hidden">
                              <div className="relative w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                <div className="text-4xl">{getCategoryIcon(exercise.category)}</div>
                                <div className="w-14 h-14 bg-black/50 rounded-full flex items-center justify-center group-hover:bg-black/70 transition-all absolute">
                                  <PlayCircle size={20} className="text-white" />
                                </div>
                              </div>
                              {exercise.estimatedDuration !== undefined && (
                                <div className="absolute top-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                  {exercise.estimatedDuration}min
                                </div>
                              )}
                              <div className="absolute top-3 left-3">
                                {isStarted ? (
                                  assignment && getStatusBadge(assignment.status, assignment.score)
                                ) : (
                                  <Badge variant="outline" className="border-purple-200 text-purple-600">
                                    <Globe size={12} className="mr-1" />
                                    Pubblico
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <CardContent className="p-4">
                              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
                                <span>{getCategoryLabel(exercise.category)}</span>
                              </div>
                              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors text-base">
                                {exercise.title}
                              </h3>
                              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                                {exercise.description}
                              </p>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${isStarted ? 'bg-green-500' : 'bg-purple-500'}`}></div>
                                  <span className={`text-xs font-medium ${isStarted ? 'text-green-600 dark:text-green-400' : 'text-purple-600 dark:text-purple-400'}`}>
                                    {isStarted ? 'Avviato' : 'Disponibile'}
                                  </span>
                                </div>
                                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                  <Clock size={12} className="mr-1" />
                                  {exercise.estimatedDuration !== undefined ? exercise.estimatedDuration : 5}min
                                </div>
                              </div>
                              {isStarted ? (
                                <Button
                                  onClick={() => assignment && handleViewExercise(assignment)}
                                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                                  size="sm"
                                >
                                  Continua
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => handleStartPublicExercise(exercise.id)}
                                  disabled={startPublicExerciseMutation.isPending}
                                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                                  size="sm"
                                >
                                  {startPublicExerciseMutation.isPending ? (
                                    <>
                                      <Loader2 size={16} className="animate-spin mr-2" />
                                      Avvio...
                                    </>
                                  ) : (
                                    <>
                                      <PlayCircle size={16} className="mr-2" />
                                      Inizia
                                    </>
                                  )}
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </main>
      </div>
      
      {/* AI Assistant con contesto ricco della pagina esercizi */}
      <AIAssistant pageContext={pageContext} />
    </div>
  );
}