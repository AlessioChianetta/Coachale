import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  X,
  Tag,
  BookOpen,
  Calendar,
  Target,
  Eye,
  AlertCircle,
  Clock,
  Star,
  Save,
  Download,
  Globe,
  Sparkles
} from "lucide-react";
import FileUpload from "./file-upload";
import { insertExerciseSchema, insertExerciseTemplateSchema, type InsertExerciseTemplate, type Question } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { LibraryDocumentTable } from "@/components/LibraryDocumentTable";

const exerciseFormSchema = insertExerciseSchema.extend({
  estimatedDuration: z.preprocess((val) => {
    // Convert empty string, null, undefined, and NaN to undefined
    if (val === "" || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) {
      return undefined;
    }
    return Number(val);
  }, z.number().min(1).optional()),
  selectedClients: z.array(z.string()).optional(),
  customPlatformLinks: z.record(z.string()).optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  maxScore: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) return undefined;
    return Number(val);
  }, z.number().min(1).optional()),
  passingScore: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) return undefined;
    return Number(val);
  }, z.number().min(0).optional()),
  allowRetries: z.boolean().default(true),
  timeLimit: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) return undefined;
    return Number(val);
  }, z.number().optional()),
  showProgressBar: z.boolean().default(true),
  randomizeQuestions: z.boolean().default(false),
  workPlatform: z.string().optional(),
  libraryDocumentId: z.string().optional(),
  useQuestions: z.boolean().default(false),
  usePlatform: z.boolean().default(false),
  useLibraryLesson: z.boolean().default(false),
  isPublic: z.boolean().default(false),
  // Exam-specific fields
  isExam: z.boolean().default(false),
  examDate: z.string().optional(),
  yearId: z.string().optional(),
  trimesterId: z.string().optional(),
  autoCorrect: z.boolean().default(false),
  totalPoints: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) return undefined;
    return Number(val);
  }, z.number().optional()),
  examTimeLimit: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined || (typeof val === 'number' && isNaN(val))) return undefined;
    return Number(val);
  }, z.number().optional()),
}).refine((data) => {
  // At least one of questions, workPlatform, or libraryDocumentId must be provided
  const hasQuestions = data.useQuestions && data.questions && data.questions.length > 0;
  const hasWorkPlatform = data.usePlatform && data.workPlatform && data.workPlatform.trim() !== '';
  const hasLibraryLesson = data.useLibraryLesson && data.libraryDocumentId && data.libraryDocumentId.trim() !== '';
  return hasQuestions || hasWorkPlatform || hasLibraryLesson;
}, {
  message: "Devi abilitare e configurare almeno domande, piattaforma di lavoro o lezione del corso",
  path: ["useQuestions"],
}).refine((data) => {
  // If not public, must have selected clients
  if (!data.isPublic && (!data.selectedClients || data.selectedClients.length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Seleziona almeno un cliente per assegnare l'esercizio, o scegli l'opzione pubblica",
  path: ["selectedClients"],
});

type ExerciseFormData = z.infer<typeof exerciseFormSchema>;

// Using the imported Question type from shared/schema
// interface Question is now imported from @shared/schema

interface ExerciseFormProps {
  onSubmit: (data: ExerciseFormData, files: File[]) => void;
  onCancel: () => void;
  onSuccess?: () => void; // Called when template assignment is complete (closes modal)
  isLoading?: boolean;
  existingExercise?: any; // Exercise data for editing
  templateData?: any; // Template data for preloading
}

// Client Selector Component
function ClientSelector({
  selectedClients,
  onClientsChange,
  templateData,
  existingAssignments = [],
  showPlatformLinks = false,
  customPlatformLinks = {},
  onPlatformLinkChange,
  existingExercise
}: {
  selectedClients: string[],
  onClientsChange: (clients: string[]) => void,
  templateData?: any,
  existingAssignments?: any[],
  showPlatformLinks?: boolean,
  customPlatformLinks?: Record<string, string>,
  onPlatformLinkChange?: (clientId: string, link: string) => void,
  existingExercise?: any
}) {
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients", "active"],
    queryFn: async () => {
      const response = await fetch("/api/clients?activeOnly=true", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  const handleClientToggle = (clientId: string) => {
    if (selectedClients.includes(clientId)) {
      onClientsChange(selectedClients.filter(id => id !== clientId));
    } else {
      onClientsChange([...selectedClients, clientId]);
    }
  };

  // Check if a client already has this template assigned
  // Only disable clients when USING a template to create NEW exercises
  // When EDITING a template, never disable - you're just changing associations
  const isEditingTemplateNow = existingExercise && !existingExercise.createdBy;

  const clientHasTemplate = (clientId: string) => {
    // If we're editing a template (not using one), never disable clients
    if (isEditingTemplateNow) return false;

    // If we're using a template to create exercises, check for existing assignments
    if (!templateData) return false;

    return existingAssignments.some((assignment: any) =>
      assignment.clientId === clientId &&
      assignment.exercise &&
      assignment.exercise.title &&
      assignment.exercise.title.includes(templateData.name)
    );
  };

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto border rounded-md p-3">
      {isEditingTemplateNow && (
        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            💡 <strong>Modifica assegnazioni:</strong> Puoi selezionare o deselezionare clienti.
            Deselezionando un cliente, tutti i suoi esercizi creati da questo template saranno rimossi.
          </p>
        </div>
      )}
      {clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun cliente registrato</p>
      ) : (
        clients.map((client: any) => {
          const hasTemplate = clientHasTemplate(client.id);
          const isSelected = selectedClients.includes(client.id);

          return (
            <div key={client.id} className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`client-${client.id}`}
                  checked={isSelected}
                  onCheckedChange={() => handleClientToggle(client.id)}
                  disabled={hasTemplate}
                />
                <Label
                  htmlFor={`client-${client.id}`}
                  className={`text-sm font-normal ${hasTemplate ? 'text-muted-foreground line-through' : ''}`}
                >
                  {client.firstName} {client.lastName} ({client.email})
                  {hasTemplate && (
                    <span className="ml-2 text-xs bg-muted px-2 py-1 rounded">
                      Già assegnato
                    </span>
                  )}
                </Label>
              </div>
              {isSelected && showPlatformLinks && onPlatformLinkChange && (
                <div className="ml-6 space-y-1">
                  <Label className="text-xs text-muted-foreground">Link personalizzato (opzionale)</Label>
                  <Input
                    placeholder="es. https://docs.google.com/spreadsheets/d/..."
                    value={customPlatformLinks[client.id] || ""}
                    onChange={(e) => onPlatformLinkChange(client.id, e.target.value)}
                    className="text-sm h-8"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se vuoto, sarà usato il link generale dell'esercizio
                  </p>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}


export default function ExerciseForm({ onSubmit, onCancel, onSuccess, isLoading, existingExercise, templateData }: ExerciseFormProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateTags, setTemplateTags] = useState<string[]>([]);
  const [newTemplateTag, setNewTemplateTag] = useState("");
  const [templateIsPublic, setTemplateIsPublic] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState(templateData ? "clients" : "basic");
  const [customPlatformLinks, setCustomPlatformLinks] = useState<Record<string, string>>({});
  const [pastedOptionsText, setPastedOptionsText] = useState<Record<string, string>>({});

  // Ref to track the last initialized exercise/template ID to prevent unnecessary resets
  const lastInitializedIdRef = useRef<string | null>(null);
  // Ref to track if template associations have been loaded and applied
  const templateAssociationsLoadedRef = useRef<boolean>(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch assignment count for existing exercise
  const { data: assignmentCount = 0 } = useQuery({
    queryKey: ["/api/exercise-assignments/count", existingExercise?.id],
    queryFn: async () => {
      if (!existingExercise?.id) return 0;
      const response = await fetch(`/api/exercise-assignments/consultant`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return 0;
      const assignments = await response.json();
      return assignments.filter((a: any) => a.exerciseId === existingExercise.id).length;
    },
    enabled: !!existingExercise?.id,
  });

  // Fetch dynamic exercise categories from database
  const { data: exerciseCategories = [] } = useQuery({
    queryKey: ["/api/exercise-categories"],
    queryFn: async () => {
      const response = await fetch("/api/exercise-categories?active=true", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData: any) => {
      const response = await apiRequest("POST", "/api/templates", templateData);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template Salvato",
        description: "Il template è stato salvato con successo",
      });
      setSaveAsTemplate(false);
      setTemplateName("");
      setTemplateIsPublic(false);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio del template",
        variant: "destructive",
      });
    },
  });

  const form = useForm<ExerciseFormData>({
    mode: "onSubmit", // Valida solo quando si fa submit, non ad ogni cambiamento
    resolver: zodResolver(exerciseFormSchema),
    defaultValues: {
      title: existingExercise?.title || "",
      description: existingExercise?.description || "",
      type: existingExercise?.type || "general",
      category: existingExercise?.category || "",
      instructions: existingExercise?.instructions || "",
      estimatedDuration: existingExercise?.estimatedDuration || 60,
      selectedClients: [],
      customPlatformLinks: {},
      priority: existingExercise?.priority || "medium",
      maxScore: existingExercise?.maxScore || 100,
      passingScore: existingExercise?.passingScore || 60,
      allowRetries: existingExercise?.allowRetries || true,
      timeLimit: existingExercise?.timeLimit || 60,
      showProgressBar: existingExercise?.showProgressBar || true,
      randomizeQuestions: existingExercise?.randomizeQuestions || false,
      workPlatform: existingExercise?.workPlatform || "",
      libraryDocumentId: existingExercise?.libraryDocumentId || "",
      useQuestions: false,
      usePlatform: false,
      useLibraryLesson: false,
      isPublic: false,
      // Exam-specific fields
      isExam: existingExercise?.isExam || false,
      examDate: existingExercise?.examDate || undefined,
      yearId: existingExercise?.yearId || undefined,
      trimesterId: existingExercise?.trimesterId || undefined,
      autoCorrect: existingExercise?.autoCorrect || false,
      totalPoints: existingExercise?.totalPoints || undefined,
      examTimeLimit: existingExercise?.examTimeLimit || undefined,
    },
  });

  // Fetch template associations if using a template OR editing a template
  // When editing a template, it comes as existingExercise without a createdBy field
  const isEditingTemplate = existingExercise && !existingExercise.createdBy;
  const templateIdForAssociations = templateData?.id || (isEditingTemplate ? existingExercise?.id : null);

  console.log('🔍 TEMPLATE ASSOCIATIONS SETUP', {
    templateDataId: templateData?.id,
    existingExerciseId: existingExercise?.id,
    isEditingTemplate,
    templateIdForAssociations,
    hasTemplateData: !!templateData,
    hasExistingExercise: !!existingExercise
  });

  const { data: templateAssociations = [], isLoading: isLoadingAssociations } = useQuery({
    queryKey: ["/api/templates", templateIdForAssociations, "associations"],
    queryFn: async () => {
      if (!templateIdForAssociations) {
        console.log('⚠️ No template ID for associations');
        return [];
      }
      console.log('🌐 Fetching template associations for:', templateIdForAssociations);
      const response = await fetch(`/api/templates/${templateIdForAssociations}/associations`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        console.log('❌ Failed to fetch template associations:', response.status);
        return [];
      }
      const data = await response.json();
      console.log('✅ Template associations loaded:', {
        count: data.length,
        associations: data
      });
      return data;
    },
    enabled: !!templateIdForAssociations,
  });

  // Fetch existing assignments to prevent duplicates and show assigned clients when editing
  const { data: existingAssignments = [] } = useQuery({
    queryKey: ["/api/exercise-assignments/consultant"],
    queryFn: async () => {
      const response = await fetch("/api/exercise-assignments/consultant", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!templateData?.id || !!existingExercise?.id,
  });

  // Watch selected clients
  const selectedClientIds = form.watch("selectedClients") || [];

  // Fetch university years for exam selection (filtered by selected clients if any)
  const { data: allUniversityYears = [] } = useQuery({
    queryKey: ["/api/university/years"],
    queryFn: async () => {
      const response = await fetch("/api/university/years", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch year assignments for selected clients to filter available years
  const { data: clientYearAssignments = [] } = useQuery({
    queryKey: ["/api/university/client-year-assignments", selectedClientIds],
    queryFn: async () => {
      if (selectedClientIds.length === 0) return [];
      const response = await fetch(`/api/university/client-year-assignments?clientIds=${selectedClientIds.join(',')}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: selectedClientIds.length > 0,
  });

  // Filter years based on selected clients (show only years common to ALL selected clients)
  const universityYears = selectedClientIds.length > 0 && clientYearAssignments.length > 0
    ? allUniversityYears.filter((year: any) => {
      // Check if ALL selected clients have this year assigned
      return selectedClientIds.every(clientId =>
        clientYearAssignments.some((assignment: any) =>
          assignment.yearId === year.id && assignment.clientId === clientId
        )
      );
    })
    : allUniversityYears;

  // Fetch trimesters for selected year
  const selectedYearId = form.watch("yearId");
  const { data: universityTrimesters = [] } = useQuery({
    queryKey: ["/api/university/years", selectedYearId, "trimesters"],
    queryFn: async () => {
      if (!selectedYearId) return [];
      const response = await fetch(`/api/university/years/${selectedYearId}/trimesters`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedYearId,
  });

  // Initialize form data when editing existing exercise or using template
  // Only reset when the actual exercise/template ID changes, not when the object reference changes
  useEffect(() => {
    const dataSource = existingExercise || templateData;
    const currentId = dataSource?.id || null;

    // Check if we need to wait for template associations to load
    const needsAssociations = templateData || (existingExercise && !existingExercise.createdBy);

    // If we need associations and they're still loading, wait
    if (needsAssociations && isLoadingAssociations) {
      console.log('⏳ Waiting for template associations to load...');
      return;
    }

    // Check if we need to reload because template associations have been loaded
    const isEditingTemplateNow = existingExercise && !existingExercise.createdBy;
    const shouldReloadForAssociations = isEditingTemplateNow &&
      !templateAssociationsLoadedRef.current &&
      templateAssociations.length > 0;

    // Only reset if the ID has actually changed OR if template associations just loaded
    if ((currentId && currentId !== lastInitializedIdRef.current) || shouldReloadForAssociations) {
      if (currentId !== lastInitializedIdRef.current) {
        lastInitializedIdRef.current = currentId;
        templateAssociationsLoadedRef.current = false; // Reset for new template
      }

      if (shouldReloadForAssociations) {
        templateAssociationsLoadedRef.current = true;
      }

      console.log('🔄 Initializing form with data:', {
        currentId,
        isEditingExercise: !!existingExercise,
        isUsingTemplate: !!templateData,
        existingAssignmentsCount: existingAssignments.length,
        templateAssociationsCount: templateAssociations.length,
        shouldReloadForAssociations,
        templateAssociationsLoadedRef: templateAssociationsLoadedRef.current
      });

      // Determine which content types are being used
      const hasQuestions = dataSource.questions && dataSource.questions.length > 0;
      const hasPlatform = dataSource.workPlatform && dataSource.workPlatform.trim() !== '';
      const hasLibraryLesson = dataSource.libraryDocumentId && dataSource.libraryDocumentId.trim() !== '';

      // Set questions if they exist
      if (hasQuestions) {
        setQuestions(dataSource.questions.map((q: any, index: number) => ({
          id: q.id || String(index),
          question: q.question,
          type: q.type,
          options: q.options || [],
          correctAnswers: q.correctAnswers || [],
          points: q.points
        })));
      } else {
        setQuestions([]);
      }

      // Get pre-selected clients based on context
      let preSelectedClients: string[] = [];

      console.log('🎯 CLIENT SELECTION LOGIC', {
        hasTemplateData: !!templateData,
        hasExistingExercise: !!existingExercise,
        existingExerciseCreatedBy: existingExercise?.createdBy,
        templateAssociationsCount: templateAssociations.length,
        existingAssignmentsCount: existingAssignments.length,
        templateAssociations: templateAssociations,
        existingAssignments: existingAssignments
      });

      if (templateData && !existingExercise) {
        // Using a template to create new exercise - use template associations
        console.log('📝 Using template associations for client selection');
        preSelectedClients = templateAssociations
          .filter((assoc: any) => assoc.isVisible)
          .map((assoc: any) => assoc.clientId);
        console.log('📝 Filtered associations:', {
          total: templateAssociations.length,
          visible: templateAssociations.filter((a: any) => a.isVisible).length,
          clientIds: preSelectedClients
        });
      } else if (existingExercise && existingExercise.createdBy) {
        // Editing a normal exercise (has createdBy) - use exercise assignments
        console.log('✏️ Editing exercise - using assignments for client selection');
        preSelectedClients = existingAssignments
          .filter((assignment: any) => assignment.exerciseId === existingExercise.id)
          .map((assignment: any) => assignment.clientId);
      } else if (existingExercise && !existingExercise.createdBy) {
        // Editing a template (no createdBy) - use template associations
        console.log('📋 Editing template - using template associations for client selection');
        preSelectedClients = templateAssociations
          .filter((assoc: any) => assoc.isVisible)
          .map((assoc: any) => assoc.clientId);
      }

      console.log('👥 Pre-selected clients:', preSelectedClients);

      // Reset form with values from existing exercise or template
      form.reset({
        title: dataSource.name || dataSource.title || "",
        description: dataSource.description || "",
        type: dataSource.type || "general",
        category: dataSource.category || "",
        instructions: dataSource.instructions || "",
        estimatedDuration: dataSource.estimatedDuration || undefined,
        timeLimit: dataSource.timeLimit || undefined,
        selectedClients: preSelectedClients,
        priority: dataSource.priority || "medium",
        maxScore: dataSource.maxScore || 100,
        passingScore: dataSource.passingScore || 60,
        allowRetries: dataSource.allowRetries !== undefined ? dataSource.allowRetries : true,
        showProgressBar: dataSource.showProgressBar !== undefined ? dataSource.showProgressBar : true,
        randomizeQuestions: dataSource.randomizeQuestions || false,
        workPlatform: dataSource.workPlatform || "",
        libraryDocumentId: dataSource.libraryDocumentId || "",
        useQuestions: !!hasQuestions,
        usePlatform: !!hasPlatform,
        useLibraryLesson: !!hasLibraryLesson,
        isPublic: dataSource.isPublic || false,
        customPlatformLinks: {},
        // Exam-specific fields
        isExam: dataSource.isExam || false,
        examDate: dataSource.examDate || undefined,
        yearId: dataSource.yearId || undefined,
        trimesterId: dataSource.trimesterId || undefined,
        autoCorrect: dataSource.autoCorrect || false,
        totalPoints: dataSource.totalPoints || undefined,
        examTimeLimit: dataSource.examTimeLimit || undefined,
      });
    } else if (!currentId && lastInitializedIdRef.current !== null) {
      // Reset to empty form when there's no exercise/template
      lastInitializedIdRef.current = null;
      templateAssociationsLoadedRef.current = false;
      setQuestions([]);
    }
  }, [existingExercise?.id, templateData?.id, templateAssociations, existingAssignments, form, isEditingTemplate, isLoadingAssociations]);

  const handleSubmit = async (data: ExerciseFormData) => {
    console.log('📝 EXERCISE FORM SUBMIT START', {
      timestamp: new Date().toISOString(),
      isEditing: !!existingExercise,
      exerciseId: existingExercise?.id,
      formData: {
        title: data.title,
        useLibraryLesson: data.useLibraryLesson,
        libraryDocumentId: data.libraryDocumentId
      }
    });

    if (!data.title || !data.description || !data.category) {
      console.log('❌ VALIDATION FAILED - Missing required fields', {
        hasTitle: !!data.title,
        hasDescription: !!data.description,
        hasCategory: !!data.category
      });
      toast({
        title: "Errore",
        description: "Titolo, descrizione e categoria sono obbligatori.",
        variant: "destructive",
      });
      return;
    }

    // Validation for assignment - either public or has selected clients (only for exercises, not templates)
    if (!templateData && !data.isPublic && (!data.selectedClients || data.selectedClients.length === 0)) {
      toast({
        title: "Errore",
        description: "Seleziona almeno un cliente per assegnare l'esercizio, o scegli l'opzione pubblica.",
        variant: "destructive",
      });
      return;
    }

    // Additional validation for content type
    const hasQuestions = data.useQuestions && questions && questions.length > 0;
    const hasWorkPlatform = data.usePlatform && data.workPlatform && data.workPlatform.trim() !== '';
    const hasLibraryLesson = data.useLibraryLesson && data.libraryDocumentId && data.libraryDocumentId.trim() !== '';

    console.log('🔍 CONTENT TYPE VALIDATION', {
      hasQuestions,
      hasWorkPlatform,
      hasLibraryLesson,
      details: {
        useLibraryLesson: data.useLibraryLesson,
        libraryDocumentId: data.libraryDocumentId,
        libraryDocumentIdTrimmed: data.libraryDocumentId?.trim(),
        libraryDocumentIdLength: data.libraryDocumentId?.length
      }
    });

    if (!hasQuestions && !hasWorkPlatform && !hasLibraryLesson) {
      toast({
        title: "Errore",
        description: "Devi abilitare e configurare almeno domande, piattaforma di lavoro o lezione del corso.",
        variant: "destructive",
      });
      return;
    }

    const exerciseData: ExerciseFormData = {
      title: data.title,
      description: data.description,
      category: data.category,
      instructions: data.instructions,
      estimatedDuration: data.estimatedDuration ? Number(data.estimatedDuration) : undefined,
      priority: data.priority,
      workPlatform: data.usePlatform && data.workPlatform ? data.workPlatform : undefined,
      libraryDocumentId: data.useLibraryLesson && data.libraryDocumentId ? data.libraryDocumentId : undefined,
      questions: data.useQuestions ? questions : [],
      type: data.type,
      isPublic: data.isPublic,
      selectedClients: data.selectedClients,
      customPlatformLinks: customPlatformLinks,
      allowRetries: data.allowRetries,
      showProgressBar: data.showProgressBar,
      randomizeQuestions: data.randomizeQuestions,
      useQuestions: data.useQuestions,
      usePlatform: data.usePlatform,
      useLibraryLesson: data.useLibraryLesson,
      // Exam-specific fields
      isExam: data.isExam || false,
      examDate: data.isExam && data.examDate ? data.examDate : undefined,
      yearId: data.isExam && data.yearId ? data.yearId : undefined,
      trimesterId: data.isExam && data.trimesterId ? data.trimesterId : undefined,
      autoCorrect: data.isExam && data.autoCorrect ? data.autoCorrect : false,
      totalPoints: data.isExam && data.totalPoints ? data.totalPoints : undefined,
      examTimeLimit: data.isExam && data.examTimeLimit ? data.examTimeLimit : undefined,
    };

    console.log('📦 FINAL EXERCISE DATA PREPARED', {
      exerciseData,
      libraryDocumentId: exerciseData.libraryDocumentId,
      libraryDocumentIdType: typeof exerciseData.libraryDocumentId,
      libraryDocumentIdIsUndefined: exerciseData.libraryDocumentId === undefined,
      libraryDocumentIdIsNull: exerciseData.libraryDocumentId === null,
      libraryDocumentIdIsEmpty: exerciseData.libraryDocumentId === ''
    });

    // Determine if we're working with a template (either using one or editing one)
    const templateIdToUpdate = templateData?.id || (isEditingTemplate ? existingExercise?.id : null);

    // Update template-client associations for both new template usage and template editing
    if (templateIdToUpdate && !data.isPublic && data.selectedClients && data.selectedClients.length > 0) {
      try {
        // Get existing associated client IDs from templateAssociations
        const existingAssociatedClientIds = new Set(
          templateAssociations
            .filter((assoc: any) => assoc.isVisible)
            .map((assoc: any) => assoc.clientId)
        );

        // When USING a template (not editing), only send NEW clients that aren't already associated
        // When EDITING a template, send ALL selected clients (to allow add/remove)
        const isUsingTemplate = templateData && !isEditingTemplate;
        const clientIdsToSend = isUsingTemplate
          ? data.selectedClients.filter((id: string) => !existingAssociatedClientIds.has(id))
          : data.selectedClients;

        console.log('💾 Saving template associations:', {
          templateId: templateIdToUpdate,
          isEditingTemplate,
          isUsingTemplate,
          allSelectedClients: data.selectedClients,
          existingAssociatedClientIds: Array.from(existingAssociatedClientIds),
          clientIdsToSend
        });

        // Only call the API if there are new clients to add (when using) or any changes (when editing)
        if (clientIdsToSend.length > 0 || isEditingTemplate) {
          await apiRequest("POST", `/api/templates/${templateIdToUpdate}/associate-clients`, {
            clientIds: clientIdsToSend,
          });
        } else {
          console.log('ℹ️ No new clients to associate, skipping API call');
        }
      } catch (error: any) {
        console.error('Failed to update template associations:', error);
      }
    } else if (templateIdToUpdate && !data.isPublic && (!data.selectedClients || data.selectedClients.length === 0)) {
      // If editing a template and clearing all client associations
      if (isEditingTemplate) {
        try {
          console.log('🗑️ Clearing template associations:', {
            templateId: templateIdToUpdate,
            isEditingTemplate
          });
          await apiRequest("POST", `/api/templates/${templateIdToUpdate}/associate-clients`, {
            clientIds: [],
          });
        } catch (error: any) {
          console.error('Failed to clear template associations:', error);
        }
      }
    }

    console.log('🚀 CALLING onSubmit WITH DATA', {
      timestamp: new Date().toISOString(),
      isEditing: !!existingExercise,
      exerciseId: existingExercise?.id,
      hasLibraryDocumentId: !!exerciseData.libraryDocumentId,
      selectedClientsCount: exerciseData.selectedClients?.length || 0,
      isPublic: exerciseData.isPublic
    });

    // When USING a template to assign to clients, associateTemplateWithClients already created the exercises.
    // Only call onSubmit for: editing existing exercises, editing templates, or creating new exercises from scratch.
    const isUsingTemplateToCreate = templateData && !isEditingTemplate && !existingExercise;

    if (isUsingTemplateToCreate) {
      console.log('✅ Template usage complete - exercises created via associateTemplateWithClients');
      toast({
        title: "Esercizio assegnato",
        description: "L'esercizio è stato creato e assegnato ai clienti selezionati",
      });
      // Call onSuccess to close the modal
      if (onSuccess) {
        onSuccess();
      }
    } else {
      onSubmit(exerciseData, files);
    }
  };

  const handleSaveAsTemplate = () => {
    const formData = form.getValues();

    if (!formData.title || !formData.description || !formData.category) {
      toast({
        title: "Errore",
        description: "Titolo, descrizione e categoria sono obbligatori per salvare il template.",
        variant: "destructive",
      });
      return;
    }

    if (!templateName.trim()) {
      toast({
        title: "Errore",
        description: "Il nome del template è obbligatorio.",
        variant: "destructive",
      });
      return;
    }

    // Additional validation for content type
    const hasQuestions = formData.useQuestions && questions && questions.length > 0;
    const hasWorkPlatform = formData.usePlatform && formData.workPlatform && formData.workPlatform.trim() !== '';
    const hasLibraryLesson = formData.useLibraryLesson && formData.libraryDocumentId && formData.libraryDocumentId.trim() !== '';

    if (!hasQuestions && !hasWorkPlatform && !hasLibraryLesson) {
      toast({
        title: "Errore",
        description: "Devi abilitare e configurare almeno domande, piattaforma di lavoro o lezione del corso per salvare il template.",
        variant: "destructive",
      });
      return;
    }

    const templateData = {
      name: templateName,
      description: formData.description,
      category: formData.category,
      type: formData.type,
      estimatedDuration: formData.estimatedDuration,
      timeLimit: formData.timeLimit,
      instructions: formData.instructions,
      questions: formData.useQuestions ? questions : [],
      workPlatform: formData.workPlatform || undefined,
      libraryDocumentId: formData.libraryDocumentId || undefined,
      tags: templateTags,
      isPublic: templateIsPublic,
    };

    saveTemplateMutation.mutate(templateData);
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      question: "",
      type: "text",
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, field: keyof Question, value: any) => {
    setQuestions(questions.map(q =>
      q.id === id ? { ...q, [field]: value } : q
    ));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const addOption = (questionId: string) => {
    setQuestions(questions.map(q =>
      q.id === questionId
        ? { ...q, options: [...(q.options || []), ""] }
        : q
    ));
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        const oldValue = q.options?.[optionIndex];
        const newOptions = q.options?.map((opt, idx) => idx === optionIndex ? value : opt);

        // Update correctAnswers if the old value was in it
        let newCorrectAnswers = q.correctAnswers;
        if (oldValue !== undefined && newCorrectAnswers?.includes(oldValue)) {
          newCorrectAnswers = newCorrectAnswers.map(ans => ans === oldValue ? value : ans);
        }

        return { ...q, options: newOptions, correctAnswers: newCorrectAnswers };
      }
      return q;
    }));
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        const removedValue = q.options?.[optionIndex];
        const newOptions = q.options?.filter((_, idx) => idx !== optionIndex);

        // Remove from correctAnswers if it was there
        let newCorrectAnswers = q.correctAnswers;
        if (removedValue !== undefined && newCorrectAnswers?.includes(removedValue)) {
          newCorrectAnswers = newCorrectAnswers.filter(ans => ans !== removedValue);
        }

        return { ...q, options: newOptions, correctAnswers: newCorrectAnswers };
      }
      return q;
    }));
  };

  // Parse pasted text and extract options
  const parseOptionsFromText = (text: string): string[] => {
    if (!text.trim()) return [];

    // Split by semicolon if present
    if (text.includes(';')) {
      return text.split(';').map(opt => opt.trim()).filter(opt => opt.length > 0);
    }

    // Try to match inline patterns like "A. text B. text C. text"
    const inlinePattern = /[A-Za-z0-9]+[\.\)]\s*[^A-Z0-9\.\)]+/g;
    const inlineMatches = text.match(inlinePattern);

    if (inlineMatches && inlineMatches.length > 1) {
      // Found inline formatted options
      return inlineMatches.map(match =>
        match.replace(/^[A-Za-z0-9]+[\.\)]\s*/, '').trim()
      ).filter(opt => opt.length > 0);
    }

    // Split by newlines
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    const options: string[] = [];

    for (const line of lines) {
      // Remove common prefixes like "A. ", "1. ", "a) ", etc.
      const cleaned = line
        .replace(/^[A-Za-z0-9]+[\.\)]\s*/, '') // Remove "A. " or "1. " or "a) " etc.
        .trim();

      if (cleaned.length > 0) {
        options.push(cleaned);
      }
    }

    return options;
  };

  // Apply parsed options to a question
  const applyParsedOptions = (questionId: string) => {
    const text = pastedOptionsText[questionId] || "";
    const parsedOptions = parseOptionsFromText(text);

    if (parsedOptions.length === 0) {
      toast({
        title: "Nessuna opzione trovata",
        description: "Assicurati di incollare un testo con opzioni valide.",
        variant: "destructive",
      });
      return;
    }

    setQuestions(questions.map(q =>
      q.id === questionId
        ? { ...q, options: parsedOptions, correctAnswers: [] }
        : q
    ));

    // Clear the pasted text after applying
    setPastedOptionsText(prev => {
      const newState = { ...prev };
      delete newState[questionId];
      return newState;
    });

    toast({
      title: "Opzioni inserite!",
      description: `${parsedOptions.length} opzioni sono state aggiunte con successo.`,
    });
  };

  const ExercisePreview = () => (
    <Card className="border-2 border-dashed border-muted-foreground/25">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Eye size={20} />
          <span>Anteprima Esercizio</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{form.watch("title") || "Titolo dell'esercizio"}</h3>
          <Badge variant="outline" className="mt-1">
            {form.watch("category") || "Categoria"}
          </Badge>
        </div>

        <div>
          <Label className="text-sm font-medium">Descrizione</Label>
          <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
            {form.watch("description") || "Descrizione dell'esercizio apparirà qui..."}
          </div>
        </div>

        {form.watch("instructions") && (
          <div>
            <Label className="text-sm font-medium">Istruzioni</Label>
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
              {form.watch("instructions")}
            </p>
          </div>
        )}

        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          {form.watch("estimatedDuration") && (
            <div className="flex items-center space-x-1">
              <Clock size={14} />
              <span>{form.watch("estimatedDuration")} min</span>
            </div>
          )}
          {form.watch("priority") && (
            <div className="flex items-center space-x-1">
              <Star size={14} />
              <span className="capitalize">{form.watch("priority")}</span>
            </div>
          )}
          {form.watch("maxScore") && (
            <div className="flex items-center space-x-1">
              <Target size={14} />
              <span>Max: {form.watch("maxScore")} punti</span>
            </div>
          )}
        </div>

        {form.watch("useQuestions") && questions.length > 0 && (
          <div>
            <Label className="text-sm font-medium">Domande ({questions.length})</Label>
            <div className="mt-2 space-y-2">
              {questions.slice(0, 3).map((q, idx) => (
                <div key={q.id} className="p-2 bg-muted/50 rounded text-sm">
                  <strong>{idx + 1}.</strong> {q.question || "Domanda vuota"}
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {q.type}
                  </Badge>
                </div>
              ))}
              {questions.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  ...e altre {questions.length - 3} domande
                </p>
              )}
            </div>
          </div>
        )}

        {form.watch("usePlatform") && form.watch("workPlatform") && (
          <div>
            <Label className="text-sm font-medium">Piattaforma di Lavoro</Label>
            <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-xs text-muted-foreground break-all">
                  {form.watch("workPlatform")}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Card className="w-full max-w-6xl border-0 shadow-2xl overflow-hidden" data-testid="exercise-form">
      <CardHeader className="relative bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 text-white pb-8 pt-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -ml-24 -mb-24"></div>
        <div className="relative flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Sparkles size={24} className="text-white" />
              </div>
              <CardTitle className="text-3xl font-bold text-white">
                {existingExercise ? "Modifica Esercizio" : templateData ? "Crea Esercizio da Template" : "Crea Nuovo Esercizio"}
              </CardTitle>
            </div>
            <p className="text-purple-100 ml-15">
              {existingExercise ? "Aggiorna i dettagli dell'esercizio" : "Configura un nuovo esercizio per i tuoi clienti"}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30 hover:text-white"
            >
              <Eye size={16} className="mr-1" />
              {showPreview ? "Nascondi" : "Mostra"} Anteprima
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className={showPreview ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : ""}>
          <div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl h-auto">
                <TabsTrigger
                  value="basic"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-md rounded-lg py-3 font-medium transition-all"
                >
                  <div className="flex items-center space-x-2">
                    <BookOpen size={16} />
                    <span>Base</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger
                  value="content"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-md rounded-lg py-3 font-medium transition-all"
                >
                  <div className="flex items-center space-x-2">
                    <Target size={16} />
                    <span>Contenuto</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-md rounded-lg py-3 font-medium transition-all"
                >
                  <div className="flex items-center space-x-2">
                    <AlertCircle size={16} />
                    <span>Impostazioni</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger
                  value="clients"
                  className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-md rounded-lg py-3 font-medium transition-all"
                >
                  <div className="flex items-center space-x-2">
                    <Globe size={16} />
                    <span>Assegnazione</span>
                  </div>
                </TabsTrigger>
              </TabsList>

              <form onSubmit={form.handleSubmit(handleSubmit, (errors) => {
                console.error('❌ FORM VALIDATION FAILED', {
                  timestamp: new Date().toISOString(),
                  errors,
                  formValues: form.getValues()
                });

                // Show toast with first error
                const firstError = Object.values(errors)[0];
                toast({
                  title: "Errore di Validazione",
                  description: firstError?.message || "Alcuni campi non sono validi. Controlla il form.",
                  variant: "destructive",
                });
              })} className="mt-8">
                {/* Warning banners for editing mode */}
                {existingExercise && (
                  <div className="space-y-3 mb-6">
                    {/* Multiple assignments warning */}
                    {assignmentCount > 0 && (
                      <div className="bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500 p-4 rounded-r-lg">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="text-blue-600 dark:text-blue-400 mt-0.5" size={20} />
                          <div className="flex-1">
                            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                              Esercizio Assegnato a {assignmentCount} {assignmentCount === 1 ? 'Cliente' : 'Clienti'}
                            </h4>
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              Le modifiche che apporti a questo esercizio saranno applicate automaticamente per tutti i clienti che lo hanno già assegnato.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Public exercise warning */}
                    {existingExercise.isPublic && (
                      <div className="bg-purple-50 dark:bg-purple-950/30 border-l-4 border-purple-500 p-4 rounded-r-lg">
                        <div className="flex items-start gap-3">
                          <Globe className="text-purple-600 dark:text-purple-400 mt-0.5" size={20} />
                          <div className="flex-1">
                            <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-1">
                              Esercizio Pubblico
                            </h4>
                            <p className="text-sm text-purple-800 dark:text-purple-200">
                              Questo esercizio è pubblico e visibile a tutti i tuoi clienti. Le modifiche saranno immediatamente disponibili per tutti.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <TabsContent value="basic" className="space-y-6">
                  {/* Basic Information */}
                  <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                      <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                        <BookOpen size={16} className="text-purple-600 dark:text-purple-400" />
                      </div>
                      <span>Informazioni di Base</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="title" className="text-sm font-semibold text-gray-700 dark:text-gray-300">Titolo *</Label>
                        <Input
                          id="title"
                          {...form.register("title")}
                          placeholder="es. Analisi di Bilancio"
                          data-testid="input-title"
                          className="border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        {form.formState.errors.title && (
                          <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="category">Categoria *</Label>
                        <Select
                          onValueChange={(value) => form.setValue("category", value)}
                          value={form.watch("category") || undefined}
                          data-testid="select-category"
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {exerciseCategories.length === 0 ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                Caricamento categorie...
                              </div>
                            ) : (
                              exerciseCategories.map((cat: any) => (
                                <SelectItem key={cat.id} value={cat.slug}>
                                  {cat.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.category && (
                          <p className="text-sm text-destructive">{form.formState.errors.category.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="type">Tipo *</Label>
                        <Select
                          onValueChange={(value: "general" | "personalized") => form.setValue("type", value)}
                          defaultValue="general"
                          data-testid="select-type"
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">Generale</SelectItem>
                            <SelectItem value="personalized">Personalizzato</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="priority">Priorità</Label>
                        <Select
                          onValueChange={(value: "low" | "medium" | "high") => form.setValue("priority", value)}
                          defaultValue="medium"
                          data-testid="select-priority"
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span>Bassa</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="medium">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                <span>Media</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="high">
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                <span>Alta</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="estimatedDuration">Durata stimata (minuti)</Label>
                        <Input
                          id="estimatedDuration"
                          type="number"
                          {...form.register("estimatedDuration", { valueAsNumber: true })}
                          placeholder="60"
                          data-testid="input-duration"
                        />
                        {form.formState.errors.estimatedDuration && (
                          <p className="text-sm text-destructive">{form.formState.errors.estimatedDuration.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dueDate">Scadenza (opzionale)</Label>
                        <Input
                          id="dueDate"
                          type="datetime-local"
                          {...form.register("dueDate")}
                          data-testid="input-due-date"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-2">
                    <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                        <Target size={16} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <span>Descrizione dell'Esercizio</span>
                    </h3>
                    <Label htmlFor="description">Descrizione *</Label>
                    <Textarea
                      id="description"
                      {...form.register("description")}
                      placeholder="Descrivi l'esercizio e i suoi obiettivi...&#10;&#10;Puoi usare più righe per organizzare meglio il contenuto"
                      rows={6}
                      data-testid="textarea-description"
                      className="resize-y min-h-[120px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Usa gli a capo per organizzare il contenuto su più paragrafi
                    </p>
                    {form.formState.errors.description && (
                      <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="content" className="space-y-6">

                  {/* Instructions */}
                  <div className="space-y-2">
                    <Label htmlFor="instructions">Istruzioni dettagliate</Label>
                    <Textarea
                      id="instructions"
                      {...form.register("instructions")}
                      placeholder="Istruzioni dettagliate per completare l'esercizio..."
                      rows={6}
                      data-testid="textarea-instructions"
                    />
                    <p className="text-xs text-muted-foreground">
                      Fornisci istruzioni chiare e dettagliate. Includi esempi se necessario.
                    </p>
                  </div>

                  {/* Content Type Selection */}
                  <div className="space-y-4">
                    <div>
                      <Label>Tipo di lavoro</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Scegli uno o più modi in cui il cliente dovrà lavorare sull'esercizio
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className={`p-4 border-2 rounded-lg transition-all ${form.watch("useQuestions") ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"}`}>
                        <div className="flex items-center space-x-3 mb-2">
                          <Checkbox
                            checked={form.watch("useQuestions")}
                            onCheckedChange={(checked) => form.setValue("useQuestions", checked as boolean)}
                            data-testid="checkbox-use-questions"
                          />
                          <Label className="font-medium cursor-pointer" onClick={() => form.setValue("useQuestions", !form.watch("useQuestions"))}>
                            Domande e Risposte
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          Il cliente risponderà a domande specifiche che creerai
                        </p>
                      </div>
                      <div className={`p-4 border-2 rounded-lg transition-all ${form.watch("usePlatform") ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"}`}>
                        <div className="flex items-center space-x-3 mb-2">
                          <Checkbox
                            checked={form.watch("usePlatform")}
                            onCheckedChange={(checked) => form.setValue("usePlatform", checked as boolean)}
                            data-testid="checkbox-use-platform"
                          />
                          <Label className="font-medium cursor-pointer" onClick={() => form.setValue("usePlatform", !form.watch("usePlatform"))}>
                            Piattaforma Esterna
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          Il cliente lavorerà su una piattaforma esterna (Google Sheets, ecc.)
                        </p>
                      </div>
                      <div className={`p-4 border-2 rounded-lg transition-all ${form.watch("useLibraryLesson") ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"}`}>
                        <div className="flex items-center space-x-3 mb-2">
                          <Checkbox
                            checked={form.watch("useLibraryLesson")}
                            onCheckedChange={(checked) => form.setValue("useLibraryLesson", checked as boolean)}
                            data-testid="checkbox-use-library-lesson"
                          />
                          <Label className="font-medium cursor-pointer" onClick={() => form.setValue("useLibraryLesson", !form.watch("useLibraryLesson"))}>
                            Lezione Corso Interna
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          Il cliente studierà una lezione dalla libreria dei corsi
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Work Platform - when platform is selected */}
                  {form.watch("usePlatform") && (
                    <div className="space-y-2">
                      <Label htmlFor="workPlatform">Link alla piattaforma di lavoro</Label>
                      <Input
                        id="workPlatform"
                        {...form.register("workPlatform")}
                        placeholder="es. https://docs.google.com/spreadsheets/d/..."
                        data-testid="input-work-platform"
                      />
                      <p className="text-xs text-muted-foreground">
                        Inserisci il link diretto alla piattaforma dove il cliente dovrà lavorare (Google Sheets, Google Docs, etc.)
                      </p>
                    </div>
                  )}

                  {/* Library Lesson - when library lesson is selected */}
                  {form.watch("useLibraryLesson") && (
                    <div className="space-y-2">
                      <LibraryDocumentTable
                        selectedDocumentId={form.watch("libraryDocumentId") || ""}
                        onDocumentSelect={(documentId) => form.setValue("libraryDocumentId", documentId)}
                      />
                    </div>
                  )}

                  {/* File Upload */}
                  <div className="space-y-2">
                    <Label>Allegati di supporto</Label>
                    <FileUpload
                      onFilesChange={setFiles}
                      maxFiles={5}
                      data-testid="file-upload-attachments"
                    />
                    <p className="text-xs text-muted-foreground">
                      Carica file PDF, immagini o documenti di supporto (max 5 file)
                    </p>
                  </div>

                  {/* Questions - only when questions is selected */}
                  {form.watch("useQuestions") && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Domande personalizzate</Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            Crea domande specifiche per valutare la comprensione
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addQuestion}
                          data-testid="button-add-question"
                        >
                          <Plus size={16} className="mr-1" />
                          Aggiungi Domanda
                        </Button>
                      </div>

                      {questions.map((question, index) => (
                        <Card key={question.id} className="p-4" data-testid={`question-${index}`}>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label>Domanda {index + 1}</Label>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeQuestion(question.id)}
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-remove-question-${index}`}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>

                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="md:col-span-2">
                                  <Input
                                    placeholder="Inserisci la domanda..."
                                    value={question.question}
                                    onChange={(e) => updateQuestion(question.id, "question", e.target.value)}
                                    data-testid={`input-question-text-${index}`}
                                  />
                                </div>
                                <Select
                                  value={question.type}
                                  onValueChange={(value: Question["type"]) => {
                                    // Update question with all necessary fields in one go
                                    setQuestions(questions.map(q => {
                                      if (q.id === question.id) {
                                        const updates: Partial<Question> = { type: value };

                                        // Initialize options for types that need them
                                        if ((value === "select" || value === "multiple_choice" || value === "multiple_answer")) {
                                          updates.options = q.options && q.options.length > 0 ? q.options : ["", "", "", ""];
                                        }

                                        // Initialize correctAnswers for auto-graded types
                                        if ((value === "true_false" || value === "multiple_choice" || value === "multiple_answer")) {
                                          updates.correctAnswers = q.correctAnswers || [];
                                        }

                                        return { ...q, ...updates };
                                      }
                                      return q;
                                    }));
                                  }}
                                  data-testid={`select-question-type-${index}`}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="text">📝 Testo libero</SelectItem>
                                    <SelectItem value="number">🔢 Numero</SelectItem>
                                    <SelectItem value="select">📋 Selezione</SelectItem>
                                    <Separator className="my-1" />
                                    <SelectItem value="true_false">✓✗ Vero/Falso</SelectItem>
                                    <SelectItem value="multiple_choice">◉ Scelta multipla</SelectItem>
                                    <SelectItem value="multiple_answer">☑ Risposta multipla</SelectItem>
                                    <SelectItem value="file_upload">📎 Caricamento file</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Points field for exam questions */}
                              {form.watch("isExam") && (
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Punti</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      placeholder="10"
                                      value={question.points || ""}
                                      onChange={(e) => updateQuestion(question.id, "points", e.target.value ? parseInt(e.target.value) : undefined)}
                                      data-testid={`input-question-points-${index}`}
                                      className="h-9"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Options for select type */}
                            {question.type === "select" && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm">Opzioni</Label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addOption(question.id)}
                                    data-testid={`button-add-option-${index}`}
                                  >
                                    <Plus size={14} className="mr-1" />
                                    Aggiungi Opzione
                                  </Button>
                                </div>
                                {question.options?.map((option, optIndex) => (
                                  <div key={optIndex} className="flex items-center space-x-2">
                                    <Input
                                      placeholder={`Opzione ${optIndex + 1}`}
                                      value={option}
                                      onChange={(e) => updateOption(question.id, optIndex, e.target.value)}
                                      data-testid={`input-option-${index}-${optIndex}`}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeOption(question.id, optIndex)}
                                      className="text-destructive hover:text-destructive"
                                      data-testid={`button-remove-option-${index}-${optIndex}`}
                                    >
                                      <Trash2 size={14} />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* True/False type */}
                            {question.type === "true_false" && (
                              <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                <Label className="text-sm">Risposta corretta</Label>
                                <div className="grid grid-cols-2 gap-3">
                                  <Button
                                    type="button"
                                    variant={question.correctAnswers?.[0] === "true" ? "default" : "outline"}
                                    className="w-full"
                                    onClick={() => updateQuestion(question.id, "correctAnswers", ["true"])}
                                    data-testid={`button-true-${index}`}
                                  >
                                    ✓ Vero
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={question.correctAnswers?.[0] === "false" ? "default" : "outline"}
                                    className="w-full"
                                    onClick={() => updateQuestion(question.id, "correctAnswers", ["false"])}
                                    data-testid={`button-false-${index}`}
                                  >
                                    ✗ Falso
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Multiple Choice type */}
                            {question.type === "multiple_choice" && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm">Opzioni (seleziona la risposta corretta)</Label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addOption(question.id)}
                                    data-testid={`button-add-option-${index}`}
                                  >
                                    <Plus size={14} className="mr-1" />
                                    Aggiungi Opzione
                                  </Button>
                                </div>

                                {/* Quick paste options */}
                                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
                                  <Label className="text-xs font-medium">Incolla opzioni formattate</Label>
                                  <Textarea
                                    placeholder="Incolla qui le opzioni. Es:&#10;A. Prima opzione&#10;B. Seconda opzione&#10;C. Terza opzione"
                                    value={pastedOptionsText[question.id] || ""}
                                    onChange={(e) => setPastedOptionsText(prev => ({ ...prev, [question.id]: e.target.value }))}
                                    rows={3}
                                    className="text-sm"
                                  />
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground">
                                      Supporta formati: A. B. C. / 1. 2. 3. / a) b) c) o righe separate
                                    </p>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => applyParsedOptions(question.id)}
                                      disabled={!pastedOptionsText[question.id]?.trim()}
                                    >
                                      Applica
                                    </Button>
                                  </div>
                                </div>

                                {question.options?.map((option, optIndex) => (
                                  <div key={optIndex} className="flex items-center space-x-2">
                                    <input
                                      type="radio"
                                      name={`correct-${question.id}`}
                                      checked={question.correctAnswers?.includes(option)}
                                      onChange={() => updateQuestion(question.id, "correctAnswers", [option])}
                                      className="w-4 h-4"
                                      data-testid={`radio-correct-${index}-${optIndex}`}
                                    />
                                    <Input
                                      placeholder={`Opzione ${optIndex + 1}`}
                                      value={option}
                                      onChange={(e) => updateOption(question.id, optIndex, e.target.value)}
                                      className={question.correctAnswers?.includes(option) ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""}
                                      data-testid={`input-option-${index}-${optIndex}`}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeOption(question.id, optIndex)}
                                      className="text-destructive hover:text-destructive"
                                      data-testid={`button-remove-option-${index}-${optIndex}`}
                                    >
                                      <Trash2 size={14} />
                                    </Button>
                                  </div>
                                ))}
                                {(!question.options || question.options.length < 2) && (
                                  <p className="text-xs text-amber-600 dark:text-amber-400">Aggiungi almeno 2 opzioni</p>
                                )}
                              </div>
                            )}

                            {/* Multiple Answer type */}
                            {question.type === "multiple_answer" && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm">Opzioni (seleziona tutte le risposte corrette)</Label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addOption(question.id)}
                                    data-testid={`button-add-option-${index}`}
                                  >
                                    <Plus size={14} className="mr-1" />
                                    Aggiungi Opzione
                                  </Button>
                                </div>

                                {/* Quick paste options */}
                                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
                                  <Label className="text-xs font-medium">Incolla opzioni formattate</Label>
                                  <Textarea
                                    placeholder="Incolla qui le opzioni. Es:&#10;A. Prima opzione&#10;B. Seconda opzione&#10;C. Terza opzione"
                                    value={pastedOptionsText[question.id] || ""}
                                    onChange={(e) => setPastedOptionsText(prev => ({ ...prev, [question.id]: e.target.value }))}
                                    rows={3}
                                    className="text-sm"
                                  />
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground">
                                      Supporta formati: A. B. C. / 1. 2. 3. / a) b) c) o righe separate
                                    </p>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => applyParsedOptions(question.id)}
                                      disabled={!pastedOptionsText[question.id]?.trim()}
                                    >
                                      Applica
                                    </Button>
                                  </div>
                                </div>

                                {question.options?.map((option, optIndex) => (
                                  <div key={optIndex} className="flex items-center space-x-2">
                                    <Checkbox
                                      checked={question.correctAnswers?.includes(option) || false}
                                      onCheckedChange={(checked) => {
                                        const currentCorrect = question.correctAnswers || [];
                                        const newCorrect = checked
                                          ? [...currentCorrect, option]
                                          : currentCorrect.filter(a => a !== option);
                                        updateQuestion(question.id, "correctAnswers", newCorrect);
                                      }}
                                      data-testid={`checkbox-correct-${index}-${optIndex}`}
                                    />
                                    <Input
                                      placeholder={`Opzione ${optIndex + 1}`}
                                      value={option}
                                      onChange={(e) => updateOption(question.id, optIndex, e.target.value)}
                                      className={question.correctAnswers?.includes(option) ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""}
                                      data-testid={`input-option-${index}-${optIndex}`}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeOption(question.id, optIndex)}
                                      className="text-destructive hover:text-destructive"
                                      data-testid={`button-remove-option-${index}-${optIndex}`}
                                    >
                                      <Trash2 size={14} />
                                    </Button>
                                  </div>
                                ))}
                                {(!question.correctAnswers || question.correctAnswers.length === 0) && (
                                  <p className="text-xs text-amber-600 dark:text-amber-400">Seleziona almeno una risposta corretta</p>
                                )}
                              </div>
                            )}

                            {/* File Upload type */}
                            {question.type === "file_upload" && (
                              <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                <div className="flex items-center space-x-2 text-sm text-purple-700 dark:text-purple-300">
                                  <AlertCircle size={16} />
                                  <span>Il cliente dovrà caricare un file come risposta a questa domanda</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="settings" className="space-y-6">
                  {/* Scoring Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Impostazioni Valutazione</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="maxScore">Punteggio massimo</Label>
                          <Input
                            id="maxScore"
                            type="number"
                            {...form.register("maxScore", { valueAsNumber: true })}
                            placeholder="100"
                            data-testid="input-max-score"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="passingScore">Punteggio minimo per superare</Label>
                          <Input
                            id="passingScore"
                            type="number"
                            {...form.register("passingScore", { valueAsNumber: true })}
                            placeholder="60"
                            data-testid="input-passing-score"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="timeLimit">Limite di tempo (minuti)</Label>
                        <Input
                          id="timeLimit"
                          type="number"
                          {...form.register("timeLimit", { valueAsNumber: true })}
                          placeholder="60"
                          data-testid="input-time-limit"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Behavior Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Comportamento Esercizio</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Permetti tentativi multipli</Label>
                          <p className="text-xs text-muted-foreground">
                            I clienti possono ripetere l'esercizio
                          </p>
                        </div>
                        <Switch
                          checked={form.watch("allowRetries")}
                          onCheckedChange={(checked) => form.setValue("allowRetries", checked)}
                          data-testid="switch-allow-retries"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Mostra barra di progresso</Label>
                          <p className="text-xs text-muted-foreground">
                            Visualizza il progresso durante l'esercizio
                          </p>
                        </div>
                        <Switch
                          checked={form.watch("showProgressBar")}
                          onCheckedChange={(checked) => form.setValue("showProgressBar", checked)}
                          data-testid="switch-progress-bar"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Randomizza ordine domande</Label>
                          <p className="text-xs text-muted-foreground">
                            Mostra le domande in ordine casuale
                          </p>
                        </div>
                        <Switch
                          checked={form.watch("randomizeQuestions")}
                          onCheckedChange={(checked) => form.setValue("randomizeQuestions", checked)}
                          data-testid="switch-randomize"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Exam Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Impostazioni Esame</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Questo è un esame</Label>
                          <p className="text-xs text-muted-foreground">
                            Gli esami appariranno nella sezione Università invece che negli esercizi normali
                          </p>
                        </div>
                        <Switch
                          checked={form.watch("isExam")}
                          onCheckedChange={(checked) => form.setValue("isExam", checked)}
                          data-testid="switch-is-exam"
                        />
                      </div>

                      {form.watch("isExam") && (
                        <div className="space-y-4 pl-4 border-l-2 border-primary/30">
                          {selectedClientIds.length === 0 && !form.watch("isPublic") && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                              <div className="flex items-start space-x-2">
                                <AlertCircle size={16} className="text-blue-600 mt-0.5" />
                                <div className="text-sm text-blue-700 dark:text-blue-300">
                                  <strong>Suggerimento:</strong> Vai alla tab "Clienti" e seleziona almeno un cliente per filtrare gli anni universitari disponibili.
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="yearId">Anno Universitario *</Label>
                              <Select
                                value={form.watch("yearId") || undefined}
                                onValueChange={(value) => {
                                  form.setValue("yearId", value);
                                  form.setValue("trimesterId", undefined); // Reset trimester when year changes
                                }}
                                data-testid="select-year"
                                disabled={selectedClientIds.length === 0 && !form.watch("isPublic")}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={selectedClientIds.length === 0 && !form.watch("isPublic") ? "Seleziona prima i clienti" : "Seleziona anno"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {universityYears.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground">
                                      {selectedClientIds.length > 0
                                        ? "Nessun anno assegnato ai clienti selezionati"
                                        : "Seleziona clienti per vedere gli anni disponibili"}
                                    </div>
                                  ) : (
                                    universityYears.map((year: any) => (
                                      <SelectItem key={year.id} value={year.id}>
                                        {year.title}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              {selectedClientIds.length > 0 && universityYears.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  Mostrando {universityYears.length} {universityYears.length === 1 ? 'anno' : 'anni'} assegnati ai clienti selezionati
                                </p>
                              )}
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="trimesterId">Trimestre (opzionale)</Label>
                              <Select
                                value={form.watch("trimesterId") || undefined}
                                onValueChange={(value) => form.setValue("trimesterId", value === "all-year" ? undefined : value)}
                                disabled={!form.watch("yearId")}
                                data-testid="select-trimester"
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Tutto l'anno" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all-year">
                                    📚 Tutto l'anno
                                  </SelectItem>
                                  <Separator className="my-1" />
                                  {universityTrimesters.map((trimester: any) => (
                                    <SelectItem key={trimester.id} value={trimester.id}>
                                      {trimester.title}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                {form.watch("trimesterId")
                                  ? "Esame specifico per il trimestre selezionato"
                                  : "Se non selezioni un trimestre, l'esame vale per tutto l'anno"}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="examDate">Data Esame</Label>
                            <Input
                              id="examDate"
                              type="datetime-local"
                              {...form.register("examDate")}
                              data-testid="input-exam-date"
                            />
                            <p className="text-xs text-muted-foreground">
                              Quando si terrà l'esame
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="examTimeLimit">Tempo Limite Esame (minuti)</Label>
                            <Input
                              id="examTimeLimit"
                              type="number"
                              {...form.register("examTimeLimit", { valueAsNumber: true })}
                              placeholder="90"
                              data-testid="input-exam-time-limit"
                            />
                            <p className="text-xs text-muted-foreground">
                              Tempo massimo per completare l'esame (lascia vuoto se non c'è limite)
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="totalPoints">Punteggio Totale</Label>
                            <Input
                              id="totalPoints"
                              type="number"
                              {...form.register("totalPoints", { valueAsNumber: true })}
                              placeholder="100"
                              data-testid="input-total-points"
                            />
                            <p className="text-xs text-muted-foreground">
                              Punteggio massimo per l'esame
                            </p>
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Correzione Automatica</Label>
                              <p className="text-xs text-muted-foreground">
                                Le domande a scelta multipla e vero/falso verranno corrette automaticamente
                              </p>
                            </div>
                            <Switch
                              checked={form.watch("autoCorrect")}
                              onCheckedChange={(checked) => form.setValue("autoCorrect", checked)}
                              data-testid="switch-auto-correct"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Template Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Salva come Template</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Salva come template riutilizzabile</Label>
                          <p className="text-xs text-muted-foreground">
                            Potrai riutilizzare questo esercizio in futuro
                          </p>
                        </div>
                        <Switch
                          checked={saveAsTemplate}
                          onCheckedChange={setSaveAsTemplate}
                          data-testid="switch-save-template"
                        />
                      </div>

                      {saveAsTemplate && (
                        <div className="space-y-4 pl-4 border-l-2 border-muted">
                          <div className="space-y-2">
                            <Label htmlFor="templateName">Nome template</Label>
                            <Input
                              id="templateName"
                              value={templateName}
                              onChange={(e) => setTemplateName(e.target.value)}
                              placeholder="Nome del template..."
                              data-testid="input-template-name"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Template pubblico</Label>
                              <p className="text-xs text-muted-foreground">
                                Altri consulenti possono utilizzarlo
                              </p>
                            </div>
                            <Switch
                              checked={templateIsPublic}
                              onCheckedChange={setTemplateIsPublic}
                              data-testid="switch-public-template"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="clients" className="space-y-6">

                  {/* Assignment Type Selection */}
                  <div className="space-y-4">
                    <div>
                      <Label>Tipo di Assegnazione *</Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Scegli se assegnare l'esercizio a clienti specifici o renderlo pubblico per tutti
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={`p-4 border-2 rounded-lg transition-all cursor-pointer ${!form.watch("isPublic") ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"}`}
                        onClick={() => form.setValue("isPublic", false)}>
                        <div className="flex items-center space-x-3 mb-2">
                          <input
                            type="radio"
                            checked={!form.watch("isPublic")}
                            onChange={() => form.setValue("isPublic", false)}
                            className="w-4 h-4"
                          />
                          <Label className="font-medium cursor-pointer">
                            Assegnazione Specifica
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-7">
                          Assegna l'esercizio solo ai clienti selezionati
                        </p>
                      </div>

                      <div className={`p-4 border-2 rounded-lg transition-all cursor-pointer ${form.watch("isPublic") ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"}`}
                        onClick={() => form.setValue("isPublic", true)}>
                        <div className="flex items-center space-x-3 mb-2">
                          <input
                            type="radio"
                            checked={form.watch("isPublic")}
                            onChange={() => form.setValue("isPublic", true)}
                            className="w-4 h-4"
                          />
                          <Label className="font-medium cursor-pointer">
                            Esercizio Pubblico
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-7">
                          Tutti i clienti potranno vedere e completare questo esercizio
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Client Selection - only shown when not public */}
                  {!form.watch("isPublic") && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="selectedClients">Assegna ai clienti *</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Seleziona i clienti che dovranno completare questo esercizio
                        </p>
                      </div>

                      <ClientSelector
                        selectedClients={form.watch("selectedClients") || []}
                        onClientsChange={(clients) => form.setValue("selectedClients", clients)}
                        templateData={templateData}
                        existingAssignments={existingAssignments}
                        existingExercise={existingExercise}
                        showPlatformLinks={form.watch("usePlatform") === true}
                        customPlatformLinks={customPlatformLinks}
                        onPlatformLinkChange={(clientId, link) => {
                          setCustomPlatformLinks(prev => ({
                            ...prev,
                            [clientId]: link
                          }));
                        }}
                      />

                      {form.formState.errors.selectedClients && (
                        <p className="text-sm text-destructive">{form.formState.errors.selectedClients.message}</p>
                      )}

                      {(form.watch("selectedClients") || []).length > 0 && (
                        <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <AlertCircle size={16} className="text-muted-foreground" />
                            <span className="text-sm font-medium">Riepilogo Assegnazione</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            L'esercizio verrà assegnato a <strong>{(form.watch("selectedClients") || []).length}</strong> clienti.
                            {form.watch("dueDate") && (
                              <> Scadenza: <strong>{new Date(form.watch("dueDate")!).toLocaleDateString('it-IT')}</strong></>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Public Exercise Summary */}
                  {form.watch("isPublic") && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border border-blue-100 dark:border-blue-800">
                      <div className="flex items-center space-x-2 mb-2">
                        <Globe size={16} className="text-blue-600" />
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Esercizio Pubblico</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Questo esercizio sarà disponibile nella sezione <strong>"Esercizi Pubblici"</strong> per tutti i clienti registrati.
                        Potranno accedervi liberamente e completarlo quando desiderano.
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Actions */}
                <div className="flex justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    data-testid="button-cancel"
                    className="px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <X size={16} className="mr-2" />
                    Annulla
                  </Button>

                  <div className="flex space-x-3">
                    {saveAsTemplate && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSaveAsTemplate}
                        disabled={isLoading || !templateName.trim()}
                        data-testid="button-save-template"
                        className="px-6 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <Save size={16} className="mr-2" />
                        Salva Template
                      </Button>
                    )}

                    <Button
                      type="submit"
                      disabled={isLoading}
                      data-testid="button-submit"
                      onClick={(e) => {
                        console.log('🖱️ SUBMIT BUTTON CLICKED', {
                          timestamp: new Date().toISOString(),
                          isEditing: !!existingExercise,
                          exerciseId: existingExercise?.id,
                          isLoading,
                          formValues: {
                            title: form.getValues('title'),
                            category: form.getValues('category'),
                            selectedClients: form.getValues('selectedClients'),
                            isPublic: form.getValues('isPublic'),
                            useQuestions: form.getValues('useQuestions'),
                            usePlatform: form.getValues('usePlatform'),
                            useLibraryLesson: form.getValues('useLibraryLesson'),
                            libraryDocumentId: form.getValues('libraryDocumentId')
                          }
                        });
                      }}
                      className="px-8 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      <Sparkles size={16} className="mr-2" />
                      {isLoading
                        ? existingExercise ? "Aggiornamento..." : "Creazione..."
                        : existingExercise
                          ? "Aggiorna Esercizio"
                          : form.watch("isPublic")
                            ? "Crea Esercizio Pubblico"
                            : "Crea e Assegna Esercizio"
                      }
                    </Button>
                  </div>
                </div>
              </form>
            </Tabs>
          </div>

          {showPreview && (
            <div className="lg:sticky lg:top-6">
              <ExercisePreview />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}