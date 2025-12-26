import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper, Step } from "@/components/ui/stepper";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";
import {
  Loader2,
  Sparkles,
  BookOpen,
  Brain,
  FileText,
  Users,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Layers,
  Calendar,
} from "lucide-react";

export interface AIPathwayWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (templateId: string) => void;
}

interface Course {
  id: string;
  name: string;
  description: string;
  lessonCount: number;
  exerciseCount?: number;
}

interface AIAnalysis {
  courseId: string;
  courseName: string;
  suggestedTrimester: "Q1" | "Q2" | "Q3" | "Q4";
  reasoning: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface TrimesterAssignment {
  courseId: string;
  courseName: string;
  trimester: "Q1" | "Q2" | "Q3" | "Q4";
  reasoning: string;
}

interface DuplicateTemplate {
  templateId: string;
  templateName: string;
  matchingCourses: string[];
  totalCoursesInTemplate: number;
}

const steps: Step[] = [
  {
    id: "courses",
    label: "Selezione Corsi",
    description: "Scegli i corsi",
  },
  {
    id: "analysis",
    label: "Analisi AI",
    description: "Assegnazione trimestri",
  },
  {
    id: "details",
    label: "Dettagli Percorso",
    description: "Nome e descrizione",
  },
  {
    id: "assignment",
    label: "Assegnazione",
    description: "Clienti (opzionale)",
  },
];

const trimesterOptions = [
  { value: "Q1", label: "Trimestre 1 (Q1)" },
  { value: "Q2", label: "Trimestre 2 (Q2)" },
  { value: "Q3", label: "Trimestre 3 (Q3)" },
  { value: "Q4", label: "Trimestre 4 (Q4)" },
];

export function AIPathwayWizard({ open, onOpenChange, onComplete }: AIPathwayWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<TrimesterAssignment[]>([]);
  const [pathwayName, setPathwayName] = useState("");
  const [pathwayDescription, setPathwayDescription] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [createdTemplateId, setCreatedTemplateId] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [duplicateTemplates, setDuplicateTemplates] = useState<DuplicateTemplate[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setSelectedCourseIds([]);
      setAssignments([]);
      setPathwayName("");
      setPathwayDescription("");
      setSelectedClientIds([]);
      setCreatedTemplateId(null);
      setIsComplete(false);
      setDuplicateTemplates([]);
      setShowDuplicateWarning(false);
      setIsCheckingDuplicates(false);
    }
  }, [open]);

  const { data: courses = [], isLoading: coursesLoading } = useQuery<Course[]>({
    queryKey: ["/api/university/ai/courses"],
    queryFn: async () => {
      const response = await fetch("/api/university/ai/courses", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Errore nel caricamento dei corsi");
      return response.json();
    },
    enabled: open,
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Errore nel caricamento dei clienti");
      return response.json();
    },
    enabled: open && currentStep === 3,
  });

  const analyzeMutation = useMutation({
    mutationFn: async (courseIds: string[]) => {
      return await apiRequest("POST", "/api/university/ai/analyze", { courseIds });
    },
    onSuccess: (data: { success: boolean; assignments: AIAnalysis[] }) => {
      if (!data.assignments || !Array.isArray(data.assignments)) {
        toast({
          title: "Errore analisi",
          description: "L'AI non ha restituito suggerimenti validi",
          variant: "destructive",
        });
        return;
      }
      const newAssignments: TrimesterAssignment[] = data.assignments.map((analysis) => ({
        courseId: analysis.courseId,
        courseName: analysis.courseName,
        trimester: analysis.suggestedTrimester,
        reasoning: analysis.reasoning,
      }));
      setAssignments(newAssignments);
      toast({
        title: "Analisi completata",
        description: `L'AI ha analizzato ${data.assignments.length} corsi e suggerito l'organizzazione ottimale`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore nell'analisi",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: pathwayName,
        description: pathwayDescription,
        assignments: assignments.map((a) => ({
          courseId: a.courseId,
          trimester: a.trimester,
        })),
      };
      return await apiRequest("POST", "/api/university/ai/generate", payload);
    },
    onSuccess: (data: { templateId: string }) => {
      setCreatedTemplateId(data.templateId);
      toast({
        title: "Template creato",
        description: "Il percorso formativo è stato creato con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/university/templates"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore nella creazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const instantiateMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        templateId: createdTemplateId,
        clientIds: selectedClientIds,
      };
      return await apiRequest("POST", "/api/university/ai/instantiate", payload);
    },
    onSuccess: () => {
      setIsComplete(true);
      toast({
        title: "Assegnazione completata",
        description: `Il percorso è stato assegnato a ${selectedClientIds.length} cliente/i`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/university"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore nell'assegnazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCourseToggle = (courseId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleClientToggle = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleTrimesterChange = (courseId: string, newTrimester: "Q1" | "Q2" | "Q3" | "Q4") => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.courseId === courseId ? { ...a, trimester: newTrimester } : a
      )
    );
  };

  const handleAnalyze = async () => {
    if (selectedCourseIds.length === 0) {
      toast({
        title: "Nessun corso selezionato",
        description: "Seleziona almeno un corso per procedere",
        variant: "destructive",
      });
      return;
    }
    
    setIsCheckingDuplicates(true);
    
    try {
      const duplicateCheck = await apiRequest("POST", "/api/university/ai/check-duplicates", { 
        courseIds: selectedCourseIds 
      }) as { hasDuplicate: boolean; duplicateTemplates: DuplicateTemplate[] };
      
      if (duplicateCheck.hasDuplicate && duplicateCheck.duplicateTemplates.length > 0) {
        setDuplicateTemplates(duplicateCheck.duplicateTemplates);
        setShowDuplicateWarning(true);
        setIsCheckingDuplicates(false);
        return;
      }
    } catch (error) {
      console.error("Error checking duplicates:", error);
    }
    
    setIsCheckingDuplicates(false);
    await analyzeMutation.mutateAsync(selectedCourseIds);
    setCurrentStep(1);
  };
  
  const handleContinueAnyway = async () => {
    setShowDuplicateWarning(false);
    setDuplicateTemplates([]);
    await analyzeMutation.mutateAsync(selectedCourseIds);
    setCurrentStep(1);
  };

  const handleGeneratePathway = async () => {
    if (!pathwayName.trim()) {
      toast({
        title: "Nome mancante",
        description: "Inserisci un nome per il percorso formativo",
        variant: "destructive",
      });
      return;
    }
    await generateMutation.mutateAsync();
    setCurrentStep(3);
  };

  const handleSkip = () => {
    setIsComplete(true);
    if (createdTemplateId && onComplete) {
      onComplete(createdTemplateId);
    }
    onOpenChange(false);
  };

  const handleAssignAndCreate = async () => {
    if (selectedClientIds.length === 0) {
      toast({
        title: "Nessun cliente selezionato",
        description: "Seleziona almeno un cliente o usa 'Salta'",
        variant: "destructive",
      });
      return;
    }
    await instantiateMutation.mutateAsync();
  };

  const handleComplete = () => {
    if (createdTemplateId && onComplete) {
      onComplete(createdTemplateId);
    }
    onOpenChange(false);
  };

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex < currentStep) {
      setCurrentStep(stepIndex);
    }
  };

  const getGroupedAssignments = () => {
    const grouped: Record<string, TrimesterAssignment[]> = {
      Q1: [],
      Q2: [],
      Q3: [],
      Q4: [],
    };
    assignments.forEach((a) => {
      grouped[a.trimester].push(a);
    });
    return grouped;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <BookOpen className="h-5 w-5" />
              <span>Seleziona i corsi da includere nel percorso formativo</span>
            </div>

            {showDuplicateWarning && duplicateTemplates.length > 0 && (
              <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1 space-y-2">
                      <h4 className="font-semibold text-yellow-800 dark:text-yellow-400">
                        Template simili esistenti
                      </h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Esistono già template con corsi simili a quelli selezionati:
                      </p>
                      <ul className="text-sm list-disc list-inside text-yellow-700 dark:text-yellow-300">
                        {duplicateTemplates.map((dt) => (
                          <li key={dt.templateId}>
                            <strong>"{dt.templateName}"</strong> ({dt.matchingCourses.length} corsi in comune)
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowDuplicateWarning(false);
                            setDuplicateTemplates([]);
                          }}
                        >
                          Cambia selezione
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleContinueAnyway}
                          disabled={analyzeMutation.isPending}
                        >
                          {analyzeMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              Analisi...
                            </>
                          ) : (
                            "Continua comunque"
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {coursesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : courses.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    Nessun corso disponibile. Crea prima alcuni corsi nella libreria.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {courses.map((course) => (
                    <Card
                      key={course.id}
                      className={`cursor-pointer transition-all ${
                        selectedCourseIds.includes(course.id)
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => handleCourseToggle(course.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <Checkbox
                            checked={selectedCourseIds.includes(course.id)}
                            onCheckedChange={() => handleCourseToggle(course.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-semibold">{course.name}</h4>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Badge variant="secondary">
                                  {course.lessonCount} lezioni
                                </Badge>
                                {course.exerciseCount !== undefined && course.exerciseCount > 0 && (
                                  <Badge variant="outline" className="text-purple-600 border-purple-300 dark:text-purple-400 dark:border-purple-700">
                                    {course.exerciseCount} esercizi
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {course.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {course.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {selectedCourseIds.length} corso/i selezionato/i
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={selectedCourseIds.length === 0 || analyzeMutation.isPending || isCheckingDuplicates}
                className="gap-2"
              >
                {isCheckingDuplicates ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifica duplicati...
                  </>
                ) : analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analisi in corso...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analizza con AI
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <Brain className="h-5 w-5" />
              <span>L'AI ha analizzato i corsi e suggerito l'organizzazione ottimale</span>
            </div>

            {analyzeMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">L'AI sta analizzando i corsi...</p>
              </div>
            ) : (
              <>
                <ScrollArea className="h-[350px] pr-4">
                  <div className="space-y-4">
                    {assignments.map((assignment) => (
                      <Card key={assignment.courseId} className="border-l-4 border-l-primary">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h4 className="font-semibold">{assignment.courseName}</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                <span className="font-medium">Motivazione AI:</span>{" "}
                                {assignment.reasoning}
                              </p>
                            </div>
                            <Select
                              value={assignment.trimester}
                              onValueChange={(value) =>
                                handleTrimesterChange(
                                  assignment.courseId,
                                  value as "Q1" | "Q2" | "Q3" | "Q4"
                                )
                              }
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {trimesterOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex justify-between items-center pt-4 border-t">
                  <Button variant="outline" onClick={() => setCurrentStep(0)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Indietro
                  </Button>
                  <Button onClick={() => setCurrentStep(2)} className="gap-2">
                    Genera Percorso
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        );

      case 2:
        const groupedAssignments = getGroupedAssignments();
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <FileText className="h-5 w-5" />
              <span>Inserisci i dettagli del percorso formativo</span>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="pathwayName">Nome del Percorso *</Label>
                <Input
                  id="pathwayName"
                  value={pathwayName}
                  onChange={(e) => setPathwayName(e.target.value)}
                  placeholder="Es. Percorso Avanzato di Vendita"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pathwayDescription">Descrizione</Label>
                <Textarea
                  id="pathwayDescription"
                  value={pathwayDescription}
                  onChange={(e) => setPathwayDescription(e.target.value)}
                  placeholder="Descrivi brevemente il percorso formativo..."
                  rows={3}
                />
              </div>
            </div>

            <div className="space-y-3 mt-6">
              <Label className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Anteprima Struttura
              </Label>
              <ScrollArea className="h-[200px] border rounded-lg p-4">
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(groupedAssignments).map(([trimester, courses]) => (
                    <div key={trimester} className="space-y-2">
                      <Badge variant="outline" className="w-full justify-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {trimester}
                      </Badge>
                      <div className="space-y-1">
                        {courses.length > 0 ? (
                          courses.map((c) => (
                            <div
                              key={c.courseId}
                              className="text-xs p-2 bg-muted rounded truncate"
                              title={c.courseName}
                            >
                              {c.courseName}
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-muted-foreground text-center p-2">
                            Nessun corso
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Indietro
              </Button>
              <Button
                onClick={handleGeneratePathway}
                disabled={!pathwayName.trim() || generateMutation.isPending}
                className="gap-2"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creazione...
                  </>
                ) : (
                  <>
                    <GraduationCap className="h-4 w-4" />
                    Crea Template
                  </>
                )}
              </Button>
            </div>
          </div>
        );

      case 3:
        if (isComplete) {
          return (
            <div className="flex flex-col items-center justify-center py-12 gap-6">
              <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full">
                <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold">Percorso Creato con Successo!</h3>
                <p className="text-muted-foreground">
                  {selectedClientIds.length > 0
                    ? `Il percorso "${pathwayName}" è stato creato e assegnato a ${selectedClientIds.length} cliente/i.`
                    : `Il percorso "${pathwayName}" è stato creato come template.`}
                </p>
              </div>
              <Button onClick={handleComplete} className="gap-2 mt-4">
                <CheckCircle2 className="h-4 w-4" />
                Chiudi
              </Button>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <Users className="h-5 w-5" />
              <span>Seleziona i clienti a cui assegnare immediatamente il percorso (opzionale)</span>
            </div>

            {clientsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : clients.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    Nessun cliente disponibile. Puoi saltare questo passaggio.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {clients.map((client) => (
                    <Card
                      key={client.id}
                      className={`cursor-pointer transition-all ${
                        selectedClientIds.includes(client.id)
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => handleClientToggle(client.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedClientIds.includes(client.id)}
                            onCheckedChange={() => handleClientToggle(client.id)}
                          />
                          <div>
                            <p className="font-medium">
                              {client.firstName} {client.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">{client.email}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Indietro
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleSkip}>
                  Salta
                </Button>
                <Button
                  onClick={handleAssignAndCreate}
                  disabled={selectedClientIds.length === 0 || instantiateMutation.isPending}
                  className="gap-2"
                >
                  {instantiateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Assegnazione...
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4" />
                      Assegna e Crea
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            Wizard Percorso AI
          </DialogTitle>
          <DialogDescription>
            Crea un percorso formativo personalizzato con l'aiuto dell'intelligenza artificiale
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 border-b">
          <Stepper
            steps={steps}
            currentStep={currentStep}
            onStepClick={handleStepClick}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="py-4"
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

export default AIPathwayWizard;
