import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Wand2,
  Sparkles,
  BookOpen,
  Save,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  HelpCircle,
  Check,
  X,
  Globe,
  GraduationCap,
  Baby,
  Briefcase,
  MessageSquare,
  Clock,
  Zap,
  Search,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface ExerciseAIGeneratorPanelProps {
  courseId: string;
  courseName: string;
  onClose: () => void;
  onExercisesGenerated: (templates: any[]) => void;
}

interface Lesson {
  id: string;
  title: string;
  sortOrder: number;
  level?: string;
  hasExercise?: boolean;
}

interface Question {
  id: string;
  question: string;
  type: "multiple_choice" | "true_false" | "open_ended" | "multiple_answer";
  options?: string[];
  correctAnswers?: string[];
  explanation?: string;
  points?: number;
}

interface GeneratedTemplate {
  id: string;
  lessonId: string;
  lessonTitle: string;
  name: string;
  description: string;
  questions: Question[];
  difficulty: string;
  category?: string;
  estimatedDuration?: number;
  isExpanded?: boolean;
  isEditing?: boolean;
}

type GenerationPhase = "selection" | "generating" | "review";

export function ExerciseAIGeneratorPanel({
  courseId,
  courseName,
  onClose,
  onExercisesGenerated,
}: ExerciseAIGeneratorPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<GenerationPhase>("selection");
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string>("intermedio");
  const [questionsPerLesson, setQuestionsPerLesson] = useState<number>(3);
  const [questionMix, setQuestionMix] = useState({
    text: 25,
    multiple_choice: 35,
    true_false: 20,
    multiple_answer: 20,
  });
  const [generatedTemplates, setGeneratedTemplates] = useState<GeneratedTemplate[]>([]);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [editingQuestion, setEditingQuestion] = useState<{ templateId: string; questionId: string } | null>(null);
  const [generatedCategorySlug, setGeneratedCategorySlug] = useState<string>("");

  // Nuovi stati per configurazione avanzata
  const [languageMode, setLanguageMode] = useState<"course" | "specific" | "custom">("course");
  const [specificLanguage, setSpecificLanguage] = useState<string>("it");
  const [customSystemPrompt, setCustomSystemPrompt] = useState<string>("");
  const [writingStyle, setWritingStyle] = useState<string>("standard");
  const [customWritingStyle, setCustomWritingStyle] = useState<string>("");
  const [questionsMode, setQuestionsMode] = useState<"auto" | "fixed">("fixed");

  // Stati per progress pool
  const [lessonProgress, setLessonProgress] = useState<Record<string, { status: 'pending' | 'analyzing' | 'generating' | 'completed' | 'error'; questionsCount?: number; message?: string }>>({});
  const [currentLessonIndex, setCurrentLessonIndex] = useState<number>(0);

  const { data: lessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ["/api/library/courses", courseId, "documents"],
    queryFn: async () => {
      const response = await fetch(`/api/library/courses/${courseId}/documents`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch lessons");
      return response.json();
    },
  });

  const saveTemplatesMutation = useMutation({
    mutationFn: async (templates: GeneratedTemplate[]) => {
      const savedTemplates = [];
      for (let i = 0; i < templates.length; i++) {
        const template = templates[i];
        const categoryToUse = generatedCategorySlug || template.category || "ai_generated";
        const response = await fetch("/api/templates", {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: template.name,
            description: template.description,
            type: "general",
            category: categoryToUse,
            questions: template.questions,
            estimatedDuration: template.estimatedDuration,
            sortOrder: i + 1,
            isPublic: false,
            libraryDocumentId: template.lessonId,
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || `Failed to save template: ${template.name}`);
        }
        const saved = await response.json();
        savedTemplates.push(saved);
      }
      return savedTemplates;
    },
    onSuccess: (savedTemplates) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Esercizi salvati",
        description: `${savedTemplates.length} esercizi salvati con successo`,
      });
      onExercisesGenerated(savedTemplates);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio degli esercizi",
        variant: "destructive",
      });
    },
  });

  const availableLessons = lessons.filter((l: Lesson) => !l.hasExercise);

  const handleSelectAll = () => {
    setSelectedLessons(availableLessons.map((l: Lesson) => l.id));
  };

  const handleDeselectAll = () => {
    setSelectedLessons([]);
  };

  const handleLessonToggle = (lessonId: string) => {
    const lesson = lessons.find((l: Lesson) => l.id === lessonId);
    if (lesson?.hasExercise) return;
    
    setSelectedLessons((prev) =>
      prev.includes(lessonId)
        ? prev.filter((id) => id !== lessonId)
        : [...prev, lessonId]
    );
  };

  const handleMoveLessonUp = (lessonId: string) => {
    setSelectedLessons((prev) => {
      const index = prev.indexOf(lessonId);
      if (index <= 0) return prev;
      const newArr = [...prev];
      [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]];
      return newArr;
    });
  };

  const handleMoveLessonDown = (lessonId: string) => {
    setSelectedLessons((prev) => {
      const index = prev.indexOf(lessonId);
      if (index < 0 || index >= prev.length - 1) return prev;
      const newArr = [...prev];
      [newArr[index], newArr[index + 1]] = [newArr[index + 1], newArr[index]];
      return newArr;
    });
  };

  const handleMixChange = (type: keyof typeof questionMix, value: number) => {
    const currentTotal = Object.values(questionMix).reduce((sum, v) => sum + v, 0);
    const oldValue = questionMix[type];
    const diff = value - oldValue;
    
    if (currentTotal + diff > 100) {
      value = oldValue + (100 - currentTotal);
    }
    
    setQuestionMix((prev) => ({ ...prev, [type]: Math.max(0, Math.min(100, value)) }));
  };

  const normalizeMix = () => {
    const total = Object.values(questionMix).reduce((sum, v) => sum + v, 0);
    if (total !== 100 && total > 0) {
      const factor = 100 / total;
      const normalized = {
        text: Math.round(questionMix.text * factor),
        multiple_choice: Math.round(questionMix.multiple_choice * factor),
        true_false: Math.round(questionMix.true_false * factor),
        multiple_answer: Math.round(questionMix.multiple_answer * factor),
      };
      const newTotal = Object.values(normalized).reduce((sum, v) => sum + v, 0);
      normalized.multiple_choice += 100 - newTotal;
      setQuestionMix(normalized);
    }
  };

  const handleGenerate = async () => {
    if (selectedLessons.length === 0) {
      toast({
        title: "Seleziona lezioni",
        description: "Seleziona almeno una lezione per generare gli esercizi",
        variant: "destructive",
      });
      return;
    }

    normalizeMix();
    setPhase("generating");
    setGenerationProgress(0);
    setCurrentLessonIndex(0);
    setGeneratedTemplates([]);

    const initialProgress: Record<string, { status: 'pending' | 'analyzing' | 'generating' | 'completed' | 'error'; questionsCount?: number; message?: string }> = {};
    selectedLessons.forEach((lessonId) => {
      initialProgress[lessonId] = { status: 'pending' };
    });
    setLessonProgress(initialProgress);

    try {
      const response = await fetch(`/api/library/courses/${courseId}/generate-exercises-job`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lessonIds: selectedLessons,
          difficulty,
          questionsPerLesson,
          questionMix,
          languageMode,
          specificLanguage,
          customSystemPrompt,
          writingStyle,
          customWritingStyle,
          questionsMode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore durante la generazione degli esercizi");
      }

      const { jobId } = await response.json();
      
      const pollJob = async () => {
        try {
          const jobResponse = await fetch(`/api/exercise-generation-jobs/${jobId}`, {
            headers: getAuthHeaders(),
          });
          
          if (!jobResponse.ok) {
            throw new Error("Errore nel recupero dello stato del job");
          }
          
          const job = await jobResponse.json();
          
          setLessonProgress(job.progress);
          
          const completedCount = Object.values(job.progress)
            .filter((p: any) => p.status === 'completed').length;
          setGenerationProgress((completedCount / selectedLessons.length) * 100);
          
          if (job.status === 'completed') {
            const templates: GeneratedTemplate[] = job.templates || [];
            if (job.categorySlug) {
              setGeneratedCategorySlug(job.categorySlug);
            }
            setGeneratedTemplates(templates.map((t: any) => ({ ...t, isExpanded: false })));
            setGenerationProgress(100);
            setPhase("review");
            toast({
              title: "Esercizi generati",
              description: `${templates.length} esercizi generati con successo`,
            });
          } else if (job.status === 'error') {
            toast({
              title: "Errore",
              description: job.error || "Errore durante la generazione degli esercizi",
              variant: "destructive",
            });
            setPhase("selection");
          } else {
            setTimeout(pollJob, 1500);
          }
        } catch (pollError: any) {
          console.error("Polling error:", pollError);
          toast({
            title: "Errore",
            description: pollError.message || "Errore nel controllo dello stato",
            variant: "destructive",
          });
          setPhase("selection");
        }
      };
      
      setTimeout(pollJob, 1000);
      
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la generazione degli esercizi",
        variant: "destructive",
      });
      setPhase("selection");
    }
  };

  const handleToggleTemplateExpand = (templateId: string) => {
    setGeneratedTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId ? { ...t, isExpanded: !t.isExpanded } : t
      )
    );
  };

  const handleRemoveTemplate = (templateId: string) => {
    setGeneratedTemplates((prev) => prev.filter((t) => t.id !== templateId));
  };

  const handleEditQuestion = (templateId: string, questionId: string, newQuestion: string) => {
    setGeneratedTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId
          ? {
              ...t,
              questions: t.questions.map((q) =>
                q.id === questionId ? { ...q, question: newQuestion } : q
              ),
            }
          : t
      )
    );
  };

  const handleSaveAll = () => {
    if (generatedTemplates.length === 0) {
      toast({
        title: "Nessun esercizio",
        description: "Non ci sono esercizi da salvare",
        variant: "destructive",
      });
      return;
    }
    saveTemplatesMutation.mutate(generatedTemplates);
  };

  const mixTotal = Object.values(questionMix).reduce((sum, v) => sum + v, 0);

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case "open_ended":
      case "text":
        return "Risposta aperta";
      case "multiple_choice":
        return "Scelta multipla";
      case "true_false":
        return "Vero/Falso";
      case "multiple_answer":
        return "Risposta multipla";
      default:
        return type;
    }
  };

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case "open_ended":
      case "text":
        return <FileText size={14} className="text-blue-500" />;
      case "multiple_choice":
        return <CheckCircle2 size={14} className="text-green-500" />;
      case "true_false":
        return <HelpCircle size={14} className="text-yellow-500" />;
      case "multiple_answer":
        return <Check size={14} className="text-purple-500" />;
      default:
        return <FileText size={14} />;
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
              <Wand2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <span>Genera Esercizi con AI</span>
              <p className="text-sm font-normal text-muted-foreground mt-1">
                Corso: {courseName}
              </p>
            </div>
          </DialogTitle>
          <DialogDescription>
            {phase === "selection" && "Seleziona le lezioni e configura le opzioni di generazione"}
            {phase === "generating" && "Generazione degli esercizi in corso..."}
            {phase === "review" && "Rivedi e modifica gli esercizi generati prima di salvarli"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {phase === "selection" && (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
                {/* Summary Stats Header */}
                {!lessonsLoading && lessons.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="p-3 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-0 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <BookOpen size={16} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">{lessons.length}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Totale</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-0 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">{availableLessons.length}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Disponibili</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-0 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">{lessons.length - availableLessons.length}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Completate</p>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Lesson Selection */}
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen size={18} className="text-purple-600" />
                        <Label className="text-base font-semibold">Seleziona Lezioni</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleSelectAll}
                          disabled={availableLessons.length === 0}
                          className="text-xs h-7 hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/30"
                        >
                          <Check size={12} className="mr-1" />
                          Tutte
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleDeselectAll}
                          disabled={selectedLessons.length === 0}
                          className="text-xs h-7 hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                          <X size={12} className="mr-1" />
                          Nessuna
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    {lessonsLoading ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <Loader2 className="animate-spin text-purple-600" size={24} />
                        </div>
                        <span className="text-sm text-muted-foreground">Caricamento lezioni...</span>
                      </div>
                    ) : lessons.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <BookOpen className="text-muted-foreground" size={32} />
                        </div>
                        <p className="text-muted-foreground text-center">
                          Nessuna lezione trovata in questo corso
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {lessons
                          .sort((a: Lesson, b: Lesson) => (a.sortOrder || 0) - (b.sortOrder || 0))
                          .map((lesson: Lesson, index: number) => (
                            <div
                              key={lesson.id}
                              className={`group flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 ${
                                lesson.hasExercise
                                  ? "bg-slate-50 border-slate-200 cursor-not-allowed dark:bg-slate-900/50 dark:border-slate-800"
                                  : selectedLessons.includes(lesson.id)
                                  ? "bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300 shadow-sm dark:from-purple-900/20 dark:to-pink-900/20 dark:border-purple-700 cursor-pointer"
                                  : "bg-white border-transparent hover:border-purple-200 hover:bg-purple-50/50 dark:bg-slate-800/50 dark:hover:bg-slate-800 dark:hover:border-purple-800 cursor-pointer"
                              }`}
                              onClick={() => handleLessonToggle(lesson.id)}
                            >
                              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                                lesson.hasExercise
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                  : selectedLessons.includes(lesson.id)
                                  ? "bg-purple-600 text-white"
                                  : "bg-slate-100 text-slate-600 group-hover:bg-purple-100 group-hover:text-purple-600 dark:bg-slate-700 dark:text-slate-300"
                              }`}>
                                {lesson.hasExercise ? (
                                  <CheckCircle2 size={16} />
                                ) : selectedLessons.includes(lesson.id) ? (
                                  <Check size={16} />
                                ) : (
                                  lesson.sortOrder || index + 1
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${lesson.hasExercise ? "text-muted-foreground" : ""}`}>
                                  {lesson.title}
                                </p>
                                {lesson.hasExercise && (
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                                    Esercizio gia creato
                                  </p>
                                )}
                              </div>
                              {!lesson.hasExercise && lesson.level && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-2 py-0.5 ${
                                    lesson.level === "base"
                                      ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                                      : lesson.level === "intermedio"
                                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
                                      : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                                  }`}
                                >
                                  {lesson.level}
                                </Badge>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {lessons.length > 0 && (
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-t">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold text-purple-600 dark:text-purple-400">{selectedLessons.length}</span> di {availableLessons.length} selezionate
                        </p>
                        {selectedLessons.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                            {selectedLessons.length * questionsPerLesson} domande totali
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </Card>

                {/* Order Section - Ordine di generazione */}
                {selectedLessons.length >= 2 && (
                  <Card className="border-0 shadow-sm overflow-hidden">
                    <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b">
                      <div className="flex items-center gap-2">
                        <GripVertical size={18} className="text-indigo-600" />
                        <Label className="text-base font-semibold">Ordine di Generazione</Label>
                        <Badge variant="secondary" className="text-[10px] ml-auto">
                          {selectedLessons.length} lezioni
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Usa le frecce per definire l'ordine degli esercizi
                      </p>
                    </div>
                    <div className="p-3 space-y-2 max-h-40 overflow-y-auto">
                      {selectedLessons.map((lessonId, index) => {
                        const lesson = lessons.find((l: Lesson) => l.id === lessonId);
                        if (!lesson) return null;
                        return (
                          <div
                            key={lessonId}
                            className="flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/10 dark:to-purple-900/10 border border-indigo-200/50 dark:border-indigo-800/50"
                          >
                            <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {index + 1}
                            </div>
                            <span className="flex-1 text-sm font-medium truncate">{lesson.title}</span>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveLessonUp(lessonId)}
                                disabled={index === 0}
                                className="h-7 w-7 p-0 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                              >
                                <ArrowUp size={14} className={index === 0 ? "text-muted-foreground/30" : "text-indigo-600"} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMoveLessonDown(lessonId)}
                                disabled={index === selectedLessons.length - 1}
                                className="h-7 w-7 p-0 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                              >
                                <ArrowDown size={14} className={index === selectedLessons.length - 1 ? "text-muted-foreground/30" : "text-indigo-600"} />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* Configuration Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4 border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Sparkles size={14} className="text-amber-600 dark:text-amber-400" />
                      </div>
                      <Label className="text-sm font-semibold">Difficolta</Label>
                    </div>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectValue placeholder="Seleziona difficolta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="base">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            Base
                          </div>
                        </SelectItem>
                        <SelectItem value="intermedio">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            Intermedio
                          </div>
                        </SelectItem>
                        <SelectItem value="avanzato">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            Avanzato
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Card>

                  <Card className="p-4 border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <HelpCircle size={14} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <Label className="text-sm font-semibold">Domande per lezione</Label>
                    </div>
                    
                    {/* Toggle Automatico/Fisso */}
                    <div className="flex items-center gap-2 mb-3">
                      <Button
                        variant={questionsMode === "auto" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setQuestionsMode("auto")}
                        className={`flex-1 h-8 text-xs ${questionsMode === "auto" ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600" : ""}`}
                      >
                        <Zap size={12} className="mr-1" />
                        Automatico
                      </Button>
                      <Button
                        variant={questionsMode === "fixed" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setQuestionsMode("fixed")}
                        className={`flex-1 h-8 text-xs ${questionsMode === "fixed" ? "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600" : ""}`}
                      >
                        <Clock size={12} className="mr-1" />
                        Fisso
                      </Button>
                    </div>

                    {questionsMode === "auto" ? (
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2 mb-1">
                          <Zap size={14} className="text-amber-600 dark:text-amber-400" />
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">AI decide automaticamente</span>
                        </div>
                        <p className="text-[10px] text-amber-600 dark:text-amber-400">
                          L'AI analizzerà il contenuto di ogni lezione e determinerà il numero ottimale di domande (max 15 per lezione)
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setQuestionsPerLesson(Math.max(1, questionsPerLesson - 1))}
                          disabled={questionsPerLesson <= 1}
                          className="h-9 w-9 p-0"
                        >
                          -
                        </Button>
                        <div className="flex-1 text-center">
                          <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{questionsPerLesson}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setQuestionsPerLesson(Math.min(15, questionsPerLesson + 1))}
                          disabled={questionsPerLesson >= 15}
                          className="h-9 w-9 p-0"
                        >
                          +
                        </Button>
                      </div>
                    )}
                  </Card>
                </div>

                {/* Sezione Lingua */}
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                        <Globe size={14} className="text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <Label className="text-base font-semibold">Lingua delle Domande</Label>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div
                        onClick={() => setLanguageMode("course")}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          languageMode === "course"
                            ? "bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300 dark:from-cyan-900/20 dark:to-blue-900/20 dark:border-cyan-700"
                            : "bg-white border-transparent hover:border-cyan-200 dark:bg-slate-800/50 dark:hover:border-cyan-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            languageMode === "course" ? "border-cyan-500 bg-cyan-500" : "border-slate-300 dark:border-slate-600"
                          }`}>
                            {languageMode === "course" && <Check size={10} className="text-white" />}
                          </div>
                          <span className="text-sm font-medium">Lingua del corso</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 ml-6">Usa la lingua originale del corso</p>
                      </div>

                      <div
                        onClick={() => setLanguageMode("specific")}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          languageMode === "specific"
                            ? "bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300 dark:from-cyan-900/20 dark:to-blue-900/20 dark:border-cyan-700"
                            : "bg-white border-transparent hover:border-cyan-200 dark:bg-slate-800/50 dark:hover:border-cyan-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            languageMode === "specific" ? "border-cyan-500 bg-cyan-500" : "border-slate-300 dark:border-slate-600"
                          }`}>
                            {languageMode === "specific" && <Check size={10} className="text-white" />}
                          </div>
                          <span className="text-sm font-medium">Lingua specifica</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 ml-6">Scegli una lingua</p>
                      </div>

                      <div
                        onClick={() => setLanguageMode("custom")}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          languageMode === "custom"
                            ? "bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300 dark:from-cyan-900/20 dark:to-blue-900/20 dark:border-cyan-700"
                            : "bg-white border-transparent hover:border-cyan-200 dark:bg-slate-800/50 dark:hover:border-cyan-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            languageMode === "custom" ? "border-cyan-500 bg-cyan-500" : "border-slate-300 dark:border-slate-600"
                          }`}>
                            {languageMode === "custom" && <Check size={10} className="text-white" />}
                          </div>
                          <span className="text-sm font-medium">Prompt personalizzato</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 ml-6">Istruzioni custom</p>
                      </div>
                    </div>

                    {languageMode === "specific" && (
                      <Select value={specificLanguage} onValueChange={setSpecificLanguage}>
                        <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                          <SelectValue placeholder="Seleziona lingua" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="it">
                            <div className="flex items-center gap-2">🇮🇹 Italiano</div>
                          </SelectItem>
                          <SelectItem value="en">
                            <div className="flex items-center gap-2">🇬🇧 English</div>
                          </SelectItem>
                          <SelectItem value="es">
                            <div className="flex items-center gap-2">🇪🇸 Español</div>
                          </SelectItem>
                          <SelectItem value="fr">
                            <div className="flex items-center gap-2">🇫🇷 Français</div>
                          </SelectItem>
                          <SelectItem value="de">
                            <div className="flex items-center gap-2">🇩🇪 Deutsch</div>
                          </SelectItem>
                          <SelectItem value="pt">
                            <div className="flex items-center gap-2">🇵🇹 Português</div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {languageMode === "custom" && (
                      <Textarea
                        value={customSystemPrompt}
                        onChange={(e) => setCustomSystemPrompt(e.target.value)}
                        placeholder="Inserisci le istruzioni personalizzate per la generazione delle domande (es. 'Genera le domande in italiano formale, usando terminologia tecnica del settore finanziario...')"
                        className="min-h-[80px] text-sm"
                      />
                    )}
                  </div>
                </Card>

                {/* Sezione Stile di Scrittura */}
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <BookOpen size={14} className="text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <Label className="text-base font-semibold">Stile di Scrittura</Label>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {/* Elementare */}
                      <div
                        onClick={() => setWritingStyle("elementary")}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${
                          writingStyle === "elementary"
                            ? "bg-gradient-to-br from-pink-50 to-rose-50 border-pink-300 dark:from-pink-900/20 dark:to-rose-900/20 dark:border-pink-700"
                            : "bg-white border-transparent hover:border-pink-200 dark:bg-slate-800/50 dark:hover:border-pink-800"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center ${
                          writingStyle === "elementary" ? "bg-pink-500" : "bg-pink-100 dark:bg-pink-900/30"
                        }`}>
                          <Baby size={20} className={writingStyle === "elementary" ? "text-white" : "text-pink-600 dark:text-pink-400"} />
                        </div>
                        <span className="text-xs font-semibold">Elementare</span>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Linguaggio semplice</p>
                      </div>

                      {/* Standard */}
                      <div
                        onClick={() => setWritingStyle("standard")}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${
                          writingStyle === "standard"
                            ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-700"
                            : "bg-white border-transparent hover:border-blue-200 dark:bg-slate-800/50 dark:hover:border-blue-800"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center ${
                          writingStyle === "standard" ? "bg-blue-500" : "bg-blue-100 dark:bg-blue-900/30"
                        }`}>
                          <BookOpen size={20} className={writingStyle === "standard" ? "text-white" : "text-blue-600 dark:text-blue-400"} />
                        </div>
                        <span className="text-xs font-semibold">Standard</span>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Bilanciato</p>
                      </div>

                      {/* Professionale */}
                      <div
                        onClick={() => setWritingStyle("professional")}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${
                          writingStyle === "professional"
                            ? "bg-gradient-to-br from-slate-100 to-gray-100 border-slate-400 dark:from-slate-800 dark:to-gray-800 dark:border-slate-600"
                            : "bg-white border-transparent hover:border-slate-300 dark:bg-slate-800/50 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center ${
                          writingStyle === "professional" ? "bg-slate-600" : "bg-slate-100 dark:bg-slate-700"
                        }`}>
                          <Briefcase size={20} className={writingStyle === "professional" ? "text-white" : "text-slate-600 dark:text-slate-400"} />
                        </div>
                        <span className="text-xs font-semibold">Professionale</span>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Tono formale</p>
                      </div>

                      {/* Accademico */}
                      <div
                        onClick={() => setWritingStyle("academic")}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${
                          writingStyle === "academic"
                            ? "bg-gradient-to-br from-violet-50 to-purple-50 border-violet-300 dark:from-violet-900/20 dark:to-purple-900/20 dark:border-violet-700"
                            : "bg-white border-transparent hover:border-violet-200 dark:bg-slate-800/50 dark:hover:border-violet-800"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center ${
                          writingStyle === "academic" ? "bg-violet-500" : "bg-violet-100 dark:bg-violet-900/30"
                        }`}>
                          <GraduationCap size={20} className={writingStyle === "academic" ? "text-white" : "text-violet-600 dark:text-violet-400"} />
                        </div>
                        <span className="text-xs font-semibold">Accademico</span>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Universitario</p>
                      </div>

                      {/* Personalizzato */}
                      <div
                        onClick={() => setWritingStyle("custom")}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${
                          writingStyle === "custom"
                            ? "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-300 dark:from-emerald-900/20 dark:to-teal-900/20 dark:border-emerald-700"
                            : "bg-white border-transparent hover:border-emerald-200 dark:bg-slate-800/50 dark:hover:border-emerald-800"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center ${
                          writingStyle === "custom" ? "bg-emerald-500" : "bg-emerald-100 dark:bg-emerald-900/30"
                        }`}>
                          <MessageSquare size={20} className={writingStyle === "custom" ? "text-white" : "text-emerald-600 dark:text-emerald-400"} />
                        </div>
                        <span className="text-xs font-semibold">Personalizzato</span>
                        <p className="text-[9px] text-muted-foreground mt-0.5">Custom</p>
                      </div>
                    </div>

                    {writingStyle === "custom" && (
                      <Textarea
                        value={customWritingStyle}
                        onChange={(e) => setCustomWritingStyle(e.target.value)}
                        placeholder="Descrivi lo stile di scrittura desiderato (es. 'Usa un tono amichevole ma professionale, con esempi pratici del mondo reale...')"
                        className="min-h-[80px] text-sm mt-3"
                      />
                    )}
                  </div>
                </Card>

                {/* Question Mix Section */}
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <FileText size={14} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <Label className="text-base font-semibold">Mix Tipologie Domande</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={mixTotal === 100 ? "secondary" : "destructive"}
                          className={`text-xs ${mixTotal === 100 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : ""}`}
                        >
                          {mixTotal === 100 ? <CheckCircle2 size={12} className="mr-1" /> : <XCircle size={12} className="mr-1" />}
                          {mixTotal}%
                        </Badge>
                        {mixTotal !== 100 && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={normalizeMix}>
                            Bilancia
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 grid grid-cols-2 gap-3">
                    {/* Risposta aperta */}
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center">
                          <FileText size={12} className="text-white" />
                        </div>
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Risposta aperta</span>
                        <span className="ml-auto text-sm font-bold text-blue-600 dark:text-blue-400">{questionMix.text}%</span>
                      </div>
                      <Slider
                        value={[questionMix.text]}
                        onValueChange={([v]) => handleMixChange("text", v)}
                        max={100}
                        step={5}
                        className="w-full [&_[role=slider]]:bg-blue-500 [&_[role=slider]]:border-blue-600"
                      />
                    </div>

                    {/* Scelta multipla */}
                    <div className="p-3 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-green-500 flex items-center justify-center">
                          <CheckCircle2 size={12} className="text-white" />
                        </div>
                        <span className="text-xs font-semibold text-green-700 dark:text-green-300">Scelta multipla</span>
                        <span className="ml-auto text-sm font-bold text-green-600 dark:text-green-400">{questionMix.multiple_choice}%</span>
                      </div>
                      <Slider
                        value={[questionMix.multiple_choice]}
                        onValueChange={([v]) => handleMixChange("multiple_choice", v)}
                        max={100}
                        step={5}
                        className="w-full [&_[role=slider]]:bg-green-500 [&_[role=slider]]:border-green-600"
                      />
                    </div>

                    {/* Vero/Falso */}
                    <div className="p-3 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center">
                          <HelpCircle size={12} className="text-white" />
                        </div>
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Vero/Falso</span>
                        <span className="ml-auto text-sm font-bold text-amber-600 dark:text-amber-400">{questionMix.true_false}%</span>
                      </div>
                      <Slider
                        value={[questionMix.true_false]}
                        onValueChange={([v]) => handleMixChange("true_false", v)}
                        max={100}
                        step={5}
                        className="w-full [&_[role=slider]]:bg-amber-500 [&_[role=slider]]:border-amber-600"
                      />
                    </div>

                    {/* Risposta multipla */}
                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-purple-500 flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">Risposta multipla</span>
                        <span className="ml-auto text-sm font-bold text-purple-600 dark:text-purple-400">{questionMix.multiple_answer}%</span>
                      </div>
                      <Slider
                        value={[questionMix.multiple_answer]}
                        onValueChange={([v]) => handleMixChange("multiple_answer", v)}
                        max={100}
                        step={5}
                        className="w-full [&_[role=slider]]:bg-purple-500 [&_[role=slider]]:border-purple-600"
                      />
                    </div>
                  </div>
                </Card>
              </div>
            </ScrollArea>
          )}

          {phase === "generating" && (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">Generazione Esercizi</h3>
                    <p className="text-xs text-muted-foreground">
                      L'AI sta analizzando le lezioni e generando le domande
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedLessons.map((lessonId) => {
                    const lesson = lessons.find((l: Lesson) => l.id === lessonId);
                    const progress = lessonProgress[lessonId] || { status: 'pending' };
                    
                    const getStatusConfig = () => {
                      switch (progress.status) {
                        case 'pending':
                          return {
                            icon: <Clock size={16} className="text-slate-400" />,
                            text: "In attesa...",
                            bgColor: "bg-slate-50 dark:bg-slate-800/50",
                            borderColor: "border-slate-200 dark:border-slate-700",
                            progressColor: "bg-slate-200",
                            progressValue: 0,
                          };
                        case 'analyzing':
                          return {
                            icon: <Search size={16} className="text-blue-500 animate-pulse" />,
                            text: "Analisi contenuto...",
                            bgColor: "bg-blue-50 dark:bg-blue-900/20",
                            borderColor: "border-blue-300 dark:border-blue-700",
                            progressColor: "bg-blue-500",
                            progressValue: 30,
                          };
                        case 'generating':
                          return {
                            icon: <Sparkles size={16} className="text-purple-500 animate-pulse" />,
                            text: "Generazione esercizi...",
                            bgColor: "bg-purple-50 dark:bg-purple-900/20",
                            borderColor: "border-purple-300 dark:border-purple-700",
                            progressColor: "bg-purple-500",
                            progressValue: 70,
                          };
                        case 'completed':
                          return {
                            icon: <CheckCircle2 size={16} className="text-emerald-500" />,
                            text: `${progress.questionsCount || 0} domande create`,
                            bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
                            borderColor: "border-emerald-300 dark:border-emerald-700",
                            progressColor: "bg-emerald-500",
                            progressValue: 100,
                          };
                        case 'error':
                          return {
                            icon: <XCircle size={16} className="text-red-500" />,
                            text: progress.message || "Errore",
                            bgColor: "bg-red-50 dark:bg-red-900/20",
                            borderColor: "border-red-300 dark:border-red-700",
                            progressColor: "bg-red-500",
                            progressValue: 100,
                          };
                        default:
                          return {
                            icon: <Clock size={16} className="text-slate-400" />,
                            text: "In attesa...",
                            bgColor: "bg-slate-50 dark:bg-slate-800/50",
                            borderColor: "border-slate-200 dark:border-slate-700",
                            progressColor: "bg-slate-200",
                            progressValue: 0,
                          };
                      }
                    };

                    const config = getStatusConfig();

                    return (
                      <Card 
                        key={lessonId} 
                        className={`p-3 border-2 transition-all duration-300 ${config.bgColor} ${config.borderColor}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center">
                            {config.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {lesson?.title || `Lezione ${lessonId}`}
                            </p>
                            <p className="text-xs text-muted-foreground">{config.text}</p>
                          </div>
                          {progress.status !== 'pending' && progress.status !== 'completed' && progress.status !== 'error' && (
                            <Loader2 size={16} className="animate-spin text-purple-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="mt-2">
                          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 rounded-full ${config.progressColor}`}
                              style={{ width: `${config.progressValue}%` }}
                            />
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                <Card className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-0 shadow-sm mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">
                            {Object.values(lessonProgress).filter((p) => p.status === 'completed').length}/{selectedLessons.length}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lezioni completate</p>
                        </div>
                      </div>
                      <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <HelpCircle size={16} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <p className="text-lg font-bold">
                            {Object.values(lessonProgress).reduce((sum, p) => sum + (p.questionsCount || 0), 0)}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Domande generate</p>
                        </div>
                      </div>
                    </div>
                    <div className="w-32">
                      <Progress value={generationProgress} className="h-2" />
                      <p className="text-xs text-muted-foreground text-center mt-1">
                        {Math.round(generationProgress)}%
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </ScrollArea>
          )}

          {phase === "review" && (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-4">
                {generatedTemplates.length === 0 ? (
                  <Card className="p-6 text-center">
                    <XCircle className="mx-auto text-muted-foreground mb-2" size={32} />
                    <p className="text-muted-foreground">
                      Nessun esercizio generato. Torna indietro e riprova.
                    </p>
                  </Card>
                ) : (
                  generatedTemplates.map((template) => (
                    <Card key={template.id} className="overflow-hidden">
                      <Collapsible
                        open={template.isExpanded}
                        onOpenChange={() => handleToggleTemplateExpand(template.id)}
                      >
                        <CardHeader className="py-3 px-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="p-1 h-auto">
                                  {template.isExpanded ? (
                                    <ChevronDown size={16} />
                                  ) : (
                                    <ChevronRight size={16} />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-sm font-semibold truncate">
                                  {template.name}
                                </CardTitle>
                                <p className="text-xs text-muted-foreground truncate">
                                  {template.lessonTitle}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge variant="secondary" className="text-xs">
                                {template.questions.length} domande
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  template.difficulty === "base"
                                    ? "bg-green-50 text-green-700"
                                    : template.difficulty === "intermedio"
                                    ? "bg-yellow-50 text-yellow-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                {template.difficulty}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveTemplate(template.id)}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>

                        <CollapsibleContent>
                          <CardContent className="py-3 px-4 space-y-3">
                            <p className="text-sm text-muted-foreground">
                              {template.description}
                            </p>
                            <div className="space-y-2">
                              {template.questions.map((question, qIndex) => (
                                <div
                                  key={question.id}
                                  className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-2"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2 flex-1 min-w-0">
                                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                                        {qIndex + 1}
                                      </Badge>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {getQuestionTypeIcon(question.type)}
                                        <span className="text-xs text-muted-foreground">
                                          {getQuestionTypeLabel(question.type)}
                                        </span>
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() =>
                                        setEditingQuestion(
                                          editingQuestion?.templateId === template.id &&
                                            editingQuestion?.questionId === question.id
                                            ? null
                                            : { templateId: template.id, questionId: question.id }
                                        )
                                      }
                                    >
                                      <Edit3 size={14} />
                                    </Button>
                                  </div>

                                  {editingQuestion?.templateId === template.id &&
                                  editingQuestion?.questionId === question.id ? (
                                    <div className="space-y-2">
                                      <Textarea
                                        value={question.question}
                                        onChange={(e) =>
                                          handleEditQuestion(
                                            template.id,
                                            question.id,
                                            e.target.value
                                          )
                                        }
                                        className="text-sm"
                                        rows={2}
                                      />
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingQuestion(null)}
                                      >
                                        <Check size={14} className="mr-1" />
                                        Fatto
                                      </Button>
                                    </div>
                                  ) : (
                                    <p className="text-sm">{question.question}</p>
                                  )}

                                  {question.options && question.options.length > 0 && (
                                    <div className="pl-4 space-y-1">
                                      {question.options.map((option, oIndex) => {
                                        const isCorrect = question.correctAnswers?.includes(option);
                                        return (
                                          <div
                                            key={oIndex}
                                            className={`text-xs flex items-center gap-2 ${
                                              isCorrect
                                                ? "text-green-600 font-medium"
                                                : "text-muted-foreground"
                                            }`}
                                          >
                                            <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[10px]">
                                              {String.fromCharCode(65 + oIndex)}
                                            </span>
                                            {option}
                                            {isCorrect && (
                                              <CheckCircle2 size={12} className="text-green-500" />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {question.type === "true_false" && question.correctAnswers && question.correctAnswers.length > 0 && (
                                    <div className="pl-4 text-xs text-muted-foreground">
                                      Risposta corretta:{" "}
                                      <span className="font-medium text-green-600">
                                        {question.correctAnswers[0]}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="border-t pt-4 flex flex-col sm:flex-row gap-3">
          {phase === "selection" && (
            <>
              <Button variant="outline" onClick={onClose}>
                Annulla
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={selectedLessons.length === 0 || mixTotal !== 100}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Sparkles size={16} className="mr-2" />
                Genera Esercizi ({selectedLessons.length} lezioni)
              </Button>
            </>
          )}

          {phase === "generating" && (
            <Button variant="outline" onClick={() => setPhase("selection")} disabled>
              <Loader2 className="animate-spin mr-2" size={16} />
              Generazione in corso...
            </Button>
          )}

          {phase === "review" && (
            <>
              <Button variant="outline" onClick={() => setPhase("selection")}>
                Modifica Selezione
              </Button>
              <Button variant="outline" onClick={onClose}>
                Annulla
              </Button>
              <Button
                onClick={handleSaveAll}
                disabled={generatedTemplates.length === 0 || saveTemplatesMutation.isPending}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {saveTemplatesMutation.isPending ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Save size={16} className="mr-2" />
                    Salva Tutti ({generatedTemplates.length})
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
