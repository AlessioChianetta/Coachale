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
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  HelpCircle,
  Check,
  X,
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

  const generateMutation = useMutation({
    mutationFn: async (params: {
      lessonIds: string[];
      difficulty: string;
      questionsPerLesson: number;
      questionMix: typeof questionMix;
    }) => {
      const response = await fetch(`/api/library/courses/${courseId}/generate-exercises`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to generate exercises");
      }
      return response.json();
    },
    onSuccess: (data) => {
      const templates: GeneratedTemplate[] = data.templates || data;
      if (data.categorySlug) {
        setGeneratedCategorySlug(data.categorySlug);
      }
      setGeneratedTemplates(templates.map((t: any) => ({ ...t, isExpanded: false })));
      setPhase("review");
      toast({
        title: "Esercizi generati",
        description: `${templates.length} esercizi generati con successo`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la generazione degli esercizi",
        variant: "destructive",
      });
      setPhase("selection");
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

  const handleSelectAll = () => {
    setSelectedLessons(lessons.map((l: Lesson) => l.id));
  };

  const handleDeselectAll = () => {
    setSelectedLessons([]);
  };

  const handleLessonToggle = (lessonId: string) => {
    setSelectedLessons((prev) =>
      prev.includes(lessonId)
        ? prev.filter((id) => id !== lessonId)
        : [...prev, lessonId]
    );
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

  const handleGenerate = () => {
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

    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 500);

    generateMutation.mutate(
      {
        lessonIds: selectedLessons,
        difficulty,
        questionsPerLesson,
        questionMix,
      },
      {
        onSettled: () => {
          clearInterval(progressInterval);
          setGenerationProgress(100);
        },
      }
    );
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Seleziona Lezioni</Label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleSelectAll}>
                        Seleziona tutte
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                        Deseleziona tutte
                      </Button>
                    </div>
                  </div>

                  {lessonsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="animate-spin mr-2" />
                      <span>Caricamento lezioni...</span>
                    </div>
                  ) : lessons.length === 0 ? (
                    <Card className="p-6 text-center">
                      <BookOpen className="mx-auto text-muted-foreground mb-2" size={32} />
                      <p className="text-muted-foreground">
                        Nessuna lezione trovata in questo corso
                      </p>
                    </Card>
                  ) : (
                    <div className="grid gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                      {lessons
                        .sort((a: Lesson, b: Lesson) => (a.sortOrder || 0) - (b.sortOrder || 0))
                        .map((lesson: Lesson) => (
                          <div
                            key={lesson.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                              selectedLessons.includes(lesson.id)
                                ? "bg-purple-50 border-purple-300 dark:bg-purple-900/20 dark:border-purple-700"
                                : "bg-white hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700"
                            }`}
                            onClick={() => handleLessonToggle(lesson.id)}
                          >
                            <Checkbox
                              checked={selectedLessons.includes(lesson.id)}
                              onCheckedChange={() => handleLessonToggle(lesson.id)}
                            />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Badge variant="secondary" className="text-xs flex-shrink-0">
                                {lesson.sortOrder || "-"}
                              </Badge>
                              <span className="text-sm font-medium truncate">
                                {lesson.title}
                              </span>
                            </div>
                            {lesson.level && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  lesson.level === "base"
                                    ? "bg-green-50 text-green-700"
                                    : lesson.level === "intermedio"
                                    ? "bg-yellow-50 text-yellow-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                {lesson.level}
                              </Badge>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {selectedLessons.length} di {lessons.length} lezioni selezionate
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Difficoltà</Label>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona difficoltà" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="base">🟢 Base</SelectItem>
                        <SelectItem value="intermedio">🟡 Intermedio</SelectItem>
                        <SelectItem value="avanzato">🔴 Avanzato</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Domande per lezione</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={questionsPerLesson}
                        onChange={(e) =>
                          setQuestionsPerLesson(
                            Math.max(1, Math.min(10, parseInt(e.target.value) || 1))
                          )
                        }
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">
                        (min: 1, max: 10)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Mix Tipologie Domande</Label>
                    <Badge
                      variant={mixTotal === 100 ? "default" : "destructive"}
                      className="text-xs"
                    >
                      Totale: {mixTotal}%
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Risposta aperta</span>
                        <span className="font-medium">{questionMix.text}%</span>
                      </div>
                      <Slider
                        value={[questionMix.text]}
                        onValueChange={([v]) => handleMixChange("text", v)}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Scelta multipla</span>
                        <span className="font-medium">{questionMix.multiple_choice}%</span>
                      </div>
                      <Slider
                        value={[questionMix.multiple_choice]}
                        onValueChange={([v]) => handleMixChange("multiple_choice", v)}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Vero/Falso</span>
                        <span className="font-medium">{questionMix.true_false}%</span>
                      </div>
                      <Slider
                        value={[questionMix.true_false]}
                        onValueChange={([v]) => handleMixChange("true_false", v)}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Risposta multipla</span>
                        <span className="font-medium">{questionMix.multiple_answer}%</span>
                      </div>
                      <Slider
                        value={[questionMix.multiple_answer]}
                        onValueChange={([v]) => handleMixChange("multiple_answer", v)}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {mixTotal !== 100 && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                      <XCircle size={16} />
                      <span>La somma delle percentuali deve essere 100%</span>
                      <Button variant="link" size="sm" className="h-auto p-0" onClick={normalizeMix}>
                        Normalizza
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}

          {phase === "generating" && (
            <div className="flex flex-col items-center justify-center py-16 space-y-6">
              <div className="relative">
                <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center animate-pulse">
                  <Sparkles className="h-12 w-12 text-white" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Generazione in corso...</h3>
                <p className="text-muted-foreground">
                  L'AI sta creando {selectedLessons.length * questionsPerLesson} domande per{" "}
                  {selectedLessons.length} lezioni
                </p>
              </div>
              <div className="w-64 space-y-2">
                <Progress value={generationProgress} className="h-2" />
                <p className="text-center text-sm text-muted-foreground">
                  {Math.round(generationProgress)}%
                </p>
              </div>
            </div>
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
