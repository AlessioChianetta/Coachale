import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { 
  GraduationCap, 
  Calendar,
  BookOpen,
  FileText,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  Award,
  Star,
  Sparkles,
  Trophy,
  Target,
  Download,
  Medal,
  RefreshCw,
  Circle,
  StickyNote,
  PlayCircle,
  Lock,
  Menu,
  HelpCircle
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { getAuthUser } from "@/lib/auth";
import confetti from "canvas-confetti";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { usePageContext } from "@/hooks/use-page-context";
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { driverConfig } from '@/lib/tour/driver-config';
import { universityTourSteps } from '@/components/interactive-tour/university-tour-steps';

interface UniversityLesson {
  id: string;
  title: string;
  description: string | null;
  resourceUrl: string | null;
  exerciseId: string | null;
  libraryDocumentId?: string | null;
  progress?: {
    isCompleted: boolean;
    completedAt: Date | null;
    notes: string | null;
  };
}

interface UniversityModule {
  id: string;
  title: string;
  description: string | null;
  lessons: UniversityLesson[];
}

interface UniversityTrimester {
  id: string;
  title: string;
  description: string | null;
  modules: UniversityModule[];
}

interface UniversityYear {
  id: string;
  title: string;
  description: string | null;
  isLocked: boolean;
  trimesters: UniversityTrimester[];
}

interface UniversityGrade {
  id: string;
  clientId: string;
  consultantId: string;
  referenceType: "year" | "trimester" | "module";
  referenceId: string;
  grade: number;
  feedback: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UniversityCertificate {
  id: string;
  clientId: string;
  consultantId: string;
  certificateType: "trimester" | "year";
  referenceId: string;
  title: string;
  averageGrade: number | null;
  pdfUrl: string | null;
  issuedAt: Date;
  createdAt: Date;
}

// Componente riutilizzabile per renderizzare moduli e lezioni con esercizi
const ModulesWithExercises = ({ 
  modules, 
  expandedModules, 
  toggleModule, 
  findGrade, 
  handleToggleLesson, 
  setSelectedLessonForNotes, 
  setNotesDialogOpen, 
  lessonNotes 
}: {
  modules: UniversityModule[];
  expandedModules: string[];
  toggleModule: (moduleId: string) => void;
  findGrade: (referenceType: "year" | "trimester" | "module", referenceId: string) => UniversityGrade | undefined;
  handleToggleLesson: (lessonId: string, currentCompleted: boolean) => void;
  setSelectedLessonForNotes: (lesson: { id: string; title: string; } | null) => void;
  setNotesDialogOpen: (isOpen: boolean) => void;
  lessonNotes: Record<string, string>;
}) => {
  // Query per ottenere tutti gli assignment del cliente (una sola volta per il componente)
  const { data: exerciseAssignments = [] } = useQuery<any[]>({
    queryKey: ["/api/exercise-assignments/client"],
    enabled: modules.some(module => module.lessons.some(l => l.exerciseId)),
  });

  const getExerciseStatusBadge = (assignment: any) => {
    if (!assignment) return null;

    switch (assignment.status) {
      case 'completed':
        return <Badge className="bg-green-500 text-white text-xs">Completato</Badge>;
      case 'submitted':
        return <Badge className="bg-purple-500 text-white text-xs">In Revisione</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500 text-white text-xs">In Corso</Badge>;
      case 'returned':
        return <Badge className="bg-orange-500 text-white text-xs">Da Correggere</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Da Fare</Badge>;
    }
  };

  return (
    <>
      {modules.map((module) => {
        const moduleGrade = findGrade("module", module.id);
        return (
          <div key={module.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 bg-card" data-tour="university-module">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-2 flex-1 cursor-pointer min-w-0" onClick={() => toggleModule(module.id)}>
                {expandedModules.includes(module.id) ? 
                  <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" /> : 
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                }
                <div className="p-1.5 bg-primary/10 rounded shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-sm sm:text-base font-semibold truncate">
                    {module.title}
                  </h5>
                  {module.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">
                      {module.description}
                    </p>
                  )}
                </div>
              </div>
              {moduleGrade && (
                <Badge variant="secondary" className="px-2 py-0.5 text-xs shrink-0">
                  <Star className="h-3 w-3 mr-1" />
                  {moduleGrade.grade.toFixed(1)}
                </Badge>
              )}
            </div>
            {moduleGrade && moduleGrade.feedback && (
              <div className="mb-2 p-2 bg-muted rounded border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Feedback</p>
                <p className="text-xs">{moduleGrade.feedback}</p>
              </div>
            )}
            {expandedModules.includes(module.id) && (
              <div className="ml-2 sm:ml-4 mt-2 space-y-2">
                {module.lessons.length === 0 ? (
                  <p className="text-xs sm:text-sm text-muted-foreground">Nessuna lezione disponibile</p>
                ) : (
                  module.lessons.map((lesson) => {
                    const completed = lesson.progress?.isCompleted || false;
                    const hasNotes = lesson.progress?.notes && lesson.progress.notes.trim().length > 0;
                    const hasExercise = lesson.exerciseId !== null && lesson.exerciseId !== undefined && lesson.exerciseId.trim() !== '';

                    const linkedAssignment = hasExercise 
                      ? exerciseAssignments.find((a: any) => a.exercise.id === lesson.exerciseId)
                      : null;

                    return (
                      <div key={lesson.id}>
                        <div 
                          className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border ${
                            completed ? 'bg-success/5 border-success/20' : 'bg-card border-border'
                          }`}
                          data-tour="university-lesson"
                        >
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <div className="flex items-center justify-center h-5 w-5 sm:h-4 sm:w-4 shrink-0 mt-0.5 sm:mt-0">
                              {completed ? (
                                <CheckCircle2 className="h-5 w-5 sm:h-4 sm:w-4 text-success" />
                              ) : (
                                <Circle className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm sm:text-base ${completed ? 'line-through text-muted-foreground' : ''}`}>
                                {lesson.title}
                              </p>
                              {lesson.description && (
                                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{lesson.description}</p>
                              )}
                              {hasExercise && linkedAssignment && (
                                <div className="mt-1.5 flex items-center gap-2 text-xs sm:text-sm">
                                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-primary shrink-0" />
                                  <span className="text-muted-foreground">Esercizio:</span>
                                  <span className="font-medium text-primary truncate">{linkedAssignment.exercise.title}</span>
                                </div>
                              )}

                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {hasExercise && linkedAssignment && (
                              <>
                                {getExerciseStatusBadge(linkedAssignment)}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 sm:h-8 px-3 sm:px-2 text-xs sm:text-xs whitespace-nowrap dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.location.href = `/exercise/${linkedAssignment.exercise.id}?assignment=${linkedAssignment.id}`;
                                  }}
                                >
                                  <PlayCircle className="h-4 w-4 sm:h-3 sm:w-3 mr-1.5 sm:mr-1" />
                                  <span className="hidden xs:inline">Vai all'Esercizio</span>
                                  <span className="xs:hidden">Esercizio</span>
                                </Button>
                              </>
                            )}
                            {hasExercise && !linkedAssignment && (
                              <Badge variant="outline" className="text-xs px-2 py-1 text-orange-600 whitespace-nowrap">
                                Esercizio non assegnato
                              </Badge>
                            )}
                            {lesson.libraryDocumentId && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 sm:h-8 px-3 sm:px-2 text-xs bg-blue-50 hover:bg-blue-100 border-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-800/40 dark:border-blue-700 dark:text-blue-200 whitespace-nowrap"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `/client/library/${lesson.libraryDocumentId}`;
                                }}
                              >
                                <BookOpen className="h-4 w-4 sm:h-3 sm:w-3 mr-1.5 sm:mr-1" />
                                <span className="hidden xs:inline">Vai alla Lezione</span>
                                <span className="xs:hidden">Lezione</span>
                              </Button>
                            )}
                            {lesson.resourceUrl && !hasExercise && (
                              <a 
                                href={lesson.resourceUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1 text-xs sm:text-sm whitespace-nowrap min-h-[44px] sm:min-h-0 py-2 sm:py-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-4 w-4 sm:h-3 sm:w-3" />
                                Vai
                              </a>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 sm:h-8 sm:w-8 p-0 shrink-0"
                              onClick={() => {
                                setSelectedLessonForNotes({
                                  id: lesson.id,
                                  title: lesson.title
                                });
                                setNotesDialogOpen(true);
                              }}
                              data-tour="university-lesson-notes-button"
                            >
                              <StickyNote className={`h-5 w-5 sm:h-4 sm:w-4 ${hasNotes ? 'text-primary fill-primary/20' : 'text-muted-foreground'}`} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

export default function ClientUniversity() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedYears, setExpandedYears] = useState<string[]>([]);
  const [expandedTrimesters, setExpandedTrimesters] = useState<string[]>([]);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [lessonNotes, setLessonNotes] = useState<Record<string, string>>({});
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedLessonForNotes, setSelectedLessonForNotes] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [isTourActive, setIsTourActive] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // Fetch full university structure with progress
  const { data: structure = [], isLoading: structureLoading } = useQuery<UniversityYear[]>({
    queryKey: ["/api/university/structure"],
  });

  // Fetch statistics
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalLessons: number;
    completedLessons: number;
    completionPercentage: number;
    averageGrade: number | null;
    totalCertificates: number;
  }>({
    queryKey: ["/api/university/stats"],
  });

  // Fetch grades
  const { data: grades = [] } = useQuery<UniversityGrade[]>({
    queryKey: ["/api/university/grades"],
  });

  // Fetch certificates
  const user = getAuthUser();
  const { data: certificates = [] } = useQuery<UniversityCertificate[]>({
    queryKey: ["/api/university/certificates", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/university/certificates/${user.id}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch certificates");
      return response.json();
    },
    enabled: !!user?.id
  });

  // Fetch exams (exercises with isExam=true)
  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["/api/exercise-assignments/client", { isExam: true }],
    queryFn: async () => {
      const response = await fetch("/api/exercise-assignments/client?isExam=true", {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch exams");
      const assignments = await response.json();
      // Backend should filter by isExam, but we add client-side filter as fallback
      return Array.isArray(assignments) 
        ? assignments.filter((assignment: any) => assignment.exercise?.isExam === true)
        : [];
    },
    enabled: !!user?.id,
  });

  // Page context for AI assistant - semplicemente rileva che siamo sulla pagina università
  const pageContext = usePageContext();

  // Toggle lesson completion
  const toggleLessonMutation = useMutation({
    mutationFn: async ({ lessonId, isCompleted }: { lessonId: string; isCompleted: boolean }) => {
      return await apiRequest("POST", "/api/university/progress", {
        lessonId,
        isCompleted,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/structure"] });
      queryClient.invalidateQueries({ queryKey: ["/api/university/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/badges"] });

      // Check if badges were earned
      if (data.earnedBadges && data.earnedBadges.length > 0) {
        // Show confetti animation
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#9370DB', '#00CED1']
        });

        // Show toast for each badge earned
        data.earnedBadges.forEach((badge: any) => {
          toast({
            title: `🎉 Nuovo Badge Sbloccato!`,
            description: `${badge.badgeName}: ${badge.badgeDescription}`,
            duration: 5000,
          });
        });
      } else {
        toast({ title: "Progresso aggiornato" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  // Save lesson notes
  const saveNotesMutation = useMutation({
    mutationFn: async ({ lessonId, notes }: { lessonId: string; notes: string }) => {
      return await apiRequest("POST", "/api/university/progress", {
        lessonId,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/university/structure"] });
    },
    onError: (error: Error) => {
      toast({ title: "Errore nel salvare le note", description: error.message, variant: "destructive" });
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

  const handleToggleLesson = (lessonId: string, currentCompleted: boolean) => {
    toggleLessonMutation.mutate({ lessonId, isCompleted: !currentCompleted });
  };

  const handleNotesChange = (lessonId: string, notes: string) => {
    setLessonNotes(prev => ({ ...prev, [lessonId]: notes }));

    if (saveTimers.current[lessonId]) {
      clearTimeout(saveTimers.current[lessonId]);
    }

    saveTimers.current[lessonId] = setTimeout(() => {
      saveNotesMutation.mutate({ lessonId, notes });
    }, 1000);
  };

  useEffect(() => {
    if (structure.length === 0) {
      setLessonNotes({});
      return;
    }

    const initialNotes: Record<string, string> = {};
    structure.forEach(year => {
      year.trimesters.forEach(trimester => {
        trimester.modules.forEach(module => {
          module.lessons.forEach(lesson => {
            initialNotes[lesson.id] = lesson.progress?.notes ?? "";
          });
        });
      });
    });
    setLessonNotes(initialNotes);

    // Auto-expand first year, trimester, and module to show lessons
    if (structure.length > 0) {
      const firstYear = structure[0];
      setExpandedYears([firstYear.id]);

      if (firstYear.trimesters.length > 0) {
        const firstTrimester = firstYear.trimesters[0];
        setExpandedTrimesters([firstTrimester.id]);

        if (firstTrimester.modules.length > 0) {
          const firstModule = firstTrimester.modules[0];
          setExpandedModules([firstModule.id]);
        }
      }
    }
  }, [structure]);

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  const findGrade = (referenceType: "year" | "trimester" | "module", referenceId: string) => {
    return grades.find(g => g.referenceType === referenceType && g.referenceId === referenceId);
  };

  const startUniversityTour = () => {
    setIsTourActive(true);
    const driverObj = driver({
      ...driverConfig,
      onDestroyed: () => {
        setIsTourActive(false);
      },
    });
    driverObj.setSteps(universityTourSteps);
    driverObj.drive();
  };

  const isLoading = structureLoading || statsLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 overflow-y-auto bg-transparent">
          <div className="container mx-auto px-4 lg:px-8 pt-6 pb-8">
            {/* Header Universitario Minimal con Gradiente */}
            <div className="mb-6">
              <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
                {/* Gradiente decorativo di sfondo */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-purple-950/20 opacity-60"></div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl"></div>
                
                <div className="relative z-10 p-4 md:p-6">
                  <div className="flex items-center gap-4 mb-6 pb-5 border-b border-gray-200/50 dark:border-gray-700/50">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSidebarOpen(true)}
                      className="hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden shrink-0"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                    <div className="p-3.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg shrink-0">
                      <GraduationCap className="h-9 w-9 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">
                        La Mia Università
                      </h1>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        Percorso di Formazione Professionale
                      </p>
                    </div>
                    {!isTourActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={startUniversityTour}
                        className="gap-2 border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/20 shrink-0"
                      >
                        <HelpCircle size={16} />
                        <span className="hidden sm:inline">Guida Interattiva</span>
                      </Button>
                    )}
                  </div>

                  {/* Stats Grid con Gradienti */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4" data-tour="university-stats">
                    {/* Lezioni Totali */}
                    <div className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 rounded-xl p-3 sm:p-4 border border-blue-200/50 dark:border-blue-800/50 hover:shadow-md transition-all" data-tour="university-stats-lessons">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-blue-400/10 rounded-full blur-2xl"></div>
                      <div className="relative">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                          <div className="p-1 sm:p-1.5 bg-blue-600/10 rounded-lg shrink-0">
                            <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide truncate">Lezioni Totali</span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-bold text-blue-900 dark:text-blue-100">{stats?.totalLessons || 0}</div>
                      </div>
                    </div>

                    {/* Progresso */}
                    <div className="group relative overflow-hidden bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/40 rounded-xl p-3 sm:p-4 border border-emerald-200/50 dark:border-emerald-800/50 hover:shadow-md transition-all" data-tour="university-stats-progress">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-400/10 rounded-full blur-2xl"></div>
                      <div className="relative">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                          <div className="p-1 sm:p-1.5 bg-emerald-600/10 rounded-lg shrink-0">
                            <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide truncate">Progresso</span>
                        </div>
                        <div className="space-y-1.5 sm:space-y-2">
                          <div className="flex items-baseline gap-1 sm:gap-1.5">
                            <div className="text-2xl sm:text-3xl font-bold text-emerald-900 dark:text-emerald-100">{stats?.completedLessons || 0}</div>
                            <div className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-medium">/ {stats?.totalLessons || 0}</div>
                          </div>
                          <div className="space-y-1">
                            <Progress value={stats?.completionPercentage || 0} className="h-1.5 sm:h-2 bg-emerald-200 dark:bg-emerald-900" />
                            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{stats?.completionPercentage || 0}%</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Media Voti */}
                    <div className="group relative overflow-hidden bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 rounded-xl p-3 sm:p-4 border border-amber-200/50 dark:border-amber-800/50 hover:shadow-md transition-all" data-tour="university-stats-grade">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-amber-400/10 rounded-full blur-2xl"></div>
                      <div className="relative">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                          <div className="p-1 sm:p-1.5 bg-amber-600/10 rounded-lg shrink-0">
                            <Star className="h-3 w-3 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400 fill-amber-600 dark:fill-amber-400" />
                          </div>
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide truncate">Media Voti</span>
                        </div>
                        <div className="flex items-baseline gap-1 sm:gap-1.5">
                          <div className="text-2xl sm:text-3xl font-bold text-amber-900 dark:text-amber-100">
                            {stats?.averageGrade ? stats.averageGrade.toFixed(1) : '-'}
                          </div>
                          <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400 font-medium">/10</p>
                        </div>
                      </div>
                    </div>

                    {/* Attestati */}
                    <div className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40 rounded-xl p-3 sm:p-4 border border-purple-200/50 dark:border-purple-800/50 hover:shadow-md transition-all" data-tour="university-stats-certificates">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-purple-400/10 rounded-full blur-2xl"></div>
                      <div className="relative">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                          <div className="p-1 sm:p-1.5 bg-purple-600/10 rounded-lg shrink-0">
                            <Award className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide truncate">Attestati</span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-bold text-purple-900 dark:text-purple-100">{certificates?.length || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Tabs defaultValue="percorso" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-8 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg">
                <TabsTrigger 
                  value="percorso" 
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-lg py-3 font-semibold transition-all duration-300"
                  data-tour="university-tab-percorso"
                >
                  <GraduationCap className="h-5 w-5" />
                  <span className="hidden sm:inline">Il Mio Percorso</span>
                  <span className="sm:hidden">Percorso</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="esami" 
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-lg py-3 font-semibold transition-all duration-300"
                  data-tour="university-tab-esami"
                >
                  <FileText className="h-5 w-5" />
                  <span className="hidden sm:inline">Esami da Fare</span>
                  <span className="sm:hidden">Esami</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="attestati" 
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white rounded-lg py-3 font-semibold transition-all duration-300"
                  data-tour="university-tab-attestati"
                >
                  <Award className="h-5 w-5" />
                  <span className="hidden sm:inline">I Miei Attestati</span>
                  <span className="sm:hidden">Attestati</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="percorso">
                {isLoading ? (
                  <div className="text-center py-12">Caricamento...</div>
                ) : structure.length === 0 ? (
                  <Card className="border-0 shadow-lg">
                    <CardContent className="py-12 text-center">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-500/10 to-purple-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <GraduationCap className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Nessun percorso universitario</h3>
                      <p className="text-muted-foreground">Il tuo consulente non ha ancora creato il percorso universitario</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {structure.map((year) => {
                      const yearGrade = findGrade("year", year.id);

                      // Calculate year completion percentage
                      let totalLessons = 0;
                      let completedLessons = 0;
                      year.trimesters.forEach(tri => {
                        tri.modules.forEach(mod => {
                          mod.lessons.forEach(lesson => {
                            totalLessons++;
                            if (lesson.progress?.isCompleted) completedLessons++;
                          });
                        });
                      });
                      const completionPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

                      return (
                        <Card key={year.id} className={`group relative border-0 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden ${
                          year.isLocked 
                            ? 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 opacity-75' 
                            : 'bg-white dark:bg-gray-800'
                        }`} data-tour="university-year-card">
                          {/* Barra Laterale Timeline con Gradiente di Progresso */}
                          <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700">
                            <div 
                              className={`w-full transition-all duration-500 ${
                                year.isLocked 
                                  ? 'bg-gradient-to-b from-slate-400 to-slate-500' 
                                  : 'bg-gradient-to-b from-blue-500 via-purple-500 to-green-500'
                              }`}
                              style={{ height: year.isLocked ? '100%' : `${completionPercentage}%` }}
                            />
                          </div>

                          <CardHeader className="pb-4 pl-4 sm:pl-6 md:pl-8">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                              {/* Header con Informazioni Principali */}
                              <div className="flex items-start gap-2 sm:gap-4 flex-1 min-w-0">
                                <button 
                                  onClick={() => !year.isLocked && toggleYear(year.id)}
                                  className={`mt-1 p-2 rounded-lg transition-colors shrink-0 ${
                                    year.isLocked ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted cursor-pointer'
                                  }`}
                                  disabled={year.isLocked}
                                >
                                  {year.isLocked ? (
                                    <Lock className="h-5 w-5 sm:h-6 sm:w-6 text-slate-500" />
                                  ) : expandedYears.includes(year.id) ? (
                                    <ChevronDown className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                                  ) : (
                                    <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                                  )}
                                </button>

                                <div className="flex-1 space-y-3 min-w-0">
                                  {/* Titolo e Badge Stato */}
                                  <div className="flex items-start gap-2 sm:gap-3 flex-wrap">
                                    <div className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${
                                      year.isLocked 
                                        ? 'bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600' 
                                        : 'bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/50 dark:to-purple-900/50'
                                    }`}>
                                      {year.isLocked ? (
                                        <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 dark:text-slate-400" />
                                      ) : (
                                        <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <CardTitle className="text-lg sm:text-xl font-bold">{year.title}</CardTitle>
                                        {year.isLocked ? (
                                          <Badge className="bg-gradient-to-r from-slate-400 to-slate-500 text-white border-0 shadow-md text-xs whitespace-nowrap">
                                            <Lock className="h-3 w-3 mr-1" />
                                            Da Sbloccare
                                          </Badge>
                                        ) : (
                                          <Badge 
                                            variant="secondary" 
                                            className={`text-xs whitespace-nowrap ${
                                              completionPercentage === 100 ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' :
                                              completionPercentage >= 50 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                                              'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                                            }`}
                                          >
                                            {completionPercentage}%
                                          </Badge>
                                        )}
                                      </div>
                                      {year.description && (
                                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{year.description}</p>
                                      )}
                                      {year.isLocked && (
                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 italic">
                                          Questo livello sarà sbloccato dal tuo consulente quando sarai pronto
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Griglia Statistiche 2x2 */}
                                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                    <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/40 rounded-lg">
                                      <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-300 shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground dark:text-gray-400">Trimestri</p>
                                        <p className="text-sm sm:text-base font-bold text-blue-600 dark:text-blue-300">{year.trimesters.length}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 bg-purple-50 dark:bg-purple-900/40 rounded-lg">
                                      <FileText className="h-4 w-4 text-purple-600 dark:text-purple-300 shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground dark:text-gray-400">Moduli</p>
                                        <p className="text-sm sm:text-base font-bold text-purple-600 dark:text-purple-300">
                                          {year.trimesters.reduce((acc, tri) => acc + tri.modules.length, 0)}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 bg-green-50 dark:bg-green-900/40 rounded-lg">
                                      <Target className="h-4 w-4 text-green-600 dark:text-green-300 shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground dark:text-gray-400">Lezioni</p>
                                        <p className="text-sm sm:text-base font-bold text-green-600 dark:text-green-300">{totalLessons}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg">
                                      <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-300 shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground dark:text-gray-400">Completate</p>
                                        <p className="text-sm sm:text-base font-bold text-indigo-600 dark:text-indigo-300">{completedLessons}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Voto Anno */}
                              {yearGrade && (
                                <div className="flex flex-col gap-2 min-w-[100px] sm:min-w-[120px]">
                                  <div className="px-2 py-1.5 bg-amber-100 dark:bg-amber-900/40 rounded-md border border-amber-300 dark:border-amber-700 text-xs font-medium text-amber-800 dark:text-amber-200 text-center">
                                    <Star className="h-3 w-3 mr-1 fill-amber-600 inline" />
                                    {yearGrade.grade.toFixed(1)}/10
                                  </div>
                                </div>
                              )}
                            </div>

                            {yearGrade && yearGrade.feedback && (
                              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
                                <p className="text-xs font-medium text-amber-900 dark:text-amber-300 mb-1">Feedback del Consulente</p>
                                <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200">{yearGrade.feedback}</p>
                              </div>
                            )}
                          </CardHeader>

                          {!year.isLocked && expandedYears.includes(year.id) && (
                            <CardContent className="space-y-4 pt-0 pl-4 sm:pl-6 md:pl-8">
                              {year.trimesters.length === 0 ? (
                                <div className="text-center py-8 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900 rounded-xl border-2 border-dashed border-blue-200 dark:border-blue-700">
                                  <BookOpen className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 text-blue-600 dark:text-blue-400 opacity-50" />
                                  <p className="text-xs sm:text-sm text-muted-foreground">Nessun trimestre disponibile</p>
                                </div>
                              ) : (
                                <div className="space-y-3 relative">
                                  {/* Linea Timeline Verticale */}
                                  <div className="absolute left-4 sm:left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-purple-200 to-pink-200 dark:from-blue-700 dark:via-purple-700 dark:to-pink-700" />

                                  {year.trimesters.map((trimester) => {
                                    const trimesterGrade = findGrade("trimester", trimester.id);
                                    return (
                                      <div key={trimester.id} className="relative pl-6 sm:pl-8" data-tour="university-trimester">
                                        {/* Indicatore Timeline */}
                                        <div className="absolute left-1.5 sm:left-3.5 top-3 sm:top-4 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 border-2 sm:border-4 border-white dark:border-gray-800 shadow-lg" />

                                        <div className="border-0 rounded-xl p-3 sm:p-4 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-900/30 dark:to-cyan-900/30 hover:shadow-md transition-all">
                                          <div className="flex items-center justify-between mb-2 gap-2">
                                            <div className="flex items-center gap-2 sm:gap-3 flex-1 cursor-pointer min-w-0" onClick={() => toggleTrimester(trimester.id)}>
                                              {expandedTrimesters.includes(trimester.id) ? 
                                                <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 shrink-0" /> : 
                                                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                                              }
                                              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg shadow-sm shrink-0">
                                                <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <h4 className="text-sm sm:text-base font-semibold truncate">{trimester.title}</h4>
                                                {trimester.description && (
                                                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">{trimester.description}</p>
                                                )}
                                              </div>
                                            </div>
                                            {trimesterGrade && (
                                              <Badge variant="secondary" className="px-2 py-0.5 text-xs shrink-0 whitespace-nowrap">
                                                <Star className="h-3 w-3 mr-1" />
                                                {trimesterGrade.grade.toFixed(1)}/10
                                              </Badge>
                                            )}
                                          </div>
                                          {trimesterGrade && trimesterGrade.feedback && (
                                            <div className="mb-2 p-2 bg-muted rounded border border-border">
                                              <p className="text-xs font-medium text-muted-foreground mb-1">Feedback</p>
                                              <p className="text-xs sm:text-sm">{trimesterGrade.feedback}</p>
                                            </div>
                                          )}
                                          {expandedTrimesters.includes(trimester.id) && (
                                            <div className="ml-4 sm:ml-7 mt-3 space-y-2">
                                              {trimester.modules.length === 0 ? (
                                                <p className="text-xs sm:text-sm text-muted-foreground">Nessun modulo disponibile</p>
                                              ) : (
                                                <ModulesWithExercises 
                                                  modules={trimester.modules} 
                                                  expandedModules={expandedModules} 
                                                  toggleModule={toggleModule} 
                                                  findGrade={findGrade} 
                                                  handleToggleLesson={handleToggleLesson} 
                                                  setSelectedLessonForNotes={setSelectedLessonForNotes} 
                                                  setNotesDialogOpen={setNotesDialogOpen} 
                                                  lessonNotes={lessonNotes} 
                                                />
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </CardContent>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

          <TabsContent value="attestati" className="mt-0">
            {!certificates || certificates.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="border-2 border-dashed border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/30 to-indigo-50/30 dark:from-blue-950/10 dark:to-indigo-950/10">
                  <CardContent className="py-20 text-center">
                    <motion.div 
                      className="w-28 h-28 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-full flex items-center justify-center mx-auto mb-6"
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      <Award className="h-14 w-14 text-blue-600 dark:text-blue-400" />
                    </motion.div>
                    <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-gray-100">Nessun Attestato Conseguito</h3>
                    <p className="text-muted-foreground max-w-md mx-auto text-base">
                      Completa i tuoi trimestri e anni universitari per ricevere attestati ufficiali dal tuo consulente
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="space-y-8">
                {(() => {
                  // Raggruppa gli attestati per anno
                  const yearCertificates = certificates.filter(c => c.certificateType === "year");
                  const trimesterCertificates = certificates.filter(c => c.certificateType === "trimester");

                  return yearCertificates.map((yearCert, yearIndex) => {
                    // Trova i trimestri che appartengono a questo anno
                    const relatedTrimesters = trimesterCertificates.filter(tc => 
                      tc.referenceId && yearCert.referenceId && 
                      structure.some(year => 
                        year.id === yearCert.referenceId && 
                        year.trimesters.some(t => t.id === tc.referenceId)
                      )
                    );

                    return (
                      <motion.div
                        key={yearCert.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: yearIndex * 0.1 }}
                        className="space-y-4"
                      >
                        {/* Attestato Annuale */}
                        <Card className="border-2 border-blue-300 dark:border-blue-700 shadow-xl hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-white to-blue-50/60 dark:from-gray-900 dark:to-blue-950/40 overflow-hidden" data-tour="university-certificate-card">
                          <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"></div>
                          <CardHeader className="pb-4 pt-8">
                            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                              <div className="flex items-center gap-3">
                                <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg">
                                  <Trophy className="h-7 w-7 text-white" />
                                </div>
                                <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-0 px-5 py-2 text-base font-bold shadow-md">
                                  Attestato Annuale
                                </Badge>
                              </div>
                            </div>
                            <CardTitle className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-3 leading-tight">
                              {yearCert.title}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              <span className="text-muted-foreground">
                                {new Date(yearCert.issuedAt).toLocaleDateString('it-IT', { 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </span>
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4 pb-6">
                            {yearCert.averageGrade !== null && (
                              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 rounded-xl p-6 border-2 border-amber-200 dark:border-amber-800 shadow-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                                    Voto Finale
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Star className="h-8 w-8 text-amber-500 fill-amber-500" />
                                    <span className="text-5xl font-bold text-amber-700 dark:text-amber-300">
                                      {yearCert.averageGrade.toFixed(1)}
                                    </span>
                                    <span className="text-2xl text-amber-600 dark:text-amber-400 font-semibold">/10</span>
                                  </div>
                                </div>
                              </div>
                            )}
                            {yearCert.pdfUrl && (
                              <a 
                                href={yearCert.pdfUrl} 
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block"
                              >
                                <Button 
                                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all font-bold text-lg py-7"
                                  size="lg"
                                >
                                  <Download className="h-6 w-6 mr-2" />
                                  Scarica Attestato Annuale
                                </Button>
                              </a>
                            )}
                          </CardContent>
                        </Card>

                        {/* Attestati Trimestrali correlati */}
                        {relatedTrimesters.length > 0 && (
                          <div className="ml-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {relatedTrimesters.map((trimCert, trimIndex) => (
                              <motion.div
                                key={trimCert.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, delay: trimIndex * 0.1 }}
                              >
                                <Card className="h-full border-2 border-blue-200 dark:border-blue-800 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-900 dark:to-blue-950/20 overflow-hidden">
                                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
                                  <CardHeader className="pb-3 pt-6">
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg shadow-md">
                                        <Medal className="h-5 w-5 text-white" />
                                      </div>
                                      <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-0 px-3 py-1 text-xs font-semibold">
                                        Trimestrale
                                      </Badge>
                                    </div>
                                    <CardTitle className="text-lg font-bold text-blue-900 dark:text-blue-100 leading-tight">
                                      {trimCert.title}
                                    </CardTitle>
                                    <CardDescription className="flex items-center gap-1 text-xs mt-2">
                                      <Calendar className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                      <span className="text-muted-foreground">
                                        {new Date(trimCert.issuedAt).toLocaleDateString('it-IT', { 
                                          year: 'numeric', 
                                          month: 'long', 
                                          day: 'numeric' 
                                        })}
                                      </span>
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent className="space-y-3 pb-4">
                                    {trimCert.averageGrade !== null && (
                                      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                                            Voto
                                          </span>
                                          <div className="flex items-center gap-1">
                                            <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                                            <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                                              {trimCert.averageGrade.toFixed(1)}
                                            </span>
                                            <span className="text-sm text-amber-600 dark:text-amber-400 font-semibold">/10</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {trimCert.pdfUrl && (
                                      <a 
                                        href={trimCert.pdfUrl} 
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block"
                                      >
                                        <Button 
                                          className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all font-semibold text-sm py-5"
                                          size="sm"
                                        >
                                          <Download className="h-4 w-4 mr-1" />
                                          Scarica
                                        </Button>
                                      </a>
                                    )}
                                  </CardContent>
                                </Card>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    );
                  });
                })()}
              </div>
            )}
          </TabsContent>

          <TabsContent value="esami" className="mt-0">
            {examsLoading ? (
              <div className="text-center py-12">Caricamento esami...</div>
            ) : !exams || exams.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="border-2 border-dashed border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/30 to-indigo-50/30 dark:from-purple-950/10 dark:to-indigo-950/10">
                  <CardContent className="py-20 text-center">
                    <motion.div 
                      className="w-28 h-28 bg-gradient-to-br from-purple-500/20 to-indigo-600/20 rounded-full flex items-center justify-center mx-auto mb-6"
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      <FileText className="h-14 w-14 text-purple-600 dark:text-purple-400" />
                    </motion.div>
                    <h3 className="text-2xl font-bold mb-3 text-gray-900 dark:text-gray-100">Nessun Esame Disponibile</h3>
                    <p className="text-muted-foreground max-w-md mx-auto text-base">
                      Il tuo consulente non ha ancora assegnato esami da svolgere
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="space-y-4" data-tour="university-exams-list">
                {exams.map((examAssignment: any, index: number) => {
                  const exam = examAssignment.exercise;
                  const status = examAssignment.status;

                  // Find the year and trimester info
                  let yearInfo = null;
                  let trimesterInfo = null;

                  if (exam.yearId) {
                    const year = structure.find(y => y.id === exam.yearId);
                    if (year) {
                      yearInfo = year.title;
                      if (exam.trimesterId) {
                        const trimester = year.trimesters.find(t => t.id === exam.trimesterId);
                        if (trimester) {
                          trimesterInfo = trimester.title;
                        }
                      }
                    }
                  }

                  const getStatusBadge = () => {
                    switch (status) {
                      case 'completed':
                        return <Badge className="bg-green-500 text-white">Completato</Badge>;
                      case 'submitted':
                        return <Badge className="bg-purple-500 text-white">In Revisione</Badge>;
                      case 'in_progress':
                        return <Badge className="bg-blue-500 text-white">In Corso</Badge>;
                      case 'returned':
                        return <Badge className="bg-orange-500 text-white">Da Correggere</Badge>;
                      default:
                        return <Badge variant="outline">Da Fare</Badge>;
                    }
                  };

                  return (
                    <motion.div
                      key={examAssignment.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <Card className="border-2 border-purple-200 dark:border-purple-700 hover:shadow-lg transition-all duration-300" data-tour="university-exam-card">
                        <CardHeader className="p-4 sm:p-6">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-3 flex-wrap">
                                <div className="p-1.5 sm:p-2 bg-purple-100 dark:bg-purple-900 rounded-lg shrink-0">
                                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                {getStatusBadge()}
                              </div>
                              <CardTitle className="text-lg sm:text-xl mb-2">{exam.title}</CardTitle>
                              <CardDescription className="text-xs sm:text-sm">
                                {exam.description}
                              </CardDescription>
                            </div>
                          </div>

                          {/* Info Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mt-4">
                            {exam.examDate && (
                              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">Data:</span>
                                <span className="text-muted-foreground truncate">
                                  {new Date(exam.examDate).toLocaleDateString('it-IT')}
                                </span>
                              </div>
                            )}

                            {yearInfo && (
                              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                                <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">Anno:</span>
                                <span className="text-muted-foreground truncate">{yearInfo}</span>
                              </div>
                            )}

                            {yearInfo && (
                              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                                <BookOpen className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">Periodo:</span>
                                <span className="text-muted-foreground truncate">
                                  {trimesterInfo || "📚 Tutto l'anno"}
                                </span>
                              </div>
                            )}

                            {exam.examTimeLimit && (
                              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                                <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">Tempo:</span>
                                <span className="text-muted-foreground">{exam.examTimeLimit} minuti</span>
                              </div>
                            )}

                            {exam.totalPoints && (
                              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                                <Target className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">Punteggio:</span>
                                <span className="text-muted-foreground">{exam.totalPoints} punti</span>
                              </div>
                            )}

                            {exam.autoCorrect && (
                              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                                <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                                <span className="text-muted-foreground">Correzione automatica</span>
                              </div>
                            )}
                          </div>
                        </CardHeader>

                        <CardContent className="p-4 sm:p-6 pt-0">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white h-11 sm:h-10"
                              onClick={() => {
                                window.location.href = `/exercise/${exam.id}?assignment=${examAssignment.id}`;
                              }}
                              disabled={status === 'completed'}
                            >
                              <PlayCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                              <span className="text-sm sm:text-base">
                                {status === 'completed' ? 'Esame Completato' : 
                                 status === 'submitted' ? 'Visualizza Esame' :
                                 status === 'in_progress' ? 'Continua Esame' : 
                                 'Inizia Esame'}
                              </span>
                            </Button>

                            {(status === 'completed' || status === 'submitted') && examAssignment.score !== null && (
                              <div className="flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-lg border-2 border-amber-200 dark:border-amber-800">
                                <Medal className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 shrink-0" />
                                <span className="font-bold text-sm sm:text-base text-amber-700 dark:text-amber-300 whitespace-nowrap">
                                  {examAssignment.score}/{exam.totalPoints || 100}
                                </span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
          </div>
        </main>
      </div>

      {/* Dialog Note Lezione */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-primary" />
              Note - {selectedLessonForNotes?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Scrivi le tue note personali per questa lezione..."
              value={selectedLessonForNotes ? (lessonNotes[selectedLessonForNotes.id] || "") : ""}
              onChange={(e) => {
                if (selectedLessonForNotes) {
                  handleNotesChange(selectedLessonForNotes.id, e.target.value);
                }
              }}
              className="min-h-[200px]"
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setNotesDialogOpen(false)}
            >
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* AI Assistant con contesto ricco università */}
      <AIAssistant pageContext={pageContext} />
    </div>
  );
}