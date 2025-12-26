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
import { useRoleSwitch } from "@/hooks/use-role-switch";
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
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showRoleSwitch={showRoleSwitch} currentRole={currentRole} onRoleSwitch={handleRoleSwitch} />

        <main className="flex-1 overflow-y-auto bg-transparent">
          <div className="container mx-auto px-4 lg:px-8 pt-6 pb-8">
            {/* Header Moderno */}
            <div className="mb-6">
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-700/50">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500"></div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl"></div>

                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-6">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSidebarOpen(true)}
                      className="hover:bg-white/10 md:hidden shrink-0 text-white"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                    <div className="p-3 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl shadow-lg shadow-cyan-500/25">
                      <GraduationCap className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                        La Mia Università
                      </h1>
                      <p className="text-slate-400 text-sm mt-0.5">
                        Percorso di Formazione Professionale
                      </p>
                    </div>
                    {!isTourActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={startUniversityTour}
                        className="gap-2 border-slate-600 text-slate-300 hover:bg-white/10 hover:text-white shrink-0"
                      >
                        <HelpCircle size={16} />
                        <span className="hidden sm:inline">Guida</span>
                      </Button>
                    )}
                  </div>

                  {/* Stats Grid Minimalista */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-tour="university-stats">
                    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10" data-tour="university-stats-lessons">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/20 rounded-lg">
                          <FileText className="h-5 w-5 text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Lezioni</p>
                          <p className="text-2xl font-bold text-white">{stats?.totalLessons || 0}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10" data-tour="university-stats-progress">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-slate-400">Completate</p>
                          <p className="text-2xl font-bold text-white">{stats?.completedLessons || 0}<span className="text-sm text-slate-400 font-normal">/{stats?.totalLessons || 0}</span></p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10" data-tour="university-stats-grade">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                          <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Media Voti</p>
                          <p className="text-2xl font-bold text-white">
                            {stats?.averageGrade ? stats.averageGrade.toFixed(1) : '-'}<span className="text-sm text-slate-400 font-normal">/10</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10" data-tour="university-stats-certificates">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-500/20 rounded-lg">
                          <Award className="h-5 w-5 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Attestati</p>
                          <p className="text-2xl font-bold text-white">{certificates?.length || 0}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Tabs defaultValue="percorso" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6 bg-card p-1.5 rounded-xl border shadow-sm">
                <TabsTrigger 
                  value="percorso" 
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-teal-500 data-[state=active]:text-white rounded-lg py-2.5 font-medium transition-all"
                  data-tour="university-tab-percorso"
                >
                  <GraduationCap className="h-4 w-4" />
                  <span className="hidden sm:inline">Percorso</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="esami" 
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-teal-500 data-[state=active]:text-white rounded-lg py-2.5 font-medium transition-all"
                  data-tour="university-tab-esami"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Esami</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="attestati" 
                  className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-teal-500 data-[state=active]:text-white rounded-lg py-2.5 font-medium transition-all"
                  data-tour="university-tab-attestati"
                >
                  <Award className="h-4 w-4" />
                  <span className="hidden sm:inline">Attestati</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="percorso">
                {isLoading ? (
                  <div className="text-center py-12">Caricamento...</div>
                ) : structure.length === 0 ? (
                  <Card className="border border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <GraduationCap className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Nessun percorso universitario</h3>
                      <p className="text-muted-foreground text-center">Il tuo consulente non ha ancora creato il percorso universitario</p>
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
                        <Card key={year.id} className={`border rounded-xl overflow-hidden transition-all duration-300 ${
                          year.isLocked ? 'opacity-60' : 'hover:shadow-lg'
                        }`} data-tour="university-year-card">
                          {/* Header Anno */}
                          <div className={`p-4 ${year.isLocked ? 'bg-slate-100 dark:bg-slate-800' : 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900'} text-white relative`}>
                            {!year.isLocked && <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500"></div>}

                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => !year.isLocked && toggleYear(year.id)}
                                className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                                  year.isLocked ? 'cursor-not-allowed' : 'hover:bg-white/10 cursor-pointer'
                                }`}
                                disabled={year.isLocked}
                              >
                                {year.isLocked ? (
                                  <Lock className="h-5 w-5 text-slate-400" />
                                ) : expandedYears.includes(year.id) ? (
                                  <ChevronDown className="h-5 w-5 text-cyan-400" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-slate-400" />
                                )}
                              </button>

                              <div className={`p-2.5 rounded-xl shrink-0 ${
                                year.isLocked 
                                  ? 'bg-slate-200 dark:bg-slate-700' 
                                  : 'bg-gradient-to-br from-cyan-500 to-teal-500 shadow-lg'
                              }`}>
                                {year.isLocked ? (
                                  <Lock className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                                ) : (
                                  <Calendar className="h-5 w-5 text-white" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3">
                                  <h3 className={`text-lg font-bold truncate ${year.isLocked ? 'text-slate-700 dark:text-slate-300' : 'text-white'}`}>{year.title}</h3>
                                  {year.isLocked ? (
                                    <Badge className="bg-slate-400/20 text-slate-600 dark:text-slate-300 border-slate-400/30 text-xs">
                                      <Lock className="h-3 w-3 mr-1" />
                                      Bloccato
                                    </Badge>
                                  ) : (
                                    <Badge className={`text-xs ${
                                      completionPercentage === 100 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                      completionPercentage >= 50 ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' :
                                      'bg-slate-500/20 text-slate-300 border-slate-500/30'
                                    }`}>
                                      {completionPercentage}%
                                    </Badge>
                                  )}
                                </div>
                                {year.description && (
                                  <p className={`text-sm truncate mt-0.5 ${year.isLocked ? 'text-slate-500' : 'text-slate-400'}`}>{year.description}</p>
                                )}
                              </div>

                              {yearGrade && (
                                <Badge variant="outline" className="bg-amber-500/20 border-amber-500/30 text-amber-300 shrink-0">
                                  <Star className="h-3 w-3 mr-1 fill-amber-400" />
                                  {yearGrade.grade.toFixed(1)}/10
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          {/* Stats Row */}
                          {!year.isLocked && (
                            <div className="grid grid-cols-4 gap-px bg-border">
                              <div className="bg-card p-3 text-center">
                                <p className="text-xs text-muted-foreground">Trimestri</p>
                                <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{year.trimesters.length}</p>
                              </div>
                              <div className="bg-card p-3 text-center">
                                <p className="text-xs text-muted-foreground">Moduli</p>
                                <p className="text-lg font-bold text-teal-600 dark:text-teal-400">{year.trimesters.reduce((acc, tri) => acc + tri.modules.length, 0)}</p>
                              </div>
                              <div className="bg-card p-3 text-center">
                                <p className="text-xs text-muted-foreground">Lezioni</p>
                                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{totalLessons}</p>
                              </div>
                              <div className="bg-card p-3 text-center">
                                <p className="text-xs text-muted-foreground">Completate</p>
                                <p className="text-lg font-bold text-violet-600 dark:text-violet-400">{completedLessons}</p>
                              </div>
                            </div>
                          )}
                          
                          {yearGrade?.feedback && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
                              <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">Feedback</p>
                              <p className="text-sm text-amber-600 dark:text-amber-200">{yearGrade.feedback}</p>
                            </div>
                          )}

                          {!year.isLocked && expandedYears.includes(year.id) && (
                            <div className="border-t p-4 space-y-3">
                              {year.trimesters.length === 0 ? (
                                <div className="text-center py-8 border border-dashed rounded-xl">
                                  <BookOpen className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-50" />
                                  <p className="text-sm text-muted-foreground">Nessun trimestre disponibile</p>
                                </div>
                              ) : (
                                year.trimesters.map((trimester) => {
                                  const trimesterGrade = findGrade("trimester", trimester.id);
                                  return (
                                    <div key={trimester.id} className="border rounded-xl bg-card overflow-hidden" data-tour="university-trimester">
                                      <div className="flex items-center justify-between p-3 bg-muted/30">
                                        <div className="flex items-center gap-3 flex-1 cursor-pointer min-w-0" onClick={() => toggleTrimester(trimester.id)}>
                                          {expandedTrimesters.includes(trimester.id) ? 
                                            <ChevronDown className="h-4 w-4 text-cyan-600 shrink-0" /> : 
                                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                          }
                                          <div className="p-2 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg shrink-0">
                                            <BookOpen className="h-4 w-4 text-white" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-sm truncate">{trimester.title}</h4>
                                            {trimester.description && (
                                              <p className="text-xs text-muted-foreground truncate">{trimester.description}</p>
                                            )}
                                          </div>
                                        </div>
                                        {trimesterGrade && (
                                          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs shrink-0">
                                            <Star className="h-3 w-3 mr-1 fill-amber-500" />
                                            {trimesterGrade.grade.toFixed(1)}/10
                                          </Badge>
                                        )}
                                      </div>
                                      {trimesterGrade?.feedback && (
                                        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
                                          <p className="text-xs text-amber-600 dark:text-amber-300">{trimesterGrade.feedback}</p>
                                        </div>
                                      )}
                                      {expandedTrimesters.includes(trimester.id) && (
                                        <div className="p-3 pt-0 space-y-2">
                                          {trimester.modules.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-4">Nessun modulo disponibile</p>
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
                                  );
                                })
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

          <TabsContent value="attestati" className="mt-0">
            {!certificates || certificates.length === 0 ? (
              <Card className="border border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <Award className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Nessun Attestato Conseguito</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    Completa i tuoi trimestri e anni universitari per ricevere attestati ufficiali dal tuo consulente
                  </p>
                </CardContent>
              </Card>
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
                        <Card className="border rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all" data-tour="university-certificate-card">
                          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 text-white relative">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500"></div>
                            <div className="flex items-center gap-3">
                              <div className="p-3 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl shadow-lg">
                                <Trophy className="h-6 w-6 text-white" />
                              </div>
                              <div className="flex-1">
                                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 mb-1">Attestato Annuale</Badge>
                                <h3 className="text-lg font-bold">{yearCert.title}</h3>
                              </div>
                              {yearCert.averageGrade !== null && (
                                <Badge variant="outline" className="bg-amber-500/20 border-amber-500/30 text-amber-300 text-lg px-4 py-2">
                                  <Star className="h-5 w-5 mr-1 fill-amber-400" />
                                  {yearCert.averageGrade.toFixed(1)}/10
                                </Badge>
                              )}
                            </div>
                          </div>
                          <CardContent className="p-4 flex items-center justify-between">
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {new Date(yearCert.issuedAt).toLocaleDateString('it-IT', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            {yearCert.pdfUrl && (
                              <a href={yearCert.pdfUrl} download target="_blank" rel="noopener noreferrer">
                                <Button className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white">
                                  <Download className="h-4 w-4 mr-2" />
                                  Scarica
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
                                <Card className="h-full border rounded-xl overflow-hidden hover:shadow-md transition-all">
                                  <div className="p-3 bg-muted/30 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="p-2 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg">
                                        <Medal className="h-4 w-4 text-white" />
                                      </div>
                                      <div>
                                        <Badge variant="outline" className="text-xs mb-1">Trimestrale</Badge>
                                        <h4 className="font-semibold text-sm">{trimCert.title}</h4>
                                      </div>
                                    </div>
                                    {trimCert.averageGrade !== null && (
                                      <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                                        <Star className="h-3 w-3 mr-1 fill-amber-500" />
                                        {trimCert.averageGrade.toFixed(1)}
                                      </Badge>
                                    )}
                                  </div>
                                  <CardContent className="p-3 flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(trimCert.issuedAt).toLocaleDateString('it-IT', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </p>
                                    {trimCert.pdfUrl && (
                                      <a href={trimCert.pdfUrl} download target="_blank" rel="noopener noreferrer">
                                        <Button size="sm" variant="ghost" className="text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50">
                                          <Download className="h-4 w-4" />
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
              <Card className="border border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Nessun Esame Disponibile</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    Il tuo consulente non ha ancora assegnato esami da svolgere
                  </p>
                </CardContent>
              </Card>
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
                      <Card className="border rounded-xl overflow-hidden hover:shadow-lg transition-all" data-tour="university-exam-card">
                        <div className="p-4 flex items-center justify-between bg-muted/30 border-b">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-lg">
                              <FileText className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{exam.title}</h3>
                              {exam.description && <p className="text-sm text-muted-foreground line-clamp-1">{exam.description}</p>}
                            </div>
                          </div>
                          {getStatusBadge()}
                        </div>

                        <div className="p-4 space-y-4">
                          {(exam.examDate || yearInfo || exam.examTimeLimit || exam.totalPoints) && (
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              {exam.examDate && (
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-4 w-4 text-cyan-600" />
                                  <span>{new Date(exam.examDate).toLocaleDateString('it-IT')}</span>
                                </div>
                              )}
                              {yearInfo && (
                                <div className="flex items-center gap-1.5">
                                  <GraduationCap className="h-4 w-4 text-teal-600" />
                                  <span>{yearInfo}{trimesterInfo ? ` - ${trimesterInfo}` : ''}</span>
                                </div>
                              )}
                              {exam.examTimeLimit && (
                                <div className="flex items-center gap-1.5">
                                  <RefreshCw className="h-4 w-4 text-violet-600" />
                                  <span>{exam.examTimeLimit} min</span>
                                </div>
                              )}
                              {exam.totalPoints && (
                                <div className="flex items-center gap-1.5">
                                  <Target className="h-4 w-4 text-emerald-600" />
                                  <span>{exam.totalPoints} punti</span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-3">
                            <Button
                              className="flex-1 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white"
                              onClick={() => {
                                window.location.href = `/exercise/${exam.id}?assignment=${examAssignment.id}`;
                              }}
                              disabled={status === 'completed'}
                            >
                              <PlayCircle className="h-4 w-4 mr-2" />
                              {status === 'completed' ? 'Completato' : 
                               status === 'submitted' ? 'Visualizza' :
                               status === 'in_progress' ? 'Continua' : 
                               'Inizia'}
                            </Button>

                            {(status === 'completed' || status === 'submitted') && examAssignment.score !== null && (
                              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 px-4 py-2 text-lg">
                                <Medal className="h-4 w-4 mr-1" />
                                {examAssignment.score}/{exam.totalPoints || 100}
                              </Badge>
                            )}
                          </div>
                        </div>
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