import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  Save,
  AlertCircle,
  Eye,
  EyeOff,
  Info,
  Calendar,
  User,
  FileText,
  Send,
  Download,
  ImageIcon,
  BookOpen,
  MessageSquare,
  Star,
  XCircle,
  X,
  RefreshCcw,
  Award,
  Play,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Navbar from "@/components/navbar";
import FileUpload from "@/components/file-upload";
import { getAuthHeaders, getAuthUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { type Exercise, type ExerciseAssignment } from "@shared/schema";
import { useActivityTracker } from "@/hooks/use-activity-tracker";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { usePageContext } from "@/hooks/use-page-context";

export default function ExerciseDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [reviewForm, setReviewForm] = useState({ score: '', feedback: '', action: 'complete' });
  // State to track if the work platform has been confirmed
  const [workPlatformCompleted, setWorkPlatformCompleted] = useState(false);
  // State to track if the library lesson has been completed
  const [libraryLessonCompleted, setLibraryLessonCompleted] = useState(false);
  // State for managing expanded feedback and notes
  const [expandedFeedback, setExpandedFeedback] = useState<{[key: string]: boolean}>({});
  const [expandedNotes, setExpandedNotes] = useState<{[key: string]: boolean}>({});
  // Track last saved state to avoid unnecessary saves
  const [lastSavedAnswers, setLastSavedAnswers] = useState<Record<string, string>>({});
  const [lastSavedNotes, setLastSavedNotes] = useState<string>("");
  // Debounce timer ref for auto-save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // State for manual question grading (consultant side)
  const [questionGrades, setQuestionGrades] = useState<Record<string, number>>({});
  // State to manage layout version for work platform
  const [layoutVersion, setLayoutVersion] = useState<1 | 2 | 3>(2); // Default to V2 Timeline
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = getAuthUser();
  const { logActivity } = useActivityTracker();

  // Helper function to truncate text
  const truncateText = (text: string, limit: number = 150) => {
    if (!text) return '';
    return text.length > limit ? text.substring(0, limit) + '...' : text;
  };

  // Helper function to determine if text should be expandable
  const isTextLong = (text: string, limit: number = 200) => {
    return text && text.length > limit;
  };

  // Helper function to safely format dates
  const formatDate = (dateValue: string | Date | null | undefined) => {
    if (!dateValue) return 'Data non disponibile';

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return 'Data non valida';

    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Component for expandable text
  const ExpandableText = ({ text, id, isExpanded, onToggle, type = 'feedback' }: {
    text: string;
    id: string;
    isExpanded: boolean;
    onToggle: () => void;
    type?: 'feedback' | 'notes';
  }) => {
    const shouldExpand = isTextLong(text);

    if (!shouldExpand) {
      return <p className="text-sm whitespace-pre-wrap">{text}</p>;
    }

    return (
      <div className="space-y-2">
        <p className="text-sm whitespace-pre-wrap">
          {isExpanded ? text : truncateText(text, 200)}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={14} className="mr-1" />
              Mostra meno
            </>
          ) : (
            <>
              <ChevronDown size={14} className="mr-1" />
              Mostra tutto
            </>
          )}
        </Button>
      </div>
    );
  };

  // Get assignment ID from URL params if present
  const urlParams = new URLSearchParams(window.location.search);
  const assignmentId = urlParams.get('assignment');

  // Draft mutation for auto-saving
  const saveDraftMutation = useMutation({
    mutationFn: async (draftData: { assignmentId: string, answers: Record<string, string>, notes?: string }) => {
      // Transform answers from Record<string, string> to Array<{questionId, answer}>
      const answersArray = Object.entries(draftData.answers).map(([questionId, answer]) => ({
        questionId,
        answer
      }));

      const response = await fetch("/api/exercise-submissions/draft", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          assignmentId: draftData.assignmentId,
          answers: answersArray,
          notes: draftData.notes
        })
      });

      if (!response.ok) {
        const error = new Error("Failed to save draft") as any;
        error.status = response.status;
        error.statusText = response.statusText;
        throw error;
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Update last saved state after successful save
      setLastSavedAnswers({ ...variables.answers });
      setLastSavedNotes(variables.notes || "");
      console.log('Draft saved successfully, updated tracking state');

      // CRITICAL: Invalidate the draft cache after successful save
      // This ensures when user returns to the page, fresh data is loaded from database
      queryClient.invalidateQueries({
        queryKey: ["/api/exercise-submissions/draft", variables.assignmentId]
      });
    },
    onError: (error: any) => {
      // Handle different types of errors
      if (error.status === 403 || error.status === 404) {
        // Access denied or assignment not found - disable auto-save and clear pending timeouts to prevent spam
        console.warn(`Assignment ${error.status === 403 ? 'access denied' : 'not found'} - disabling auto-save`);
        setAutoSaveEnabled(false);

        // Clear any pending save timeout immediately
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
      } else {
        // Other errors - silent fail for auto-save, don't annoy users
        console.error("Draft save failed:", error.message || error);
      }
    }
  });

  // Fetch assignment details first
  const { data: assignment, isLoading: assignmentLoading, error: assignmentError } = useQuery({
    queryKey: ["/api/exercise-assignments", assignmentId],
    queryFn: async () => {
      if (!assignmentId) return null;
      const response = await fetch(`/api/exercise-assignments/${assignmentId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        // If assignment doesn't exist, disable auto-save
        console.warn(`Assignment ${assignmentId} not found (${response.status}), disabling auto-save`);
        setAutoSaveEnabled(false);
        throw new Error("Assignment not found");
      }
      const assignmentData = await response.json();

      // Fetch consultant data if not included
      if (assignmentData.consultantId && !assignmentData.consultant) {
        const consultantResponse = await fetch(`/api/consultants`, {
          headers: getAuthHeaders(),
        });
        if (consultantResponse.ok) {
          const consultants = await consultantResponse.json();
          const consultant = consultants.find((c: any) => c.id === assignmentData.consultantId);
          if (consultant) {
            assignmentData.consultant = consultant;
          }
        }
      }

      return assignmentData;
    },
    enabled: !!assignmentId,
  });

  // Query for loading existing draft OR last submission for returned exercises
  const { data: existingDraft, isLoading: isDraftLoading, error: draftError } = useQuery({
    queryKey: ["/api/exercise-submissions/draft", assignmentId, assignment?.status],
    enabled: !!assignmentId && !!user && !!assignment,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnMount: false, // Only refetch if data is stale
    refetchOnWindowFocus: false, // Don't refetch on window focus
    queryFn: async () => {
      console.log('🔍 DRAFT RECOVERY START:', {
        assignmentId,
        userId: user?.id,
        assignmentStatus: assignment?.status,
        timestamp: new Date().toISOString()
      });

      try {
        // First try to get a draft (work in progress)
        console.log('📡 Fetching draft from:', `/api/exercise-submissions/draft/${assignmentId}`);

        const draftResponse = await fetch(`/api/exercise-submissions/draft/${assignmentId}`, {
          headers: getAuthHeaders()
        });

        console.log('📥 Draft response:', {
          status: draftResponse.status,
          statusText: draftResponse.statusText,
          ok: draftResponse.ok
        });

        // If access denied (403), disable auto-save - but NOT for 404!
        // 404 on draft endpoint just means "no draft saved yet" which is normal
        if (draftResponse.status === 403) {
          console.warn('Assignment access denied (403) - disabling auto-save');
          setAutoSaveEnabled(false);
        } else if (draftResponse.status === 404) {
          // 404 is normal - it just means no draft exists yet, auto-save should stay enabled
          console.log('ℹ️ No existing draft found for assignment:', assignmentId, '- this is normal, auto-save remains enabled');
        }

        if (draftResponse.ok) {
          const draftData = await draftResponse.json();
          console.log('✅ Draft found and parsed:', {
            id: draftData.id,
            assignmentId: draftData.assignmentId,
            answersCount: draftData.answers?.length || 0,
            answersContent: draftData.answers,
            notesLength: draftData.notes?.length || 0,
            submittedAt: draftData.submittedAt,
            createdAt: draftData.createdAt,
            updatedAt: draftData.updatedAt
          });
          return draftData;
        }

        console.log('❌ No draft found, status:', draftResponse.status);

        // If no draft found and assignment is returned, get last submission
        if (draftResponse.status === 404 && assignment?.status === 'returned') {
          console.log('🔄 Assignment is returned, trying to get last submission...');

          const submissionResponse = await fetch(`/api/exercise-submissions/assignment/${assignmentId}`, {
            headers: getAuthHeaders()
          });

          console.log('📥 Submission response:', {
            status: submissionResponse.status,
            statusText: submissionResponse.statusText,
            ok: submissionResponse.ok
          });

          if (submissionResponse.ok) {
            const submissionData = await submissionResponse.json();
            console.log('✅ Last submission found:', {
              id: submissionData.id,
              assignmentId: submissionData.assignmentId,
              answersCount: submissionData.answers?.length || 0,
              answersContent: submissionData.answers,
              notesLength: submissionData.notes?.length || 0,
              submittedAt: submissionData.submittedAt
            });
            return submissionData;
          }
        }

        console.log('❌ No draft or submission found');
        return null; // No draft or submission found
      } catch (error) {
        console.error('💥 Error in draft recovery:', error);
        throw error;
      }
    }
  });

  const form = useForm({
    defaultValues: {
      answers: {} as Record<string, string>,
      notes: "",
    },
  });

  // Fetch exercise details  
  const { data: exercise, isLoading: exerciseLoading } = useQuery({
    queryKey: ["/api/exercises", id],
    queryFn: async () => {
      const response = await fetch(`/api/exercises/${id}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch exercise");
      return response.json();
    },
    enabled: !!id,
    onSuccess: (data) => {
      // Set default layout version based on exercise data or user preference if available
      // For now, let's default to 1 and allow manual switching later.
      // If you have a way to persist user choice, integrate it here.
      setLayoutVersion(1); // Default to version 1
    }
  });

  // Fetch library lesson if exercise has a linked library document
  const { data: libraryLesson, isLoading: libraryLessonLoading } = useQuery({
    queryKey: ["/api/library/documents", exercise?.libraryDocumentId],
    queryFn: async () => {
      if (!exercise?.libraryDocumentId) return null;
      const response = await fetch(`/api/library/documents/${exercise.libraryDocumentId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch library lesson");
      return response.json();
    },
    enabled: !!(exercise?.libraryDocumentId && exercise.libraryDocumentId.trim() !== ''),
  });

  // Log exercise view when component mounts (only once)
  const hasLoggedView = useRef(false);
  useEffect(() => {
    if (exercise && !hasLoggedView.current) {
      logActivity('exercise_view', { exerciseId: exercise.id, exerciseTitle: exercise.title });
      hasLoggedView.current = true;
    }
  }, [exercise, logActivity, id]);

  // Log exercise start when user begins working
  const hasLoggedStartRef = useRef(false);
  const hasLoggedStart = useCallback(() => {
    if (exercise && !hasLoggedStartRef.current) {
      logActivity('exercise_start', {
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        assignmentId: id
      });
      hasLoggedStartRef.current = true;
    }
  }, [exercise, logActivity, id]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive]);

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Reset auto-save enabled when assignment changes or when status is valid (prevents sticky disabled state)
  useEffect(() => {
    // Always re-enable auto-save when assignment changes
    setAutoSaveEnabled(true);
  }, [assignmentId, user?.id, assignment?.status]);

  // Determine submission capabilities early
  const isCompleted = assignment?.status === 'completed';
  const isSubmitted = assignment?.status === 'submitted';
  const isRejected = assignment?.status === 'rejected';
  const isReturned = assignment?.status === 'returned';
  const canSubmit = user?.role === 'client' && assignmentId && !isCompleted && !isSubmitted && (assignment?.status === 'pending' || assignment?.status === 'in_progress' || assignment?.status === 'returned');

  // Debounced save function to avoid excessive API calls
  const debouncedSave = useCallback((answers: Record<string, string>, notes: string) => {
    // Check if auto-save is enabled (can be disabled due to 403/404 errors)
    if (!autoSaveEnabled) {
      console.warn('Auto-save disabled, skipping save');
      return;
    }

    // Additional check: if assignment doesn't exist, don't save
    if (!assignment) {
      console.warn('No assignment found, skipping auto-save');
      return;
    }

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for 2 seconds
    saveTimeoutRef.current = setTimeout(() => {
      // Double-check auto-save is still enabled before executing (prevents race conditions)
      if (!autoSaveEnabled) {
        console.warn('Auto-save disabled, canceling scheduled save');
        return;
      }

      // Double-check assignment still exists
      if (!assignment) {
        console.warn('Assignment no longer exists, canceling scheduled save');
        return;
      }

      console.log('Executing debounced save...');
      saveDraftMutation.mutate({
        assignmentId: assignmentId!,
        answers,
        notes
      });
    }, 2000);
  }, [assignmentId, assignment, saveDraftMutation, autoSaveEnabled]);

  // Save when changing question
  const saveOnQuestionChange = useCallback(() => {
    // Check if assignment status allows draft saving (must match backend validation)
    const allowedStatuses = ['pending', 'in_progress', 'returned'];
    const canSaveDraft = assignmentId && assignment && allowedStatuses.includes(assignment.status) && canSubmit;
    
    if (canSaveDraft) {
      const answers = form.getValues("answers");
      const notes = form.getValues("notes") || "";

      // Check if there are actual changes compared to last saved state
      const answersChanged = JSON.stringify(answers) !== JSON.stringify(lastSavedAnswers);
      const notesChanged = notes.trim() !== lastSavedNotes.trim();

      console.log('Auto-save check:', {
        answersChanged,
        notesChanged,
        currentAnswersCount: Object.keys(answers).length,
        lastSavedAnswersCount: Object.keys(lastSavedAnswers).length,
        currentNotesLength: notes.length,
        lastSavedNotesLength: lastSavedNotes.length,
        assignmentStatus: assignment.status
      });

      // Only save if there are real changes and actual content
      if ((answersChanged || notesChanged) && (Object.keys(answers).length > 0 || notes.trim())) {
        console.log('Scheduling debounced save...');
        debouncedSave(answers, notes);
      } else {
        console.log('No changes detected, skipping save');
      }
    } else {
      console.log('Cannot save draft - status not allowed or missing assignment:', {
        assignmentId: !!assignmentId,
        hasAssignment: !!assignment,
        status: assignment?.status,
        canSubmit
      });
    }
  }, [assignmentId, assignment, canSubmit, form, debouncedSave, lastSavedAnswers, lastSavedNotes]);

  // Load saved draft or previous submission from database
  useEffect(() => {
    console.log('🔄 FORM LOADING EFFECT TRIGGERED:', {
      hasExistingDraft: !!existingDraft,
      assignmentId,
      isDraftLoading,
      draftError: draftError?.message,
      timestamp: new Date().toISOString()
    });

    if (existingDraft && assignmentId) {
      try {
        console.log('📝 Processing draft data for form loading:', {
          existingDraft,
          answersRaw: existingDraft.answers,
          answersType: typeof existingDraft.answers,
          answersIsArray: Array.isArray(existingDraft.answers),
          notesRaw: existingDraft.notes
        });

        // Transform answers from Array<{questionId, answer}> to Record<string, string>
        let answersRecord: Record<string, string> = {};

        if (existingDraft.answers && Array.isArray(existingDraft.answers)) {
          answersRecord = existingDraft.answers.reduce((acc: Record<string, string>, item: {questionId: string, answer: string}) => {
            if (item && item.questionId && item.answer !== undefined) {
              acc[item.questionId] = item.answer;
              console.log('✅ Loaded answer:', { questionId: item.questionId, answer: item.answer });
            } else {
              console.log('⚠️ Skipping invalid answer item:', item);
            }
            return acc;
          }, {});
        } else {
          console.log('⚠️ Answers is not an array or is missing:', existingDraft.answers);
        }

        const notes = existingDraft.notes || "";

        console.log('📋 Setting form values:', {
          answersRecord,
          answersCount: Object.keys(answersRecord).length,
          notes,
          notesLength: notes.length
        });

        // Set form values
        form.setValue("answers", answersRecord);
        form.setValue("notes", notes);

        // Initialize tracking state with loaded data
        setLastSavedAnswers({ ...answersRecord });
        setLastSavedNotes(notes);

        console.log('✅ Draft loaded from database successfully:', {
          answersCount: Object.keys(answersRecord).length,
          notesLength: notes.length,
          trackingStateUpdated: true
        });

        // Check if form actually received the values
        setTimeout(() => {
          const formAnswers = form.getValues("answers");
          const formNotes = form.getValues("notes");
          console.log('🔍 Form values verification after setting:', {
            formAnswers,
            formAnswersCount: Object.keys(formAnswers || {}).length,
            formNotes,
            formNotesLength: formNotes?.length || 0
          });
        }, 100);

        // Don't restore UI state like currentQuestionIndex - let user navigate naturally

        // Draft loaded silently - no need to show toast
      } catch (error) {
        console.error("💥 Error loading draft progress:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          existingDraft
        });
        toast({
          title: "Errore nel caricamento",
          description: "Si è verificato un errore nel caricamento delle tue risposte precedenti",
          variant: "destructive",
        });
      }
    } else if (!existingDraft && !isDraftLoading && assignmentId) {
      console.log('ℹ️ No existing draft found for assignment:', assignmentId);
    }
  }, [existingDraft, assignmentId, form, toast, isDraftLoading, draftError]);

  // Get complete revision history
  const { data: revisionHistory } = useQuery({
    queryKey: [`/api/exercise-assignments/${assignmentId}/revision-history`],
    queryFn: async () => {
      if (!assignmentId) return [];
      const response = await fetch(`/api/exercise-assignments/${assignmentId}/revision-history`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!assignmentId,
  });

  // Get exercise submission for consultants to review
  const { data: submission } = useQuery({
    queryKey: [`/api/exercise-submissions/${assignmentId}`],
    queryFn: async () => {
      if (!assignmentId || user?.role !== 'consultant') return null;
      const response = await fetch(`/api/exercise-submissions/assignment/${assignmentId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return null; // No submission yet
        throw new Error("Failed to fetch submission");
      }
      return response.json();
    },
    enabled: !!assignmentId && user?.role === 'consultant',
  });

  // Define canReview after submission is loaded to avoid TDZ
  const canReview = user?.role === 'consultant' && isSubmitted && submission && !isRejected;

  // Pre-populate question grades with auto-graded scores when submission loads (for consultants)
  useEffect(() => {
    if (!submission || !exercise?.questions || user?.role !== 'consultant') return;
    
    // Calculate grades for each question based on submission answers
    const calculatedGrades: Record<string, number> = {};
    
    exercise.questions.forEach((question: any) => {
      const answer = submission.answers?.find((a: any) => a.questionId === question.id);
      const questionPoints = question.points || 1;
      
      // Auto-grade specific question types
      if (question.type === 'true_false' || question.type === 'multiple_choice' || question.type === 'multiple_answer') {
        if (!answer) {
          // No answer provided - 0 points
          calculatedGrades[question.id] = 0;
        } else {
          let isCorrect = false;
          
          if (question.type === 'true_false') {
            // Normalize both answers for comparison
            let studentAnswer = String(answer.answer).toLowerCase();
            if (studentAnswer === 'vero') studentAnswer = 'true';
            if (studentAnswer === 'falso') studentAnswer = 'false';
            
            const normalizedCorrectAnswers = question.correctAnswers?.map((ca: string) => {
              let normalized = String(ca).toLowerCase();
              if (normalized === 'vero') normalized = 'true';
              if (normalized === 'falso') normalized = 'false';
              return normalized;
            }) || [];
            
            isCorrect = normalizedCorrectAnswers.includes(studentAnswer);
          } else if (question.type === 'multiple_choice') {
            const studentAnswer = typeof answer.answer === 'string' ? answer.answer : String(answer.answer);
            isCorrect = question.correctAnswers?.includes(studentAnswer) || false;
          } else if (question.type === 'multiple_answer') {
            const studentAnswers = Array.isArray(answer.answer) ? answer.answer : [answer.answer];
            const correctAnswers = question.correctAnswers || [];
            isCorrect = studentAnswers.length === correctAnswers.length &&
                       correctAnswers.every((ca: string) => studentAnswers.includes(ca)) &&
                       studentAnswers.every((sa: string) => correctAnswers.includes(sa));
          }
          
          calculatedGrades[question.id] = isCorrect ? questionPoints : 0;
        }
      }
      // For manual questions, leave them at 0 unless the consultant has already graded them
    });
    
    // Only set if we have calculated grades and questionGrades is empty
    if (Object.keys(calculatedGrades).length > 0 && Object.keys(questionGrades).length === 0) {
      setQuestionGrades(calculatedGrades);
    }
  }, [submission, exercise, user, questionGrades]);

  // Get all submissions for this assignment to show complete history
  const { data: allSubmissions } = useQuery({
    queryKey: [`/api/exercise-submissions/all/${assignmentId}`],
    queryFn: async () => {
      if (!assignmentId) return [];
      const response = await fetch(`/api/exercise-submissions/assignment/${assignmentId}/all`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error("Failed to fetch all submissions");
      }
      return response.json();
    },
    enabled: !!assignmentId,
  });

  // Submit exercise mutation
  const submitExerciseMutation = useMutation({
    mutationFn: async (data: any) => {
      const formData = new FormData();
      formData.append('assignmentId', assignmentId || '');
      formData.append('answers', JSON.stringify(data.answers));
      formData.append('notes', data.notes);

      // Add files
      submissionFiles.forEach(file => {
        formData.append('attachments', file);
      });

      const response = await fetch("/api/exercise-submissions", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to submit exercise");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-assignments/client"] });
      // Draft will be superseded by final submission - no need to explicitly clear
      toast({
        title: "Esercizio completato!",
        description: "La tua risposta è stata inviata con successo",
      });

      // Redirect back to appropriate dashboard
      if (user?.role === 'client') {
        setLocation('/client');
      } else {
        setLocation('/consultant');
      }
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'invio della risposta",
        variant: "destructive",
      });
    }
  });

  // Calculate total auto-grading score based on question grades
  const calculateTotalAutoGrading = () => {
    if (!exercise?.questions || exercise.questions.length === 0) return 0;
    
    let totalScore = 0;
    const totalMaxScore = exercise.questions.reduce((sum: number, q: any) => sum + (q.points || 1), 0);
    
    // Sum up all question grades
    exercise.questions.forEach((question: any) => {
      const grade = questionGrades[question.id];
      if (grade !== undefined) {
        totalScore += grade;
      }
    });
    
    // Convert to 0-100 scale based on exercise.totalPoints (default 100)
    const targetScale = exercise.totalPoints || 100;
    return totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * targetScale) : 0;
  };

  // Review assignment mutation for consultants
  const reviewMutation = useMutation({
    mutationFn: async ({ assignmentId, action, score, feedback, questionGrades: grades }: {
      assignmentId: string,
      action: 'complete' | 'return',
      score?: number,
      feedback: string,
      questionGrades?: Array<{questionId: string; score: number; maxScore: number}>
    }) => {
      const endpoint = action === 'complete'
        ? `/api/exercise-assignments/${assignmentId}/review`
        : `/api/exercise-assignments/${assignmentId}/return`;

      const body = action === 'complete'
        ? { score, feedback, questionGrades: grades }
        : { feedback };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to review assignment");
      }
      return response.json();
    },
    onSuccess: async (data, variables) => {
      // Invalidate relevant queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ["/api/exercise-assignments/consultant"] });
      await queryClient.invalidateQueries({ queryKey: [`/api/exercise-assignments/${assignmentId}`] });
      await queryClient.invalidateQueries({ queryKey: [`/api/exercise-submissions/${assignmentId}`] });
      await queryClient.invalidateQueries({ queryKey: [`/api/exercise-submissions/all/${assignmentId}`] });
      await queryClient.invalidateQueries({ queryKey: [`/api/exercise-assignments/${assignmentId}/revision-history`] });

      // Refetch assignment data immediately to update UI
      await queryClient.refetchQueries({ queryKey: [`/api/exercise-assignments/${assignmentId}`] });

      toast({
        title: variables.action === 'complete' ? "Esercizio Completato" : "Esercizio Rimandato",
        description: variables.action === 'complete'
          ? "Hai completato la revisione e assegnato il voto"
          : "L'esercizio è stato rimandato al cliente per le correzioni",
      });
      setShowReviewDialog(false);
      setReviewForm({ score: '', feedback: '', action: 'complete' });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la revisione",
        variant: "destructive",
      });
    }
  });

  const handleAnswerChange = (questionId: string, answer: string) => {
    form.setValue(`answers.${questionId}`, answer);

    // Trigger debounced auto-save during typing if conditions are met
    // Check if assignment status allows draft saving (must match backend validation)
    const allowedStatuses = ['pending', 'in_progress', 'returned'];
    const canSaveDraft = assignmentId && assignment && allowedStatuses.includes(assignment.status) && canSubmit;
    
    if (canSaveDraft) {
      const currentAnswers = { ...form.getValues("answers"), [questionId]: answer };
      const notes = form.getValues("notes") || "";

      // Check if there are actual changes compared to last saved state
      const answersChanged = JSON.stringify(currentAnswers) !== JSON.stringify(lastSavedAnswers);
      const notesChanged = notes.trim() !== lastSavedNotes.trim();

      // Only save if there are real changes and actual content
      if ((answersChanged || notesChanged) && (Object.keys(currentAnswers).length > 0 || notes.trim())) {
        console.log('Scheduling debounced save during typing...');
        debouncedSave(currentAnswers, notes);
      }
    }
  };

  const onSubmit = (data: any) => {
    // Validate notes minimum length
    if (!data.notes || data.notes.trim().length < 50) {
      toast({
        title: "Note troppo brevi",
        description: "Devi scrivere almeno 50 caratteri per descrivere come ti sei trovato con l'esercizio",
        variant: "destructive",
      });
      return;
    }

    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const handleConfirmSubmission = () => {
    const data = form.getValues();

    // Convert answers object to array format expected by API
    const answersArray = Object.entries(data.answers).map(([questionId, answer]) => ({
      questionId,
      answer: answer as string,
    }));

    submitExerciseMutation.mutate({
      answers: answersArray,
      notes: data.notes,
    });

    setShowConfirmDialog(false);
  };

  const handleReviewSubmission = (action: 'complete' | 'return') => {
    // Pre-fill score with calculated auto-grading if available
    const calculatedScore = calculateTotalAutoGrading();
    setReviewForm({ 
      ...reviewForm, 
      action,
      score: action === 'complete' && calculatedScore > 0 ? String(calculatedScore) : reviewForm.score
    });
    setShowReviewDialog(true);
  };

  const handleSubmitReview = () => {
    if (!assignmentId) return;

    if (reviewForm.action === 'complete') {
      // For exams with auto-correction, calculate final score automatically
      let finalScore = parseFloat(reviewForm.score);
      
      if (exercise?.isExam && exercise?.autoCorrect) {
        // Use calculated total score
        finalScore = calculateTotalAutoGrading();
        
        // Validate that all manual questions have scores
        const manualQuestions = exercise?.questions?.filter((q: any) => 
          q.type !== 'true_false' && q.type !== 'multiple_choice' && q.type !== 'multiple_answer'
        ) || [];
        
        for (const q of manualQuestions) {
          const grade = questionGrades[q.id];
          if (grade === undefined || grade < 0 || grade > (q.points || 0)) {
            toast({
              title: "Errore",
              description: `Devi inserire un punteggio valido per tutte le domande manuali (0-${q.points || 0})`,
              variant: "destructive",
            });
            return;
          }
        }
      } else {
        // Regular exercise - validate manual score
        if (!reviewForm.score || isNaN(finalScore) || finalScore < 0 || finalScore > 100) {
          toast({
            title: "Errore",
            description: "Il voto deve essere un numero tra 0 e 100",
            variant: "destructive",
          });
          return;
        }
      }

      // Prepare question grades array
      const gradesArray = exercise?.questions?.map((q: any) => ({
        questionId: q.id,
        score: questionGrades[q.id] !== undefined ? questionGrades[q.id] : 0,
        maxScore: q.points || 1
      })) || [];

      reviewMutation.mutate({
        assignmentId,
        action: 'complete',
        score: finalScore,
        feedback: reviewForm.feedback,
        questionGrades: gradesArray
      });
    } else {
      if (!reviewForm.feedback.trim()) {
        toast({
          title: "Errore",
          description: "Devi fornire un feedback per rimandare l'esercizio",
          variant: "destructive",
        });
        return;
      }

      reviewMutation.mutate({
        assignmentId,
        action: 'return',
        feedback: reviewForm.feedback,
      });
    }
  };

  // Mutation per avviare l'esercizio (cambia stato da pending a in_progress)
  const startExerciseMutation = useMutation({
    mutationFn: async () => {
      if (!assignmentId) throw new Error("Assignment ID mancante");

      const response = await fetch(`/api/exercise-assignments/${assignmentId}/start`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error("Errore nell'avvio dell'esercizio");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/exercise-assignments/${assignmentId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-assignments/client"] });
      toast({
        title: "Esercizio avviato!",
        description: "Ora puoi iniziare a rispondere alle domande",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'avvio dell'esercizio",
        variant: "destructive",
      });
    }
  });

  // Mutation per resettare l'esercizio (cambia stato da in_progress a pending)
  const resetExerciseMutation = useMutation({
    mutationFn: async () => {
      if (!assignmentId) throw new Error("Assignment ID mancante");

      const response = await fetch(`/api/exercise-assignments/${assignmentId}/reset`, {
        method: "POST",
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error("Errore nel reset dell'esercizio");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/exercise-assignments/${assignmentId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-assignments/client"] });
      setIsTimerActive(false);
      setTimeElapsed(0);
      toast({
        title: "Esercizio resettato!",
        description: "L'esercizio è stato riportato allo stato 'Da fare'",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nel reset dell'esercizio",
        variant: "destructive",
      });
    }
  });

  const handleExerciseStart = () => {
    if (assignment?.status === 'pending') {
      startExerciseMutation.mutate();
      hasLoggedStart();
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <ImageIcon size={16} />;
    }
    return <FileText size={16} />;
  };

  const handleBack = () => {
    if (user?.role === 'client') {
      setLocation('/client/exercises');
    } else {
      setLocation('/consultant/exercises');
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getTotalQuestions = () => exercise?.questions?.length || 0;
  const getAnsweredQuestions = () => {
    const answers = form.watch("answers");
    return Object.values(answers).filter(answer => {
      if (typeof answer === 'string') {
        return answer.trim() !== '';
      }
      if (Array.isArray(answer)) {
        return answer.length > 0;
      }
      return answer !== null && answer !== undefined;
    }).length;
  };
  const getProgressPercentage = () => {
    const total = getTotalQuestions();
    return total > 0 ? Math.round((getAnsweredQuestions() / total) * 100) : 0;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < getTotalQuestions() - 1) {
      saveOnQuestionChange(); // Salva prima di cambiare domanda
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      saveOnQuestionChange(); // Salva prima di cambiare domanda
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const goToQuestion = (index: number) => {
    if (index !== currentQuestionIndex) {
      saveOnQuestionChange(); // Salva prima di cambiare domanda
      setCurrentQuestionIndex(index);
    }
  };

  // Page context for AI assistant - MUST be called before any conditional returns
  const pageContext = usePageContext(exercise ? {
    exerciseId: exercise.id,
    exerciseTitle: exercise.title,
    exerciseData: {
      description: exercise.description,
      category: exercise.category,
      type: exercise.type,
      status: assignment?.status,
      dueDate: assignment?.dueDate,
      estimatedDuration: exercise.estimatedDuration
    }
  } : {});

  if (exerciseLoading || assignmentLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-80px)]">
          <div className="text-center">
            <h1 className="text-2xl font-heading font-bold text-foreground mb-2">Esercizio non trovato</h1>
            <p className="text-muted-foreground mb-4">L'esercizio richiesto non esiste o non hai i permessi per visualizzarlo</p>
            <Button onClick={handleBack}>Torna alla dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  const questions = exercise.questions || [];

  // Use assignment's workPlatform if available (custom per assignment), otherwise fall back to exercise's default
  const workPlatformUrl = assignment?.workPlatform || exercise.workPlatform;

  // Handler to confirm work platform completion
  const handleWorkPlatformConfirm = (confirmed: boolean) => {
    setWorkPlatformCompleted(confirmed);
  };

  // Handler to confirm library lesson completion
  const handleLibraryLessonConfirm = (confirmed: boolean) => {
    setLibraryLessonCompleted(confirmed);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="exercise-details">
      <Navbar />

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header Unico Professionale */}
        <div className="mb-6">
          <Card className="border-0 shadow-xl bg-white dark:bg-gray-800 overflow-hidden">
            <CardContent className="p-4 sm:p-6 space-y-4">
              {/* Top Row: Navigation & Timer */}
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  data-testid="button-back"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Indietro
                </Button>

                {canSubmit && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center space-x-2 bg-muted px-3 py-1.5 rounded-md">
                      <Clock size={14} className="text-muted-foreground" />
                      <span className="text-sm font-semibold">{formatTime(timeElapsed)}</span>
                    </div>
                    {/* Hidden reset button - only visible when in_progress */}
                    {assignment?.status === 'in_progress' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (window.confirm("Sei sicuro di voler resettare l'esercizio? Tornerà allo stato 'Da fare'.")) {
                            resetExerciseMutation.mutate();
                          }
                        }}
                        className="opacity-30 hover:opacity-100 transition-opacity"
                        title="Reset esercizio (torna a 'Da fare')"
                      >
                        <RefreshCcw size={14} />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Title & Metadata */}
              <div className="space-y-3">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground" data-testid="text-exercise-title">
                  {exercise.title}
                </h1>

                {/* Compact Info Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-medium" data-testid="badge-exercise-type">
                    {exercise.type === 'personalized' ? '🎯 Personalizzato' : '📚 Generale'}
                  </Badge>

                  {assignment?.priority && (
                    <Badge variant="outline" className="font-medium">
                      <div className={`w-2 h-2 rounded-full ${getPriorityColor(assignment.priority)} mr-1.5`}></div>
                      <span className="capitalize">{assignment.priority}</span>
                    </Badge>
                  )}

                  <Badge
                    variant={isCompleted ? 'default' : 'secondary'}
                    className="font-medium"
                  >
                    {isCompleted && <span data-testid="badge-completed">✅ Completato</span>}
                    {isSubmitted && <span data-testid="badge-submitted">⏳ In revisione</span>}
                    {isRejected && <span data-testid="badge-rejected">❌ Respinto</span>}
                    {isReturned && <span data-testid="badge-returned">🔄 Da correggere</span>}
                    {!isCompleted && !isSubmitted && !isRejected && !isReturned && <span>📝 In corso</span>}
                  </Badge>

                  {exercise.estimatedDuration && (
                    <Badge variant="outline" className="font-medium">
                      ⏱️ {exercise.estimatedDuration} min
                    </Badge>
                  )}

                  {isCompleted && assignment?.score && (
                    <Badge variant="default" className="font-semibold bg-green-600">
                      {String(assignment.score)}/100
                    </Badge>
                  )}
                </div>
              </div>

              {/* Start Exercise Button */}
              {canSubmit && !isTimerActive && questions.length > 0 && (
                <div className="flex items-center gap-3 p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-700 rounded-md">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                      <Play size={20} className="text-blue-600 dark:text-blue-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-50 text-sm sm:text-base">
                        Inizia l'esercizio
                      </h4>
                      <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-200 mt-0.5">
                        Clicca per avviare il timer e accedere alle domande
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setIsTimerActive(true);
                      handleExerciseStart();
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium shrink-0"
                    data-testid="button-start-exercise-prominent"
                  >
                    <Play size={16} className="mr-2" />
                    Inizia
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4 mt-4">

            {/* Consultant Review Status Indicator */}
            {canReview && (
              <div className="flex items-center p-4 bg-orange-50 dark:bg-orange-950/40 rounded-lg border border-orange-200 dark:border-orange-700">
                <AlertCircle className="text-orange-600 dark:text-orange-400 mr-3" size={20} />
                <div>
                  <h3 className="font-semibold text-orange-800 dark:text-orange-100">
                    Esercizio da Revisionare
                  </h3>
                  <p className="text-sm text-orange-600 dark:text-orange-200">
                    Il cliente ha consegnato l'esercizio e attende la tua revisione
                  </p>
                </div>
              </div>
            )}



            {/* Current Review Status - Always show if reviewed */}
            {assignment && (assignment.status === 'completed' || assignment.status === 'rejected' || assignment.status === 'returned' || assignment.reviewedAt) && (
              <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:border-blue-700 dark:bg-gradient-to-br dark:from-blue-950/40 dark:to-indigo-950/30 shadow-lg">
                <CardHeader className="pb-4 space-y-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                      <FileText size={20} className="sm:size-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="font-bold text-lg sm:text-xl text-blue-900 dark:text-blue-50 truncate">
                        📋 Stato della Revisione
                      </CardTitle>
                      <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-300 mt-1">
                        Feedback e indicazioni del tuo consulente
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  
                  {/* Show auto-graded score if available */}
                  {exercise?.isExam && exercise?.autoCorrect && assignment?.autoGradedScore !== null && assignment?.autoGradedScore !== undefined && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/60 dark:to-emerald-950/50 p-4 sm:p-5 rounded-xl border-2 border-green-400 dark:border-green-600 shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-bold text-green-900 dark:text-green-50 uppercase tracking-wide flex items-center gap-2">
                            <Award size={16} className="text-green-600 dark:text-green-400" />
                            Punteggio Auto-Grading
                          </Label>
                          <p className="text-xs text-green-700 dark:text-green-200 mt-1">
                            Calcolato automaticamente dalle risposte corrette
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-3xl font-bold text-green-600 dark:text-green-300">
                            {assignment.autoGradedScore}
                          </span>
                          <span className="text-lg text-green-700 dark:text-green-200">/100</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Status Badge - Mobile Optimized */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 shadow-md border-2 border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        {assignment.status === 'completed' ? (
                          <>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                              <CheckCircle className="text-green-600 dark:text-green-300" size={20} />
                            </div>
                            <div>
                              <div className="font-bold text-green-700 dark:text-green-200 text-base sm:text-lg">✅ Approvato</div>
                              {assignment.score && (
                                <div className="text-xs sm:text-sm text-green-600 dark:text-green-300 mt-0.5">
                                  Voto finale: <span className="font-bold">{String(assignment.score)}/100</span>
                                </div>
                              )}
                            </div>
                          </>
                        ) : assignment.status === 'rejected' ? (
                          <>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                              <XCircle className="text-red-600 dark:text-red-300" size={20} />
                            </div>
                            <div>
                              <div className="font-bold text-red-700 dark:text-red-200 text-base sm:text-lg">❌ Respinto</div>
                              <div className="text-xs sm:text-sm text-red-600 dark:text-red-300 mt-0.5">Consulta il feedback</div>
                            </div>
                          </>
                        ) : assignment.status === 'returned' ? (
                          <>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                              <RefreshCcw className="text-orange-600 dark:text-orange-300" size={20} />
                            </div>
                            <div>
                              <div className="font-bold text-orange-700 dark:text-orange-200 text-base sm:text-lg">🔄 Da Correggere</div>
                              <div className="text-xs sm:text-sm text-orange-600 dark:text-orange-300 mt-0.5">Richieste modifiche</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0">
                              <Clock className="text-blue-600 dark:text-blue-300" size={20} />
                            </div>
                            <div>
                              <div className="font-bold text-blue-700 dark:text-blue-200 text-base sm:text-lg">⏳ In Revisione</div>
                              <div className="text-xs sm:text-sm text-blue-600 dark:text-blue-300 mt-0.5">In attesa di feedback</div>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg whitespace-nowrap font-medium">
                        📅 {assignment.reviewedAt ? formatDate(assignment.reviewedAt) : assignment.submittedAt ? `Consegnato: ${formatDate(assignment.submittedAt)}` : 'In elaborazione'}
                      </div>
                    </div>
                  </div>

                  {/* Action Alert for Client - Only show if needs action */}
                  {assignment.status === 'returned' && user?.role === 'client' && (
                    <div className="bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-950/70 dark:to-red-950/60 border-2 border-orange-400 dark:border-orange-600 rounded-xl p-4 sm:p-5 shadow-lg hover:shadow-xl transition-shadow animate-pulse">
                      <div className="flex items-start space-x-3 sm:space-x-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                          <AlertCircle className="text-white" size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-orange-900 dark:text-orange-50 text-base sm:text-lg mb-2">
                            ⚡ Azione Richiesta
                          </h4>
                          <p className="text-sm sm:text-base text-orange-800 dark:text-orange-100 mb-4 leading-relaxed">
                            Il tuo consulente ha richiesto delle correzioni. Leggi attentamente il feedback qui sotto, apporta le modifiche necessarie e riconsegna l'esercizio.
                          </p>
                          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Scroll to feedback section
                                const feedbackSection = document.querySelector('[data-feedback-section]');
                                feedbackSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                              className="bg-white dark:bg-gray-800 border-orange-400 dark:border-orange-700 text-orange-700 dark:text-orange-200 hover:bg-orange-50 dark:hover:bg-orange-950/40 font-medium"
                            >
                              📖 Leggi il Feedback
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                // Switch to submission tab
                                const submissionTab = document.querySelector('[value="submission"]') as HTMLElement;
                                submissionTab?.click();
                              }}
                              className="bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-md"
                            >
                              ✏️ Vai a Correggere
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Consultant Feedback Section */}
                  {(() => {
                    // Handle both array and string formats for consultant feedback
                    let feedbackList = [];

                    try {
                      if (Array.isArray(assignment.consultantFeedback)) {
                        feedbackList = assignment.consultantFeedback
                          .filter(item => item && typeof item === 'object')
                          .map(item => {
                            if (typeof item.feedback === 'string' && item.feedback.startsWith('[')) {
                              try {
                                const nestedFeedback = JSON.parse(item.feedback);
                                if (Array.isArray(nestedFeedback)) {
                                  return nestedFeedback;
                                }
                              } catch (e) {
                                console.log('Failed to parse nested feedback, using as is');
                              }
                            }
                            return item;
                          })
                          .flat()
                          .filter(item => item && typeof item === 'object' && item.feedback);
                      } else if (assignment.consultantFeedback && typeof assignment.consultantFeedback === 'string') {
                        try {
                          const parsed = JSON.parse(assignment.consultantFeedback);
                          if (Array.isArray(parsed)) {
                            feedbackList = parsed
                              .filter(item => item && typeof item === 'object')
                              .map(item => {
                                if (typeof item.feedback === 'string' && item.feedback.startsWith('[')) {
                                  try {
                                    const nestedFeedback = JSON.parse(item.feedback);
                                    if (Array.isArray(nestedFeedback)) {
                                      return nestedFeedback;
                                    }
                                  } catch (e) {
                                    console.log('Failed to parse nested feedback, using as is');
                                  }
                                }
                                return item;
                              })
                              .flat()
                              .filter(item => item && typeof item === 'object' && item.feedback);
                          } else {
                            feedbackList = [{
                              feedback: assignment.consultantFeedback,
                              timestamp: assignment.reviewedAt ? new Date(assignment.reviewedAt).toISOString() : new Date().toISOString()
                            }];
                          }
                        } catch (e) {
                          console.log('Failed to parse feedback string, using as plain text');
                          feedbackList = [{
                            feedback: assignment.consultantFeedback,
                            timestamp: assignment.reviewedAt ? new Date(assignment.reviewedAt).toISOString() : new Date().toISOString()
                          }];
                        }
                      }
                    } catch (error) {
                      console.error('Error processing consultant feedback:', error);
                      feedbackList = [];
                    }

                    return feedbackList.length > 0 ? (
                      <div className="space-y-3 pt-4 border-t-2 border-gray-200 dark:border-gray-700" data-feedback-section>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs sm:text-sm font-bold text-blue-900 dark:text-blue-50 uppercase tracking-wide flex items-center gap-2">
                            <MessageSquare size={16} className="text-blue-600 dark:text-blue-400" />
                            Feedback del Consulente
                          </Label>
                          <Badge variant="secondary" className="text-xs font-semibold">
                            {feedbackList.length} {feedbackList.length === 1 ? 'messaggio' : 'messaggi'}
                          </Badge>
                        </div>
                        <div className="space-y-3">
                          {feedbackList
                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                            .map((feedbackItem, index) => {
                              const reversedIndex = feedbackList.length - index;
                              return (
                                <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border-l-4 border-blue-500 dark:border-blue-500 hover:shadow-lg transition-all duration-200">
                                  <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-2 mb-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-100 border-blue-300 dark:border-blue-600 text-xs font-semibold">
                                        #{reversedIndex}
                                      </Badge>
                                      {index === 0 && (
                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-2 py-1 rounded">
                                          🔔 Più Recente
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-medium">
                                      📅 {formatDate(feedbackItem.timestamp)}
                                    </span>
                                  </div>
                                  <ExpandableText
                                    text={feedbackItem.feedback}
                                    id={`feedback-${index}`}
                                    isExpanded={expandedFeedback[`feedback-${index}`] || false}
                                    onToggle={() => setExpandedFeedback(prev => ({
                                      ...prev,
                                      [`feedback-${index}`]: !prev[`feedback-${index}`]
                                    }))}
                                    type="feedback"
                                  />
                                </div>
                              );
                            })
                          }
                        </div>
                      </div>
                    ) : null;
                  })()}

                  {/* Client Notes History - Moved from Submission Tab */}
                  {allSubmissions && allSubmissions.length > 0 && allSubmissions.filter(s => s.notes && s.notes.trim()).length > 0 && (
                    <div className="space-y-4 pt-5 border-t-2 border-gray-200 dark:border-gray-700 mt-5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <Label className="text-sm sm:text-base font-bold text-green-900 dark:text-green-50 uppercase tracking-wide flex items-center gap-2">
                          <FileText size={18} className="text-green-600 dark:text-green-400" />
                          Le Tue Note
                        </Label>
                        <Badge variant="secondary" className="text-xs sm:text-sm font-semibold">
                          {allSubmissions.filter(s => s.notes && s.notes.trim()).length} {allSubmissions.filter(s => s.notes && s.notes.trim()).length === 1 ? 'consegna' : 'consegne'}
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {allSubmissions
                          .filter(sub => sub.notes && sub.notes.trim())
                          .sort((a, b) => {
                            // Sort by submission date, handling null dates
                            const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
                            const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
                            return dateB - dateA;
                          })
                          .map((sub, index) => {
                            const reversedIndex = allSubmissions.filter(s => s.notes && s.notes.trim()).length - index;
                            return (
                              <div key={sub.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 shadow-md border-l-4 border-green-500 dark:border-green-500 hover:shadow-lg transition-all duration-200">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-100 border-green-300 dark:border-green-600 text-xs font-semibold">
                                      Consegna #{reversedIndex}
                                    </Badge>
                                    {index === 0 && (
                                      <span className="text-xs font-bold text-green-600 dark:text-green-300 bg-green-50 dark:bg-green-900/40 px-2 py-1 rounded">
                                        📝 Più Recente
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded font-medium whitespace-nowrap">
                                    📅 {sub.submittedAt ? formatDate(sub.submittedAt) : 'In bozza'}
                                  </span>
                                </div>
                                <ExpandableText
                                  text={sub.notes}
                                  id={`notes-${sub.id}`}
                                  isExpanded={expandedNotes[`notes-${sub.id}`] || false}
                                  onToggle={() => setExpandedNotes(prev => ({
                                    ...prev,
                                    [`notes-${sub.id}`]: !prev[`notes-${sub.id}`]
                                  }))}
                                  type="notes"
                                />
                              </div>
                            );
                          })
                        }
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Complete Revision History - Additional section if available */}
            {assignment && revisionHistory && revisionHistory.length > 0 && (
              <Card className="border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText size={20} className="text-purple-600" />
                    <span>Cronologia Completa delle Revisioni</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Storico dettagliato di tutte le revisioni effettuate ({revisionHistory.length} revisioni)
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {revisionHistory.map((revision: any, index: number) => (
                    <div key={revision.id} className="border border-muted rounded-lg p-4 bg-white dark:bg-gray-800">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {revision.action === 'approved' ? (
                            <>
                              <CheckCircle className="text-green-600" size={16} />
                              <span className="font-semibold text-green-600">Approvato</span>
                              {revision.score && (
                                <Badge className="bg-green-100 text-green-700 border-green-300">
                                  Voto: {String(revision.score)}/100
                                </Badge>
                              )}
                            </>
                          ) : revision.action === 'rejected' ? (
                            <>
                              <XCircle className="text-red-600" size={16} />
                              <span className="font-semibold text-red-600">Respinto</span>
                            </>
                          ) : revision.action === 'returned' ? (
                            <>
                              <RefreshCcw className="text-orange-600" size={16} />
                              <span className="font-semibold text-orange-600">Rimandato per Correzioni</span>
                            </>
                          ) : (
                            <>
                              <Clock className="text-blue-600" size={16} />
                              <span className="font-semibold text-blue-600">Consegnato</span>
                            </>
                          )}
                          <span className="text-xs text-muted-foreground">
                            #{revisionHistory.length - index}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(revision.createdAt)}
                        </div>
                      </div>

                      {/* Consultant feedback for this specific revision */}
                      {revision.consultantFeedback && (
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Feedback del Consulente:
                          </Label>
                          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border-l-4 border-blue-500">
                            <p className="text-sm whitespace-pre-wrap">{revision.consultantFeedback}</p>
                          </div>
                        </div>
                      )}

                      {/* Client notes for this specific revision */}
                      {revision.clientNotes && (
                        <div className={`mt-3 ${revision.consultantFeedback ? 'pt-3 border-t border-gray-200 dark:border-gray-700' : ''}`}>
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Note del Cliente per questa consegna:
                          </Label>
                          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border-l-4 border-green-500">
                            <p className="text-sm whitespace-pre-wrap">{revision.clientNotes}</p>
                          </div>
                        </div>
                      )}

                      {/* Status transition info */}
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-xs text-muted-foreground">
                          Stato cambiato da <span className="font-medium capitalize">{revision.previousStatus}</span> a <span className="font-medium capitalize">{revision.newStatus}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Rejected Exercise Summary */}
            {isRejected && user?.role === 'consultant' && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-center space-x-3 mb-3">
                  <X className="text-red-600" size={20} />
                  <div>
                    <h3 className="font-semibold text-red-800 dark:text-red-200">
                      Esercizio Respinto
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-300">
                      Questo esercizio è stato respinto e il cliente è stato notificato
                    </p>
                  </div>
                </div>
                {assignment?.consultantFeedback && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border-l-4 border-red-500">
                    <Label className="text-xs font-medium text-red-600 uppercase tracking-wide block mb-2">
                      Motivo del rifiuto:
                    </Label>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {assignment.consultantFeedback}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Client Rejection Notice */}
            {user?.role === 'client' && isRejected && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800" data-testid="section-client-rejection-notice">
                <div className="flex items-center space-x-3 mb-3">
                  <XCircle className="text-red-600" size={20} />
                  <div>
                    <h3 className="font-semibold text-red-800 dark:text-red-200">
                      La tua consegna è stata respinta
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-300">
                      Il consulente ha deciso di respingere l'esercizio e ha fornito il seguente feedback
                    </p>
                  </div>
                </div>
                {assignment?.consultantFeedback && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border-l-4 border-red-500">
                    <Label className="text-xs font-medium text-red-600 uppercase tracking-wide block mb-2">
                      Motivo del rifiuto:
                    </Label>
                    <p className="text-sm text-foreground whitespace-pre-wrap" data-testid="text-client-rejection-feedback">
                      {assignment.consultantFeedback}
                    </p>
                  </div>
                )}
                <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-700">
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    💡 <strong>Prossimo passo:</strong> Contatta il tuo consulente per chiarimenti sui feedback ricevuti e per discutere come migliorare il tuo lavoro.
                  </p>
                </div>
              </div>
            )}


          </div>

          {canSubmit && questions.length > 0 && (
            <div className="space-y-2 bg-muted/30 p-3 rounded-lg border">
              <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
                <span className="text-foreground">
                  <span className="hidden sm:inline">Progresso: </span>
                  <span className="font-bold text-primary">{getAnsweredQuestions()}</span>
                  <span className="text-muted-foreground">/{getTotalQuestions()}</span>
                  <span className="hidden sm:inline"> domande</span>
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-lg sm:text-xl font-bold text-primary">{getProgressPercentage()}%</span>
                  <div className="w-4 h-4 sm:w-5 sm:h-5 bg-primary/10 rounded-full flex items-center justify-center">
                    <CheckCircle size={12} className={`${getProgressPercentage() === 100 ? 'text-success' : 'text-muted-foreground'} sm:size-3`} />
                  </div>
                </div>
              </div>
              <Progress value={getProgressPercentage()} className="h-2 sm:h-3" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:gap-6">
          {/* Main content - full width on mobile, 3/4 on large screens */}
          <div className="lg:col-span-1">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="flex w-full bg-gradient-to-r from-muted/50 to-muted/30 p-1 h-auto rounded-lg border border-border/50 shadow-sm overflow-x-auto">
                <TabsTrigger
                  value="overview"
                  className="flex-1 min-w-0 px-2 py-2 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
                >
                  <div className="flex items-center justify-center space-x-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></div>
                    <span className="truncate">Panoramica</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger
                  value="questions"
                  disabled={questions.length === 0 || (exercise?.libraryDocumentId && exercise.libraryDocumentId.trim() !== '' && canSubmit && !libraryLessonCompleted) || (workPlatformUrl && workPlatformUrl.trim() !== '' && canSubmit && !workPlatformCompleted)}
                  className="flex-1 min-w-0 px-2 py-2 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg disabled:opacity-50"
                  onClick={(e) => {
                    if ((exercise?.libraryDocumentId && exercise.libraryDocumentId.trim() !== '' && canSubmit && !libraryLessonCompleted) || (workPlatformUrl && workPlatformUrl.trim() !== '' && canSubmit && !workPlatformCompleted)) {
                      e.preventDefault();
                      const hasLibrary = exercise?.libraryDocumentId && exercise.libraryDocumentId.trim() !== '';
                      const hasPlatform = workPlatformUrl && workPlatformUrl.trim() !== '';
                      let message = "Prima di accedere alle domande, devi confermare di aver completato ";
                      if (hasLibrary && hasPlatform) {
                        message += "la lezione del corso e l'esercizio sulla piattaforma esterna";
                      } else if (hasLibrary) {
                        message += "la lezione del corso";
                      } else {
                        message += "l'esercizio sulla piattaforma esterna";
                      }
                      message += " nella sezione Panoramica.";
                      toast({
                        title: "⚠️ Conferma richiesta",
                        description: message,
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></div>
                    <span className="hidden xs:inline truncate">Domande</span>
                    <span className="xs:hidden">Q</span>
                    <span className="bg-current/20 px-1 py-0.5 rounded-full text-xs">
                      {String(questions.length)}
                    </span>
                  </div>
                </TabsTrigger>
                <TabsTrigger
                  value="submission"
                  disabled={!canSubmit || (exercise?.libraryDocumentId && exercise.libraryDocumentId.trim() !== '' && canSubmit && !libraryLessonCompleted) || (workPlatformUrl && workPlatformUrl.trim() !== '' && canSubmit && !workPlatformCompleted)}
                  className="flex-1 min-w-0 px-2 py-2 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg disabled:opacity-50"
                  onClick={(e) => {
                    if ((exercise?.libraryDocumentId && exercise.libraryDocumentId.trim() !== '' && canSubmit && !libraryLessonCompleted) || (workPlatformUrl && workPlatformUrl.trim() !== '' && canSubmit && !workPlatformCompleted)) {
                      e.preventDefault();
                      const hasLibrary = exercise?.libraryDocumentId && exercise.libraryDocumentId.trim() !== '';
                      const hasPlatform = workPlatformUrl && workPlatformUrl.trim() !== '';
                      let message = "Prima di procedere alla consegna, devi confermare di aver completato ";
                      if (hasLibrary && hasPlatform) {
                        message += "la lezione del corso e l'esercizio sulla piattaforma esterna";
                      } else if (hasLibrary) {
                        message += "la lezione del corso";
                      } else {
                        message += "l'esercizio sulla piattaforma esterna";
                      }
                      message += " nella sezione Panoramica.";
                      toast({
                        title: "⚠️ Conferma richiesta",
                        description: message,
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <div className="flex items-center justify-center space-x-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></div>
                    <span className="truncate">Consegna</span>
                  </div>
                </TabsTrigger>
                {user?.role === 'consultant' && submission && (
                  <TabsTrigger
                    value="review"
                    className="flex-1 min-w-0 px-2 py-2 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg"
                  >
                    <div className="flex items-center justify-center space-x-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></div>
                      <span className="hidden sm:inline truncate">Risposta Cliente</span>
                      <span className="sm:hidden">Review</span>
                    </div>
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="overview" className="space-y-4 mt-4">
                {/* Layout Version Selector - Hidden but keeping the code */}
                {false && workPlatformUrl && workPlatformUrl.trim() !== '' && (
                  <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 dark:border-indigo-800 dark:bg-gradient-to-r dark:from-indigo-950/30 dark:to-purple-950/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                            🎨 Stile Layout:
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant={layoutVersion === 1 ? "default" : "outline"}
                            size="sm"
                            onClick={() => setLayoutVersion(1)}
                            className={layoutVersion === 1 ? "bg-gradient-to-r from-orange-500 to-pink-600" : ""}
                          >
                            V1 - Enhanced
                          </Button>
                          <Button
                            variant={layoutVersion === 2 ? "default" : "outline"}
                            size="sm"
                            onClick={() => setLayoutVersion(2)}
                            className={layoutVersion === 2 ? "bg-gradient-to-r from-blue-500 to-cyan-500" : ""}
                          >
                            V2 - Timeline
                          </Button>
                          <Button
                            variant={layoutVersion === 3 ? "default" : "outline"}
                            size="sm"
                            onClick={() => setLayoutVersion(3)}
                            className={layoutVersion === 3 ? "bg-gradient-to-r from-indigo-500 to-purple-600" : ""}
                          >
                            V3 - Compact
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Work Platform - Layout Version 1 (Enhanced CTA) */}
                {workPlatformUrl && workPlatformUrl.trim() !== '' && layoutVersion === 1 && (
                  <Card data-testid="card-work-platform" className="border-none bg-gradient-to-br from-blue-50/80 via-purple-50/50 to-pink-50/40 dark:from-blue-950/40 dark:via-purple-950/30 dark:to-pink-950/20 shadow-2xl relative overflow-hidden">
                    {/* Animated background pattern */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
                      <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-400 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
                      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
                    </div>

                    <CardHeader className="pb-6 relative z-10 border-b border-white/20">
                      <div className="flex items-start space-x-4">
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-pink-500 rounded-2xl blur opacity-75 animate-pulse"></div>
                          <div className="relative w-14 h-14 bg-gradient-to-br from-orange-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-xl transform hover:scale-110 transition-transform">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                              <polyline points="15 3 21 3 21 9"/>
                              <line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-orange-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
                            🚀 PRIMA COSA: Apri il Documento
                          </CardTitle>
                          <div className="mt-3 p-4 bg-gradient-to-r from-orange-100/90 to-pink-100/90 dark:from-orange-950/50 dark:to-pink-950/50 rounded-xl border-l-4 border-orange-500 shadow-md">
                            <p className="text-sm sm:text-base font-bold text-orange-800 dark:text-orange-200 mb-2 flex items-center gap-2">
                              <span className="text-xl">⚠️</span>
                              <span>ATTENZIONE: Esercizio su piattaforma esterna!</span>
                            </p>
                            <p className="text-sm text-orange-700 dark:text-orange-300">
                              Prima di rispondere, apri il documento esterno con il pulsante qui sotto.
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="relative z-10 pt-6">
                      <div className="space-y-6">
                        {/* Enhanced CTA Section */}
                        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-6 sm:p-8 rounded-2xl border-2 border-dashed border-orange-400 dark:border-orange-600 shadow-2xl">
                          <div className="text-center space-y-6">
                            {/* Animated icon */}
                            <div className="relative inline-block">
                              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-pink-500 rounded-full blur-lg opacity-75 animate-pulse"></div>
                              <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-orange-500 to-pink-600 rounded-full flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform animate-bounce-slow">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                  <polyline points="15 3 21 3 21 9"/>
                                  <line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h3 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
                                👆 CLICCA PER INIZIARE
                              </h3>
                              <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 font-medium">
                                Apri il documento di lavoro
                              </p>
                            </div>

                            {/* Enhanced Button */}
                            <div className="space-y-4">
                              <Button
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = workPlatformUrl;
                                  link.target = '_blank';
                                  link.rel = 'noopener noreferrer';
                                  link.click();
                                }}
                                className="w-full bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 hover:from-orange-600 hover:via-pink-600 hover:to-purple-700 text-white text-base sm:text-lg font-bold py-5 sm:py-6 px-6 rounded-2xl shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1"
                                size="lg"
                                data-testid="button-open-work-platform"
                              >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mr-3 shrink-0">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                  <polyline points="15 3 21 3 21 9"/>
                                  <line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                                <span>🚀 APRI DOCUMENTO</span>
                              </Button>

                              {/* Animated arrows */}
                              <div className="flex justify-center gap-2">
                                <div className="text-4xl sm:text-5xl animate-bounce text-orange-500 dark:text-orange-400">↑</div>
                                <div className="text-4xl sm:text-5xl animate-bounce animation-delay-200 text-pink-500 dark:text-pink-400">↑</div>
                                <div className="text-4xl sm:text-5xl animate-bounce animation-delay-400 text-purple-500 dark:text-purple-400">↑</div>
                              </div>
                              <p className="text-sm sm:text-base font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
                                ⬆️ Clicca per aprire in una nuova scheda ⬆️
                              </p>
                            </div>

                            {/* Enhanced link display */}
                            <div className="mt-6 p-4 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-300 dark:border-gray-700 shadow-inner">
                              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mb-2 font-bold flex items-center justify-center gap-2">
                                <span className="text-lg">📎</span>
                                <span>Link del documento:</span>
                              </p>
                              <div className="bg-white dark:bg-gray-950 p-3 rounded-lg border border-gray-300 dark:border-gray-700 shadow-sm">
                                <p className="text-xs sm:text-sm font-mono text-blue-600 dark:text-blue-400 break-all" data-testid="text-work-platform-url">
                                  {workPlatformUrl}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Enhanced Step-by-step guide */}
                        <div className="space-y-5">
                          <h4 className="text-xl sm:text-2xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
                            📋 Come procedere:
                          </h4>

                          {[
                            {
                              number: 1,
                              icon: '🖱️',
                              title: 'Apri la Piattaforma Esterna',
                              desc: 'Usa il pulsante qui sopra per aprire il documento di lavoro in una nuova scheda.',
                              note: '💡 Il documento si aprirà in una nuova scheda - non chiudere questa pagina!',
                              color: 'from-blue-500 to-cyan-500'
                            },
                            {
                              number: 2,
                              icon: '✍️',
                              title: 'Completa l\'Esercizio',
                              desc: 'Lavora sul documento che hai aperto seguendo le istruzioni dell\'esercizio.',
                              color: 'from-purple-500 to-pink-500'
                            },
                            {
                              number: 3,
                              icon: '✅',
                              title: 'Torna e Conferma',
                              desc: 'Una volta completato il lavoro, torna qui e spunta la casella:',
                              color: 'from-green-500 to-emerald-500',
                              hasCheckbox: true
                            }
                          ].map((step) => (
                            <div key={step.number} className="group bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
                              <div className="flex items-start gap-4 p-5">
                                <div className={`relative shrink-0`}>
                                  <div className={`absolute inset-0 bg-gradient-to-r ${step.color} rounded-2xl blur opacity-50 group-hover:opacity-75 transition-opacity`}></div>
                                  <div className={`relative w-12 h-12 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-xl`}>
                                    {step.number}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className={`font-bold text-base sm:text-lg mb-2 bg-gradient-to-r ${step.color} bg-clip-text text-transparent`}>
                                    {step.icon} {step.title}
                                  </h4>
                                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed mb-3">
                                    {step.desc}
                                  </p>
                                  {step.note && (
                                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 p-3 rounded-lg border-l-4 border-blue-400">
                                      <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 font-semibold">
                                        {step.note}
                                      </p>
                                    </div>
                                  )}
                                  {step.hasCheckbox && canSubmit && (
                                    <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl border-2 border-green-400 dark:border-green-600 shadow-md mt-3">
                                      <input
                                        type="checkbox"
                                        id="confirm-work-platform"
                                        checked={workPlatformCompleted}
                                        onChange={(e) => handleWorkPlatformConfirm(e.target.checked)}
                                        className="h-6 w-6 text-green-600 focus:ring-green-500 border-gray-300 rounded-lg mt-0.5 shrink-0 cursor-pointer"
                                      />
                                      <label htmlFor="confirm-work-platform" className="text-sm sm:text-base font-bold text-green-800 dark:text-green-200 cursor-pointer leading-tight">
                                        ✅ Ho completato l'esercizio sulla piattaforma esterna e sono pronto per la consegna
                                      </label>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Enhanced status indicator */}
                        {canSubmit && (
                          <div className={`p-6 sm:p-8 rounded-2xl border-2 transition-all duration-500 ${
                            workPlatformCompleted
                              ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-400 dark:border-green-600 shadow-2xl'
                              : 'bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border-orange-400 dark:border-orange-600 shadow-xl'
                          }`}>
                            <div className="flex items-start gap-4">
                              <div className={`relative shrink-0`}>
                                <div className={`absolute inset-0 ${workPlatformCompleted ? 'bg-green-500' : 'bg-orange-500'} rounded-2xl blur opacity-50 ${workPlatformCompleted ? 'animate-pulse' : ''}`}></div>
                                <div className={`relative w-12 h-12 ${workPlatformCompleted ? 'bg-green-500' : 'bg-orange-500'} rounded-2xl flex items-center justify-center shadow-xl`}>
                                  {workPlatformCompleted ? (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                  ) : (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="10"/>
                                      <line x1="12" y1="8" x2="12" y2="12"/>
                                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                                    </svg>
                                  )}
                                </div>
                              </div>
                              <p className={`text-base sm:text-lg font-bold leading-relaxed ${
                                workPlatformCompleted
                                  ? 'bg-gradient-to-r from-green-700 to-emerald-700 dark:from-green-300 dark:to-emerald-300 bg-clip-text text-transparent'
                                  : 'bg-gradient-to-r from-orange-700 to-red-700 dark:from-orange-300 dark:to-red-300 bg-clip-text text-transparent'
                              }`}>
                                {workPlatformCompleted
                                  ? '🎉 Perfetto! Piattaforma esterna completata! Ora puoi procedere alle sezioni "Domande" e "Consegna".'
                                  : '⚠️ Ricordati di aprire e completare il lavoro sulla piattaforma esterna prima di procedere!'
                                }
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Enhanced important reminders */}
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-6 sm:p-8 rounded-2xl border-l-4 border-indigo-500 shadow-xl">
                          <div className="flex items-start gap-4">
                            <div className="relative shrink-0">
                              <div className="absolute inset-0 bg-indigo-500 rounded-2xl blur opacity-50"></div>
                              <div className="relative w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10"/>
                                  <line x1="12" y1="8" x2="12" y2="12"/>
                                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                              </div>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-xl sm:text-2xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
                                💡 Cose Importanti da Ricordare
                              </h4>
                              <ul className="space-y-3">
                                {[
                                  'Prima clicca il pulsante per aprire il documento esterno',
                                  'Completa tutto il lavoro sul documento esterno',
                                  'Torna qui e spunta la casella di conferma',
                                  'Solo dopo potrai accedere alle sezioni "Domande" e "Consegna"',
                                  'Se hai domande, contatta il tuo consulente'
                                ].map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-3 group">
                                    <span className="text-indigo-500 dark:text-indigo-400 font-bold text-lg shrink-0 group-hover:scale-125 transition-transform">•</span>
                                    <span className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                                      {item.includes('Prima') ? <strong>{item.split(' ')[0]}</strong> : ''} {item.includes('Prima') ? item.substring(6) : item}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Library Lesson - Layout Version 2 (Timeline Progressivo) */}
                {exercise.libraryDocumentId && exercise.libraryDocumentId.trim() !== '' && layoutVersion === 2 && libraryLesson && (
                  <Card data-testid="card-library-lesson" className="border-2 border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-800 shadow-xl">
                    <CardHeader className="pb-4 border-b border-gray-200 dark:border-gray-800">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                          <BookOpen className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold text-purple-900 dark:text-purple-100">
                            {workPlatformUrl && workPlatformUrl.trim() !== '' ? '📚 Passo 1: Studia la Lezione' : '📚 Studia la Lezione del Corso'}
                          </CardTitle>
                          <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                            Segui questi passaggi per completare lo studio
                          </p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-6 space-y-6">
                      {/* Timeline Steps */}
                      <div className="space-y-4">
                        {/* Step 1 */}
                        <div className="flex items-start gap-4 group">
                          <div className="relative">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-110 transition-transform">
                              1
                            </div>
                            <div className="absolute top-10 left-1/2 -ml-px w-0.5 h-16 bg-gradient-to-b from-purple-500 to-indigo-500"></div>
                          </div>
                          <div className="flex-1 pt-2">
                            <h4 className="font-bold text-base text-purple-900 dark:text-purple-100 mb-2">
                              📖 Accedi alla Lezione
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                              Clicca il pulsante qui sotto per accedere alla lezione del corso
                            </p>
                            <Button
                              onClick={() => {
                                // Aggiungi un parametro per indicare che si arriva dall'esercizio
                                setLocation(`/client/library/${exercise.libraryDocumentId}?returnTo=exercise&exerciseId=${id}&assignmentId=${assignmentId}`);
                              }}
                              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all mb-3"
                            >
                              <BookOpen className="mr-2 h-4 w-4" />
                              Vai alla Lezione
                            </Button>
                            <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                              <p className="font-semibold text-purple-900 dark:text-purple-100 mb-1">{libraryLesson.title}</p>
                              {libraryLesson.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">{libraryLesson.description}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex items-start gap-4 group">
                          <div className="relative">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-110 transition-transform">
                              2
                            </div>
                            <div className="absolute top-10 left-1/2 -ml-px w-0.5 h-16 bg-gradient-to-b from-indigo-500 to-green-500"></div>
                          </div>
                          <div className="flex-1 pt-2">
                            <h4 className="font-bold text-base text-indigo-900 dark:text-indigo-100 mb-2">
                              🧠 Studia i Contenuti
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              Dedica il tempo necessario per comprendere bene tutti i concetti della lezione
                            </p>
                          </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex items-start gap-4 group">
                          <div className="relative">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-110 transition-transform">
                              3
                            </div>
                          </div>
                          <div className="flex-1 pt-2">
                            <h4 className="font-bold text-base text-green-900 dark:text-green-100 mb-2">
                              ✅ Conferma Completamento
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                              Una volta completato lo studio, spunta la casella:
                            </p>
                            {canSubmit && (
                              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border-2 border-green-400 dark:border-green-600">
                                <input
                                  type="checkbox"
                                  id="confirm-library-lesson-v2"
                                  checked={libraryLessonCompleted}
                                  onChange={(e) => handleLibraryLessonConfirm(e.target.checked)}
                                  className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded mt-0.5 cursor-pointer"
                                />
                                <label htmlFor="confirm-library-lesson-v2" className="text-sm font-semibold text-green-800 dark:text-green-200 cursor-pointer">
                                  Ho completato lo studio della lezione
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status indicator */}
                      {canSubmit && (
                        <div className={`p-4 rounded-lg border-2 transition-all ${
                          libraryLessonCompleted
                            ? 'bg-green-50 dark:bg-green-950/30 border-green-400 dark:border-green-600'
                            : 'bg-orange-50 dark:bg-orange-950/30 border-orange-400 dark:border-orange-600'
                        }`}>
                          <p className={`text-sm font-semibold ${
                            libraryLessonCompleted ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'
                          }`}>
                            {libraryLessonCompleted
                              ? '🎉 Perfetto! Hai completato la lezione'
                              : '⚠️ Studia la lezione e spunta la casella sopra'
                            }
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Work Platform - Layout Version 2 (Timeline Progressivo) */}
                {workPlatformUrl && workPlatformUrl.trim() !== '' && layoutVersion === 2 && (
                  <Card data-testid="card-work-platform" className="border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 shadow-xl">
                    <CardHeader className="pb-4 border-b border-gray-200 dark:border-gray-800">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold text-blue-900 dark:text-blue-100">
                            {exercise.libraryDocumentId && exercise.libraryDocumentId.trim() !== '' ? '🚀 Passo 2: Apri il Documento Esterno' : '🚀 Apri il Documento Esterno'}
                          </CardTitle>
                          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                            Segui questi passaggi per completare l'esercizio
                          </p>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-6 space-y-6">
                      {/* Timeline Steps */}
                      <div className="space-y-4">
                        {/* Step 1 */}
                        <div className="flex items-start gap-4 group">
                          <div className="relative">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-110 transition-transform">
                              1
                            </div>
                            <div className="absolute top-10 left-1/2 -ml-px w-0.5 h-16 bg-gradient-to-b from-blue-500 to-purple-500"></div>
                          </div>
                          <div className="flex-1 pt-2">
                            <h4 className="font-bold text-base text-blue-900 dark:text-blue-100 mb-2">
                              🖱️ Apri la Piattaforma Esterna
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                              Clicca il pulsante qui sotto per aprire il documento in una nuova scheda
                            </p>
                            <Button
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = workPlatformUrl;
                                link.target = '_blank';
                                link.rel = 'noopener noreferrer';
                                link.click();
                              }}
                              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                              Apri Documento
                            </Button>
                          </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex items-start gap-4 group">
                          <div className="relative">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-110 transition-transform">
                              2
                            </div>
                            <div className="absolute top-10 left-1/2 -ml-px w-0.5 h-16 bg-gradient-to-b from-purple-500 to-green-500"></div>
                          </div>
                          <div className="flex-1 pt-2">
                            <h4 className="font-bold text-base text-purple-900 dark:text-purple-100 mb-2">
                              ✍️ Completa l'Esercizio
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              Lavora sul documento seguendo le istruzioni dell'esercizio
                            </p>
                          </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex items-start gap-4 group">
                          <div className="relative">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg group-hover:scale-110 transition-transform">
                              3
                            </div>
                          </div>
                          <div className="flex-1 pt-2">
                            <h4 className="font-bold text-base text-green-900 dark:text-green-100 mb-2">
                              ✅ Torna e Conferma
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                              Una volta completato, torna qui e spunta la casella:
                            </p>
                            {canSubmit && (
                              <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border-2 border-green-400 dark:border-green-600">
                                <input
                                  type="checkbox"
                                  id="confirm-work-platform-v2"
                                  checked={workPlatformCompleted}
                                  onChange={(e) => handleWorkPlatformConfirm(e.target.checked)}
                                  className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded mt-0.5 cursor-pointer"
                                />
                                <label htmlFor="confirm-work-platform-v2" className="text-sm font-semibold text-green-800 dark:text-green-200 cursor-pointer">
                                  Ho completato l'esercizio sulla piattaforma esterna
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Link documento */}
                      <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">📎 Link del documento:</p>
                        <p className="text-xs font-mono text-blue-600 dark:text-blue-400 break-all">{workPlatformUrl}</p>
                      </div>

                      {/* Status indicator */}
                      {canSubmit && (
                        <div className={`p-4 rounded-lg border-2 transition-all ${
                          workPlatformCompleted
                            ? 'bg-green-50 dark:bg-green-950/30 border-green-400 dark:border-green-600'
                            : 'bg-orange-50 dark:bg-orange-950/30 border-orange-400 dark:border-orange-600'
                        }`}>
                          <p className={`text-sm font-semibold ${
                            workPlatformCompleted ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'
                          }`}>
                            {workPlatformCompleted
                              ? '🎉 Perfetto! Ora puoi accedere a Domande e Consegna'
                              : '⚠️ Completa il documento esterno e spunta la casella sopra'
                            }
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Work Platform - Layout Version 3 (Compact Card) */}
                {workPlatformUrl && workPlatformUrl.trim() !== '' && layoutVersion === 3 && (
                  <Card data-testid="card-work-platform" className="border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 shadow-xl">
                    <CardContent className="p-6 space-y-4">
                      {/* Header compatto */}
                      <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg mb-2">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </div>
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                          🚀 Esercizio su Piattaforma Esterna
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Apri, completa e conferma in 3 semplici step
                        </p>
                      </div>

                      {/* Grid con steps compatti */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Step 1 */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800 text-center space-y-2">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold mx-auto text-sm">1</div>
                          <h4 className="font-bold text-sm text-blue-900 dark:text-blue-100">Apri</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Clicca per aprire il documento</p>
                        </div>

                        {/* Step 2 */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-purple-200 dark:border-purple-800 text-center space-y-2">
                          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold mx-auto text-sm">2</div>
                          <h4 className="font-bold text-sm text-purple-900 dark:text-purple-100">Completa</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Lavora sull'esercizio</p>
                        </div>

                        {/* Step 3 */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-green-200 dark:border-green-800 text-center space-y-2">
                          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold mx-auto text-sm">3</div>
                          <h4 className="font-bold text-sm text-green-900 dark:text-green-100">Conferma</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Spunta la casella</p>
                        </div>
                      </div>

                      {/* CTA Button */}
                      <Button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = workPlatformUrl;
                          link.target = '_blank';
                          link.rel = 'noopener noreferrer';
                          link.click();
                        }}
                        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-4 text-base shadow-lg hover:shadow-xl transition-all"
                        size="lg"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/>
                          <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        Apri Documento di Lavoro
                      </Button>

                      {/* Link compatto */}
                      <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">📎 Link:</p>
                        <p className="text-xs font-mono text-blue-600 dark:text-blue-400 break-all">{workPlatformUrl}</p>
                      </div>

                      {/* Checkbox conferma */}
                      {canSubmit && (
                        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-2 border-green-400 dark:border-green-600">
                          <input
                            type="checkbox"
                            id="confirm-work-platform-v3"
                            checked={workPlatformCompleted}
                            onChange={(e) => handleWorkPlatformConfirm(e.target.checked)}
                            className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer"
                          />
                          <label htmlFor="confirm-work-platform-v3" className="text-sm font-semibold text-green-800 dark:text-green-200 cursor-pointer flex-1">
                            ✅ Ho completato l'esercizio sulla piattaforma esterna
                          </label>
                        </div>
                      )}

                      {/* Status */}
                      {canSubmit && workPlatformCompleted && (
                        <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <p className="text-sm font-bold text-green-700 dark:text-green-300">
                            🎉 Completato! Puoi accedere a Domande e Consegna
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Exercise Details - Versione Compatta */}
                <Card data-testid="card-exercise-details" className="border-2 border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center space-x-2 text-lg">
                      <FileText size={18} className="text-indigo-600" />
                      <span className="text-indigo-900 dark:text-indigo-100 font-bold">Dettagli Esercizio</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Grid compatto 2 colonne */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Titolo - span 2 */}
                      <div className="col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                        <Label className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 block">Titolo</Label>
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-100" data-testid="text-exercise-title-detail">
                          {exercise.title}
                        </p>
                      </div>

                      {/* Stato */}
                      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                        <Label className="text-xs text-muted-foreground mb-1 block">Stato</Label>
                        {isCompleted ? (
                          <p className="text-xs font-semibold text-green-600 flex items-center gap-1">
                            <CheckCircle size={12} />✅ Completato
                          </p>
                        ) : (
                          <p className="text-xs font-semibold text-orange-600 flex items-center gap-1">
                            <AlertCircle size={12} />⏳ Da completare
                          </p>
                        )}
                      </div>

                      {/* Durata */}
                      {exercise.estimatedDuration && (
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                          <Label className="text-xs text-muted-foreground mb-1 block">Durata</Label>
                          <p className="text-xs font-semibold" data-testid="text-exercise-duration-detail">
                            ⏱️ {exercise.estimatedDuration} min
                          </p>
                        </div>
                      )}

                      {/* Categoria */}
                      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                        <Label className="text-xs text-muted-foreground mb-1 block">Categoria</Label>
                        <p className="text-xs font-semibold capitalize" data-testid="text-exercise-category-detail">
                          {exercise.category}
                        </p>
                      </div>

                      {/* Tipo */}
                      <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                        <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
                        <Badge variant={exercise.type === 'personalized' ? 'secondary' : 'outline'} className="text-xs h-5">
                          {exercise.type === 'personalized' ? '🎯 Personalizzato' : '📚 Generale'}
                        </Badge>
                      </div>

                      {/* Consulente */}
                      {assignment?.consultant && (
                        <div className="col-span-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                          <Label className="text-xs text-muted-foreground mb-1 block">Consulente</Label>
                          <p className="text-xs font-semibold" data-testid="text-exercise-consultant-detail">
                            👨‍💼 {String(assignment.consultant.firstName)} {String(assignment.consultant.lastName)}
                          </p>
                        </div>
                      )}

                      {/* Domande */}
                      {questions.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                          <Label className="text-xs text-muted-foreground mb-1 block">Domande</Label>
                          <p className="text-xs font-semibold" data-testid="text-exercise-questions-count">
                            📝 {String(questions.length)}
                          </p>
                        </div>
                      )}

                      {/* Priorità */}
                      {assignment?.priority && (
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                          <Label className="text-xs text-muted-foreground mb-1 block">Priorità</Label>
                          <p className="text-xs font-semibold capitalize" data-testid="text-exercise-priority-detail">
                            {assignment.priority === 'high' ? '🔥 Alta' :
                             assignment.priority === 'medium' ? '⚡ Media' : '🌿 Bassa'}
                          </p>
                        </div>
                      )}

                      {/* Scadenza - span 2 se presente */}
                      {assignment?.dueDate && (
                        <div className="col-span-2 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 p-3 rounded-lg border border-red-200 dark:border-red-800">
                          <Label className="text-xs font-medium text-red-600 dark:text-red-400 mb-1 block">⚡ Scadenza</Label>
                          <p className="text-xs font-semibold text-red-700 dark:text-red-300" data-testid="text-exercise-due-date-detail">
                            📅 {new Date(assignment.dueDate).toLocaleDateString('it-IT', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })} - {new Date(assignment.dueDate).toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Description */}
                <Card data-testid="card-description" className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/20 shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center space-x-3 text-xl">
                      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                        <FileText size={20} className="text-white" />
                      </div>
                      <span className="text-primary font-bold">
                        📖 Descrizione dell'Esercizio
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/30 p-6 rounded-xl border-l-4 border-primary shadow-inner">
                      <div className="prose max-w-none">
                        <p className="text-foreground whitespace-pre-wrap leading-relaxed text-base" data-testid="text-description">
                          {exercise.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Instructions */}
                {exercise.instructions && exercise.instructions.trim() !== '' ? (
                  <Card data-testid="card-instructions" className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/20 shadow-lg hover:shadow-xl transition-all duration-300">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center space-x-3 text-xl">
                          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                            <Info size={20} className="text-white" />
                          </div>
                          <span className="text-primary font-bold">
                            📋 Istruzioni Dettagliate
                          </span>
                        </CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowInstructions(!showInstructions)}
                          className="bg-primary text-white border-0 hover:bg-primary/90 transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                          {showInstructions ? (
                            <>
                              <EyeOff size={16} className="mr-2" />
                              <span className="hidden sm:inline">Nascondi</span>
                            </>
                          ) : (
                            <>
                              <Eye size={16} className="mr-2" />
                              <span className="hidden sm:inline">Mostra</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    {showInstructions && (
                      <CardContent>
                        <div className="bg-muted/30 p-6 rounded-xl border-l-4 border-primary shadow-inner">
                          <div className="prose max-w-none">
                            <p className="text-foreground whitespace-pre-wrap leading-relaxed text-base" data-testid="text-instructions">
                              {exercise.instructions}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ) : (
                  <Card className="border-2 border-dashed border-muted-foreground/20 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                    <CardContent className="p-8 text-center">
                      <div className="space-y-4">
                        <div className="w-16 h-16 bg-gradient-to-r from-gray-300 to-gray-400 rounded-full flex items-center justify-center mx-auto">
                          <AlertCircle size={32} className="text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-foreground mb-2">
                            📝 Istruzioni non ancora disponibili
                          </h3>
                          <p className="text-muted-foreground text-base">
                            Le istruzioni dettagliate per questo esercizio saranno aggiunte a breve.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}



                {/* Attachments */}
                {exercise.attachments && exercise.attachments.length > 0 && (
                  <Card data-testid="card-attachments">
                    <CardHeader>
                      <CardTitle>Materiali di supporto</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {exercise.attachments.map((attachment: string, index: number) => (
                          <div key={index} className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                            {getFileIcon(attachment)}
                            <span className="text-sm flex-1 truncate">{attachment}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = `/uploads/${attachment}`;
                                link.download = attachment;
                                link.target = '_blank';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              data-testid={`button-download-${index}`}
                            >
                              <Download size={14} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="questions" className="space-y-6 mt-6">
                {questions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex flex-col gap-1">
                          <CardTitle>
                            Domanda {currentQuestionIndex + 1} di {questions.length}
                          </CardTitle>
                          {questions[currentQuestionIndex]?.points && (
                            <Badge variant="secondary" className="w-fit">
                              <Award size={12} className="mr-1" />
                              {questions[currentQuestionIndex].points} {questions[currentQuestionIndex].points === 1 ? 'punto' : 'punti'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-3">
                          {(exercise as any)?.isExam && (exercise as any)?.examTimeLimit && isTimerActive && (
                            <div className="flex items-center space-x-2 px-3 py-1.5 bg-muted rounded-md">
                              <Clock size={16} className={timeElapsed > ((exercise as any).examTimeLimit * 60 * 0.9) ? "text-destructive" : "text-muted-foreground"} />
                              <span className={`text-sm font-medium ${timeElapsed > ((exercise as any).examTimeLimit * 60 * 0.9) ? "text-destructive" : ""}`}>
                                {(() => {
                                  const totalSeconds = ((exercise as any).examTimeLimit * 60) - timeElapsed;
                                  const hours = Math.floor(totalSeconds / 3600);
                                  const minutes = Math.floor((totalSeconds % 3600) / 60);
                                  const seconds = totalSeconds % 60;
                                  if (totalSeconds < 0) return "Tempo scaduto!";
                                  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                                  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                                })()}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={prevQuestion}
                              disabled={currentQuestionIndex === 0}
                            >
                              Precedente
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={nextQuestion}
                              disabled={currentQuestionIndex === questions.length - 1}
                            >
                              Successiva
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {questions[currentQuestionIndex] && (
                        <div className="space-y-4">
                          <div>
                            <Label className="text-base font-medium">
                              {questions[currentQuestionIndex].question}
                            </Label>
                          </div>

                          {questions[currentQuestionIndex].type === 'text' && (
                            <Textarea
                              placeholder="Inserisci la tua risposta..."
                              value={form.watch(`answers.${questions[currentQuestionIndex].id}`) || ""}
                              onChange={(e) => handleAnswerChange(questions[currentQuestionIndex].id, e.target.value)}
                              disabled={isCompleted || !canSubmit}
                              rows={6}
                              data-testid={`input-answer-${currentQuestionIndex}`}
                            />
                          )}

                          {questions[currentQuestionIndex].type === 'number' && (
                            <Input
                              type="number"
                              placeholder="Inserisci un numero..."
                              value={form.watch(`answers.${questions[currentQuestionIndex].id}`) || ""}
                              onChange={(e) => handleAnswerChange(questions[currentQuestionIndex].id, e.target.value)}
                              disabled={isCompleted || !canSubmit}
                              data-testid={`input-answer-${currentQuestionIndex}`}
                            />
                          )}

                          {questions[currentQuestionIndex].type === 'select' && questions[currentQuestionIndex].options && (
                            <Select
                              value={form.watch(`answers.${questions[currentQuestionIndex].id}`) || ""}
                              onValueChange={(value) => handleAnswerChange(questions[currentQuestionIndex].id, value)}
                              disabled={isCompleted || !canSubmit}
                            >
                              <SelectTrigger data-testid={`select-answer-${currentQuestionIndex}`}>
                                <SelectValue placeholder="Seleziona un'opzione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {questions[currentQuestionIndex].options.map((option: string, optIndex: number) => (
                                  <SelectItem key={optIndex} value={option} data-testid={`select-option-${currentQuestionIndex}-${optIndex}`}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {questions[currentQuestionIndex].type === 'true_false' && (
                            <div className="space-y-3">
                              {['Vero', 'Falso'].map((option: string, optIndex: number) => (
                                <label key={optIndex} className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`question-${questions[currentQuestionIndex].id}`}
                                    value={option}
                                    checked={form.watch(`answers.${questions[currentQuestionIndex].id}`) === option}
                                    onChange={(e) => handleAnswerChange(questions[currentQuestionIndex].id, e.target.value)}
                                    disabled={isCompleted || !canSubmit}
                                    data-testid={`radio-answer-${currentQuestionIndex}-${optIndex}`}
                                  />
                                  <span className="text-sm font-medium">{option}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          {questions[currentQuestionIndex].type === 'multiple_choice' && questions[currentQuestionIndex].options && (
                            <div className="space-y-3">
                              {questions[currentQuestionIndex].options.map((option: string, optIndex: number) => (
                                <label key={optIndex} className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`question-${questions[currentQuestionIndex].id}`}
                                    value={option}
                                    checked={form.watch(`answers.${questions[currentQuestionIndex].id}`) === option}
                                    onChange={(e) => handleAnswerChange(questions[currentQuestionIndex].id, e.target.value)}
                                    disabled={isCompleted || !canSubmit}
                                    data-testid={`radio-answer-${currentQuestionIndex}-${optIndex}`}
                                  />
                                  <span className="text-sm">{option}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          {questions[currentQuestionIndex].type === 'multiple_answer' && questions[currentQuestionIndex].options && (
                            <div className="space-y-3">
                              {questions[currentQuestionIndex].options.map((option: string, optIndex: number) => {
                                const currentAnswers = form.watch(`answers.${questions[currentQuestionIndex].id}`) || [];
                                const answersArray = Array.isArray(currentAnswers) ? currentAnswers : (currentAnswers ? [currentAnswers] : []);
                                const isChecked = answersArray.includes(option);

                                return (
                                  <label key={optIndex} className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                                    <input
                                      type="checkbox"
                                      value={option}
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const newAnswers = e.target.checked
                                          ? [...answersArray, option]
                                          : answersArray.filter((a: string) => a !== option);
                                        handleAnswerChange(questions[currentQuestionIndex].id, newAnswers);
                                      }}
                                      disabled={isCompleted || !canSubmit}
                                      data-testid={`checkbox-answer-${currentQuestionIndex}-${optIndex}`}
                                    />
                                    <span className="text-sm">{option}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          {questions[currentQuestionIndex].type === 'file_upload' && (
                            <div className="space-y-3">
                              <div className="p-4 border-2 border-dashed border-border rounded-lg hover:bg-muted/30 transition-colors">
                                <label className="flex flex-col items-center cursor-pointer">
                                  <input
                                    type="file"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        handleAnswerChange(questions[currentQuestionIndex].id, file.name);
                                      }
                                    }}
                                    disabled={isCompleted || !canSubmit}
                                    className="hidden"
                                    data-testid={`file-upload-${currentQuestionIndex}`}
                                  />
                                  <FileText className="h-12 w-12 text-muted-foreground mb-2" />
                                  <span className="text-sm font-medium mb-1">Carica file risposta</span>
                                  <span className="text-xs text-muted-foreground">Clicca per selezionare un file</span>
                                </label>
                                {form.watch(`answers.${questions[currentQuestionIndex].id}`) && (
                                  <div className="mt-3 p-2 bg-muted rounded-md flex items-center justify-between">
                                    <span className="text-sm truncate">{form.watch(`answers.${questions[currentQuestionIndex].id}`)}</span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleAnswerChange(questions[currentQuestionIndex].id, '')}
                                      disabled={isCompleted || !canSubmit}
                                    >
                                      <X size={14} />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {canSubmit && (
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              <Save size={12} />
                              <span>Progresso salvato automaticamente quando cambi domanda</span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Question Navigation */}
                {questions.length > 1 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Navigazione Domande</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                        {questions.map((_: any, index: number) => {
                          const isAnswered = !!form.watch(`answers.${questions[index].id}`);
                          const isCurrent = index === currentQuestionIndex;
                          return (
                            <Button
                              key={index}
                              variant={isCurrent ? "default" : isAnswered ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => goToQuestion(index)}
                              className="w-full aspect-square"
                            >
                              {index + 1}
                            </Button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="submission" className="space-y-6 mt-6">
                {canSubmit && (
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Come ti sei trovato? *</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Descrivi come hai affrontato l'esercizio, le difficoltà incontrate e cosa hai imparato. Minimo 50 caratteri.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          placeholder="Racconta la tua esperienza con questo esercizio... (minimo 50 caratteri)"
                          {...form.register("notes", {
                            onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                              // Trigger debounced auto-save during typing if conditions are met
                              if (assignmentId && assignment?.status !== 'completed' && canSubmit) {
                                const answers = form.getValues("answers");
                                const notes = e.target.value;

                                // Check if there are actual changes compared to last saved state
                                const answersChanged = JSON.stringify(answers) !== JSON.stringify(lastSavedAnswers);
                                const notesChanged = notes.trim() !== lastSavedNotes.trim();

                                // Only save if there are real changes and actual content
                                if ((answersChanged || notesChanged) && (Object.keys(answers).length > 0 || notes.trim())) {
                                  console.log('Scheduling debounced save during notes typing...');
                                  debouncedSave(answers, notes);
                                }
                              }
                            }
                          })}
                          rows={6}
                          data-testid="textarea-notes"
                        />
                        <div className="flex justify-between items-center mt-2">
                          <span className={`text-xs ${(form.watch("notes")?.length || 0) < 50 ? 'text-red-500' : 'text-green-600'}`}>
                            {form.watch("notes")?.length || 0}/50 caratteri minimi
                          </span>
                          {(form.watch("notes")?.length || 0) < 50 && (
                            <span className="text-xs text-red-500">
                              Ancora {50 - (form.watch("notes")?.length || 0)} caratteri
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Allegati per la consegna</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FileUpload
                          onFilesChange={setSubmissionFiles}
                          maxFiles={3}
                          data-testid="file-upload-submission"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          Puoi allegare fino a 3 file per supportare la tua risposta
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          {/* Salva bozza button */}
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                            <div>
                              <h4 className="font-medium text-sm">Salva il tuo progresso</h4>
                              <p className="text-xs text-muted-foreground">
                                Salva le tue risposte e note come bozza
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={saveOnQuestionChange}
                              disabled={saveDraftMutation.isPending}
                              className="flex items-center space-x-2"
                            >
                              <Save size={14} />
                              <span>{saveDraftMutation.isPending ? 'Salvando...' : 'Salva Bozza'}</span>
                            </Button>
                          </div>

                          {/* Submit button */}
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium">Pronto per inviare?</h3>
                              <p className="text-sm text-muted-foreground">
                                Verifica le tue risposte prima di procedere con la consegna
                              </p>
                            </div>
                            <Button
                              type="submit"
                              disabled={submitExerciseMutation.isPending}
                              size="lg"
                              data-testid="button-submit-exercise"
                            >
                              {submitExerciseMutation.isPending ? (
                                "Invio..."
                              ) : (
                                <>
                                  <Send size={16} className="mr-2" />
                                  Completa Esercizio
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </form>
                )}
              </TabsContent>

              {/* Consultant Review Tab */}
              {user?.role === 'consultant' && submission && (
                <TabsContent value="review" className="mt-6">
                  {/* Two Column Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Main Content (2/3 width) */}
                    <div className="lg:col-span-2 space-y-6">
                  {/* Client Answers */}
                  {submission.answers && submission.answers.length > 0 && (
                    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:border-blue-800 dark:bg-blue-950/20 shadow-lg">
                      <CardHeader className="pb-4 space-y-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                            <MessageSquare size={20} className="sm:size-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="font-bold text-lg sm:text-xl text-blue-900 dark:text-blue-100 truncate">
                              📋 Risposte del Cliente ({submission.answers.length})
                            </CardTitle>
                            <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 mt-1">
                              Revisiona le risposte fornite dal cliente
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {submission.answers.map((answer: any, index: number) => {
                          const question = exercise.questions?.find((q: any) => q.id === answer.questionId);

                          if (!question) {
                            return (
                              <div key={answer.questionId} className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 border-l-4 border-gray-400">
                                <p className="text-sm text-gray-600 dark:text-gray-400">Domanda non trovata</p>
                              </div>
                            );
                          }

                          // Determine question type badge
                          const getQuestionTypeBadge = (type: string) => {
                            const badges: Record<string, { label: string; color: string }> = {
                              text: { label: 'Testo Libero', color: 'bg-blue-100 text-blue-800 border-blue-300' },
                              number: { label: 'Numero', color: 'bg-purple-100 text-purple-800 border-purple-300' },
                              true_false: { label: 'Vero/Falso', color: 'bg-green-100 text-green-800 border-green-300' },
                              multiple_choice: { label: 'Scelta Multipla', color: 'bg-orange-100 text-orange-800 border-orange-300' },
                              multiple_answer: { label: 'Risposta Multipla', color: 'bg-pink-100 text-pink-800 border-pink-300' },
                              select: { label: 'Selezione', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
                              file_upload: { label: 'Upload File', color: 'bg-gray-100 text-gray-800 border-gray-300' },
                            };
                            return badges[type] || { label: type, color: 'bg-gray-100 text-gray-800 border-gray-300' };
                          };

                          // Check if answer is correct (for auto-gradable questions)
                          let isCorrect: boolean | null = null;
                          let correctAnswers: string[] = [];

                          if (question.correctAnswers && question.correctAnswers.length > 0) {
                            correctAnswers = question.correctAnswers;

                            if (question.type === 'true_false') {
                              // True/False questions - normalize both answers to lowercase
                              const studentAnswer = String(answer.answer).toLowerCase();
                              const correctAnswer = String(correctAnswers[0]).toLowerCase();
                              
                              // Map "vero" to "true" and "falso" to "false" for comparison
                              const normalizedStudent = studentAnswer === 'vero' ? 'true' : studentAnswer === 'falso' ? 'false' : studentAnswer;
                              const normalizedCorrect = correctAnswer === 'vero' ? 'true' : correctAnswer === 'falso' ? 'false' : correctAnswer;
                              
                              isCorrect = normalizedStudent === normalizedCorrect;
                            } else if (question.type === 'multiple_choice') {
                              // Single answer questions
                              const studentAnswer = typeof answer.answer === 'string' ? answer.answer : String(answer.answer);
                              isCorrect = correctAnswers.includes(studentAnswer);
                            } else if (question.type === 'multiple_answer') {
                              // Multiple answer questions
                              const studentAnswers = Array.isArray(answer.answer) ? answer.answer : [answer.answer];
                              isCorrect = studentAnswers.length === correctAnswers.length &&
                                         correctAnswers.every((ca: string) => studentAnswers.includes(ca)) &&
                                         studentAnswers.every((sa: string) => correctAnswers.includes(sa));
                            }
                          }

                          // Format student answer for display
                          const formatStudentAnswer = () => {
                            if (question.type === 'multiple_answer') {
                              const answers = Array.isArray(answer.answer) ? answer.answer : [answer.answer];
                              return (
                                <ul className="list-disc list-inside space-y-1">
                                  {answers.map((ans: string, idx: number) => {
                                    const optionText = question.options?.[parseInt(ans)] || ans;
                                    const isThisCorrect = correctAnswers.includes(ans);
                                    return (
                                      <li key={idx} className={`${isThisCorrect ? 'text-green-700 dark:text-green-300 font-medium' : 'text-red-600 dark:text-red-400'}`}>
                                        {isThisCorrect ? '✓' : '✗'} {optionText}
                                      </li>
                                    );
                                  })}
                                </ul>
                              );
                            } else if (question.type === 'multiple_choice' || question.type === 'select') {
                              const answerIndex = typeof answer.answer === 'string' ? parseInt(answer.answer) : answer.answer;
                              return question.options?.[answerIndex] || answer.answer;
                            } else if (question.type === 'true_false') {
                              // Handle both "Vero"/"Falso" (Italian) and "true"/"false" (English) formats
                              const answerStr = String(answer.answer);
                              if (answerStr === 'Vero' || answerStr === 'true') return 'Vero';
                              if (answerStr === 'Falso' || answerStr === 'false') return 'Falso';
                              return answer.answer;
                            } else {
                              return typeof answer.answer === 'string' ? answer.answer : JSON.stringify(answer.answer);
                            }
                          };

                          // Format correct answer for display
                          const formatCorrectAnswer = () => {
                            if (!correctAnswers || correctAnswers.length === 0) return null;

                            if (question.type === 'multiple_answer') {
                              return (
                                <ul className="list-disc list-inside space-y-1">
                                  {correctAnswers.map((ans: string, idx: number) => {
                                    const optionText = question.options?.[parseInt(ans)] || ans;
                                    return (
                                      <li key={idx} className="text-green-700 dark:text-green-300 font-medium">
                                        ✓ {optionText}
                                      </li>
                                    );
                                  })}
                                </ul>
                              );
                            } else if (question.type === 'multiple_choice' || question.type === 'select') {
                              const correctIndex = parseInt(correctAnswers[0]);
                              return question.options?.[correctIndex] || correctAnswers[0];
                            } else if (question.type === 'true_false') {
                              // Handle both "Vero"/"Falso" (Italian) and "true"/"false" (English) formats
                              const correctStr = String(correctAnswers[0]);
                              if (correctStr === 'Vero' || correctStr === 'true') return 'Vero';
                              if (correctStr === 'Falso' || correctStr === 'false') return 'Falso';
                              return correctAnswers[0];
                            } else {
                              return correctAnswers.join(', ');
                            }
                          };

                          const typeBadge = getQuestionTypeBadge(question.type);
                          const maxScore = question.points || 1;
                          const currentGrade = questionGrades[question.id];

                          // Determine border color based on correctness
                          let borderColor = 'border-blue-500';
                          if (isCorrect === true) {
                            borderColor = 'border-green-500';
                          } else if (isCorrect === false) {
                            borderColor = 'border-red-500';
                          }

                          return (
                            <div key={answer.questionId} className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border-l-4 ${borderColor} hover:shadow-lg transition-shadow`}>
                              <div className="space-y-3">
                                {/* Question Header */}
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                  <div className="flex-1 min-w-0">
                                    <Label className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                                      Domanda {index + 1}
                                    </Label>
                                    <p className="text-sm sm:text-base font-medium text-foreground mt-1">
                                      {question.question}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2 items-center">
                                    <Badge variant="outline" className={`${typeBadge.color} border font-medium text-xs whitespace-nowrap`}>
                                      {typeBadge.label}
                                    </Badge>
                                    {isCorrect === true && (
                                      <Badge className="bg-green-600 text-white font-bold text-xs whitespace-nowrap">
                                        <CheckCircle size={12} className="mr-1" />
                                        Corretta
                                      </Badge>
                                    )}
                                    {isCorrect === false && (
                                      <Badge className="bg-red-600 text-white font-bold text-xs whitespace-nowrap">
                                        <XCircle size={12} className="mr-1" />
                                        Errata
                                      </Badge>
                                    )}
                                    {isCorrect === null && correctAnswers.length === 0 && (
                                      <Badge className="bg-blue-600 text-white font-medium text-xs whitespace-nowrap">
                                        <Info size={12} className="mr-1" />
                                        Da valutare
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                {/* Student Answer */}
                                <div>
                                  <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1">
                                    <User size={12} />
                                    Risposta del cliente
                                  </Label>
                                  <div className={`text-sm sm:text-base mt-1 p-3 rounded-lg border ${
                                    isCorrect === true
                                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100'
                                      : isCorrect === false
                                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100'
                                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100'
                                  }`}>
                                    {formatStudentAnswer()}
                                  </div>
                                </div>

                                {/* Correct Answer (if available and answer is wrong) */}
                                {correctAnswers.length > 0 && isCorrect === false && (
                                  <div>
                                    <Label className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide flex items-center gap-1">
                                      <CheckCircle size={12} />
                                      Risposta corretta
                                    </Label>
                                    <div className="text-sm sm:text-base text-green-900 dark:text-green-100 mt-1 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                                      {formatCorrectAnswer()}
                                    </div>
                                  </div>
                                )}

                                {/* Show all options for context (optional - for multiple choice/answer) */}
                                {(question.type === 'multiple_choice' || question.type === 'multiple_answer' || question.type === 'select') && question.options && question.options.length > 0 && (
                                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                    <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                      Opzioni disponibili
                                    </Label>
                                    <ul className="mt-1 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                                      {question.options.map((opt: string, idx: number) => (
                                        <li key={idx} className="flex items-center gap-2">
                                          <span className="text-gray-400">{idx + 1}.</span>
                                          <span>{opt}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Manual grading section for consultant */}
                                {canReview && isCorrect === null && (
                                  <div className="pt-3 border-t border-purple-200 dark:border-purple-700 mt-3">
                                    <Label className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide flex items-center gap-1 mb-2">
                                      <Award size={12} />
                                      Assegna Punteggio (max {maxScore} {maxScore === 1 ? 'punto' : 'punti'})
                                    </Label>
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="number"
                                        min="0"
                                        max={maxScore}
                                        step="0.5"
                                        value={currentGrade !== undefined ? currentGrade : ''}
                                        onChange={(e) => {
                                          const value = parseFloat(e.target.value);
                                          if (!isNaN(value) && value >= 0 && value <= maxScore) {
                                            setQuestionGrades(prev => ({
                                              ...prev,
                                              [question.id]: value
                                            }));
                                          }
                                        }}
                                        placeholder={`0-${maxScore}`}
                                        className="w-24 h-8 text-sm"
                                      />
                                      <span className="text-xs text-gray-600 dark:text-gray-400">
                                        / {maxScore}
                                      </span>
                                      {currentGrade !== undefined && (
                                        <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 text-xs">
                                          {Math.round((currentGrade / maxScore) * 100)}%
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  )}
                    </div>

                    {/* Right Column - Sidebar Sticky (1/3 width) */}
                    <div className="lg:col-span-1 space-y-6">
                      <div className="lg:sticky lg:top-6 space-y-6">
                  {/* Auto-grading calculation display for consultant */}
                  {canReview && exercise?.questions && exercise.questions.length > 0 && (
                    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50/50 to-indigo-50/30 dark:border-purple-800 dark:bg-purple-950/20">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-3 text-lg">
                          <Award size={20} className="text-purple-600" />
                          <span className="text-purple-900 dark:text-purple-100">Calcolo Punteggio</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                          <div className="space-y-2">
                            {exercise.questions.map((q: any, idx: number) => {
                              const maxScore = q.points || 1;
                              const grade = questionGrades[q.id];
                              return (
                                <div key={q.id} className="flex items-center justify-between text-sm">
                                  <span className="text-gray-700 dark:text-gray-300">
                                    Domanda {idx + 1}
                                  </span>
                                  <span className="font-semibold">
                                    {grade !== undefined ? grade : 0} / {maxScore}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <Separator className="my-3" />
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-purple-900 dark:text-purple-100">
                              Punteggio Totale (0-100):
                            </span>
                            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                              {calculateTotalAutoGrading()}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                          💡 Questo punteggio viene calcolato automaticamente in base ai punteggi che assegni a ogni domanda. 
                          Verrà utilizzato come voto finale se confermi il completamento.
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Review Actions */}
                  {canReview && (
                    <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                      <CardHeader>
                        <CardTitle className="text-orange-800 dark:text-orange-200 text-base">
                          Azioni di Revisione
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col gap-3">
                          <Button
                            onClick={() => handleReviewSubmission('complete')}
                            className="w-full bg-green-600 hover:bg-green-700 text-white"
                            size="lg"
                          >
                            <Award size={16} className="mr-2" />
                            Completa e Assegna Voto
                          </Button>
                          <Button
                            onClick={() => handleReviewSubmission('return')}
                            variant="outline"
                            className="w-full border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-600 dark:text-orange-300 dark:hover:bg-orange-900"
                          >
                            <RefreshCcw size={16} className="mr-2" />
                            Rimanda al Cliente
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Client Info */}
                  <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:border-blue-800 dark:bg-blue-950/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center space-x-2 text-base">
                        <User size={18} className="text-blue-600" />
                        <span className="text-blue-900 dark:text-blue-100 font-bold">
                          Info Cliente
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
                          Consegnato:
                        </Label>
                        <p className="text-sm font-semibold">
                          {submission.submittedAt ? formatDate(submission.submittedAt) : 'Data non disponibile'}
                        </p>
                      </div>

                      {/* Note finali del cliente */}
                      {submission.notes && submission.notes.trim() && (
                        <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border-l-4 border-green-500">
                          <Label className="text-xs font-bold text-green-900 dark:text-green-100 uppercase tracking-wide mb-2 block flex items-center gap-1">
                            <MessageSquare size={14} className="text-green-600" />
                            Note del Cliente
                          </Label>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-800 dark:text-gray-200">
                            {submission.notes}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                      </div>
                    </div>
                  </div>

                  {/* Client Attachments - Show all attachments from all submissions - Full Width Below */}
                  {(() => {
                    // Collect all attachments from all submissions
                    const allAttachments = allSubmissions && allSubmissions.length > 0
                      ? allSubmissions
                          .filter(sub => sub.attachments && sub.attachments.length > 0)
                          .flatMap((sub, submissionIndex) =>
                            sub.attachments.map((attachment: string) => ({
                              filename: attachment,
                              submissionDate: sub.submittedAt,
                              submissionNumber: submissionIndex + 1,
                              submissionId: sub.id
                            }))
                          )
                          .sort((a, b) => new Date(a.submissionDate).getTime() - new Date(b.submissionDate).getTime())
                      : [];

                    return allAttachments.length > 0 ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center space-x-2">
                            <Download size={20} />
                            <span>Tutti gli Allegati del Cliente ({String(allAttachments.length)} file da {String(allSubmissions?.filter(s => s.attachments && s.attachments.length > 0).length || 0)} consegne)</span>
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-2">
                            Tutti i file che il cliente ha allegato in tutte le sue consegne per questo esercizio
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {allSubmissions
                              ?.filter(sub => sub.attachments && sub.attachments.length > 0)
                              .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
                              .map((sub, submissionIndex) => (
                                <div key={sub.id} className="border border-muted rounded-lg p-4 bg-white dark:bg-gray-800">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                                        Consegna #{submissionIndex + 1}:
                                      </span>
                                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                        {String(sub.attachments?.length || 0)} file
                                      </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(sub.submittedAt).toLocaleDateString('it-IT', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {sub.attachments?.map((attachment: string, attachmentIndex: number) => (
                                      <div key={attachmentIndex} className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                                        {getFileIcon(attachment)}
                                        <span className="text-sm flex-1 truncate" title={attachment}>{attachment}</span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = `/uploads/${attachment}`;
                                            link.download = attachment;
                                            link.target = '_blank';
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                          }}
                                          title={`Scarica ${attachment}`}
                                        >
                                          <Download size={14} />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="border-dashed border-2 border-muted-foreground/20">
                        <CardContent className="p-6 text-center">
                          <Download size={24} className="mx-auto text-muted-foreground mb-2" />
                          <p className="text-muted-foreground">
                            Il cliente non ha allegato file in nessuna consegna per questo esercizio
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })()}
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Mobile-friendly Quick Stats - Only show on larger screens */}
          <div className="hidden lg:block lg:col-span-1 space-y-6">
            {/* Quick Stats */}
            <Card data-testid="card-quick-stats">
              <CardHeader>
                <CardTitle className="text-base">Riepilogo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Domande totali</Label>
                    <p className="text-sm font-medium">{String(questions.length)}</p>
                  </div>
                )}

                {exercise.attachments && exercise.attachments.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Materiali allegati</Label>
                    <p className="text-sm font-medium">{String(exercise.attachments.length)} file</p>
                  </div>
                )}

                {assignment?.createdAt && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Assegnato il</Label>
                    <p className="text-sm font-medium">
                      {new Date(assignment.createdAt).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats for this exercise */}
            {canSubmit && questions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Il tuo progresso</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Domande completate</span>
                    <span className="text-sm font-medium">{getAnsweredQuestions()}/{getTotalQuestions()}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Tempo trascorso</span>
                    <span className="text-sm font-medium">{formatTime(timeElapsed)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm">Progresso</span>
                    <span className="text-sm font-medium">{getProgressPercentage()}%</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Completion Status */}
            {isCompleted && assignment?.completedAt && (
              <Card className="border-success/30 bg-success/5" data-testid="card-completion-status">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="text-success" size={20} />
                    <span className="font-medium text-success">Esercizio Completato</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Completato il {new Date(assignment.completedAt).toLocaleDateString('it-IT')}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Tips and encouragement */}
            {canSubmit && !isCompleted && (
              <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                <CardHeader>
                  <CardTitle className="text-base flex items-center space-x-2">
                    <BookOpen size={16} />
                    <span>Suggerimenti</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p>• Leggi attentamente ogni domanda prima di rispondere</p>
                  <p>• Le tue risposte vengono salvate automaticamente</p>
                  <p>• Puoi navigare tra le domande liberamente</p>
                  <p>• Controlla tutte le risposte prima di inviare</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Mobile-only Progress Card at bottom */}
        {canSubmit && questions.length > 0 && (
          <div className="lg:hidden mt-6">
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
              <CardHeader>
                <CardTitle className="text-base flex items-center space-x-2">
                  <BookOpen size={16} />
                  <span>Il tuo progresso</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center">
                    <Label className="text-xs text-muted-foreground">Completate</Label>
                    <p className="font-medium">{getAnsweredQuestions()}/{getTotalQuestions()}</p>
                  </div>
                  <div className="text-center">
                    <Label className="text-xs text-muted-foreground">Tempo</Label>
                    <p className="font-medium">{formatTime(timeElapsed)}</p>
                  </div>
                </div>
                <div className="text-center">
                  <Label className="text-xs text-muted-foreground">Progresso</Label>
                  <p className="font-medium text-lg">{getProgressPercentage()}%</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <AlertDialogHeader className="flex-shrink-0">
            <AlertDialogTitle>Conferma Consegna Esercizio</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p className="text-sm">Stai per inviare l'esercizio "{exercise?.title}". Ecco il riepilogo:</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <div className="space-y-3">
              <div className="bg-muted p-3 rounded-lg space-y-3">
                {/* Work Platform Status */}
                {workPlatformUrl && workPlatformUrl.trim() !== '' && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Piattaforma di lavoro:</h4>
                    <div className="flex items-center space-x-2">
                      {workPlatformCompleted ? (
                        <>
                          <CheckCircle size={14} className="text-green-600 flex-shrink-0" />
                          <span className="text-xs text-green-600">Confermato completamento su piattaforma esterna</span>
                        </>
                      ) : (
                        <>
                          <X size={14} className="text-red-600 flex-shrink-0" />
                          <span className="text-xs text-red-600">Non confermato</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Questions Status */}
                {questions && questions.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Risposte fornite:</h4>
                    <div className="flex items-center space-x-2 mb-2">
                      {getAnsweredQuestions() === getTotalQuestions() ? (
                        <>
                          <CheckCircle size={14} className="text-green-600 flex-shrink-0" />
                          <span className="text-xs text-green-600">
                            {getAnsweredQuestions()} su {getTotalQuestions()} domande completate
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={14} className="text-orange-600 flex-shrink-0" />
                          <span className="text-xs text-orange-600">
                            {getAnsweredQuestions()} su {getTotalQuestions()} domande completate
                          </span>
                        </>
                      )}
                    </div>
                    {/* Dettaglio risposte - scrollabile */}
                    <div className="mt-2 max-h-48 overflow-y-auto border border-muted rounded p-2 bg-background/50 custom-scrollbar">
                      <div className="space-y-1.5">
                        {questions.map((question: any, index: number) => {
                          const answer = form.getValues(`answers.${question.id}`);
                          const hasAnswer = answer && (
                            (typeof answer === 'string' && answer.trim() !== '') ||
                            (Array.isArray(answer) && answer.length > 0)
                          );
                          return (
                            <div key={question.id} className="flex items-start gap-2 text-xs border-b border-muted/50 pb-1.5 last:border-0">
                              {hasAnswer ? (
                                <CheckCircle size={12} className="text-green-600 mt-0.5 flex-shrink-0" />
                              ) : (
                                <XCircle size={12} className="text-red-600 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div>
                                  <span className={`font-medium ${hasAnswer ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                    Q{index + 1}:
                                  </span>{' '}
                                  <span className="text-muted-foreground">
                                    {question.question.length > 80 ? question.question.substring(0, 80) + '...' : question.question}
                                  </span>
                                </div>
                                {hasAnswer && (
                                  <div className="text-xs text-muted-foreground/80 mt-0.5 italic pl-2 border-l-2 border-green-300 dark:border-green-700">
                                    {typeof answer === 'string' 
                                      ? answer.substring(0, 60) + (answer.length > 60 ? '...' : '')
                                      : Array.isArray(answer) 
                                      ? `${answer.length} opzioni selezionate`
                                      : String(answer).substring(0, 60)
                                    }
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold text-sm mb-1">Note e riflessioni:</h4>
                  <div className="bg-background p-2 rounded border max-h-24 overflow-y-auto custom-scrollbar">
                    <p className="text-xs whitespace-pre-wrap">
                      {form.getValues("notes") || "Nessuna nota"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.getValues("notes")?.length || 0} caratteri
                  </p>
                </div>

                {submissionFiles.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm mb-1">File allegati:</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {submissionFiles.map((file, index) => (
                        <li key={index} className="flex items-center space-x-2">
                          <FileText size={12} className="flex-shrink-0" />
                          <span className="truncate">{file.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold text-sm mb-1">Tempo impiegato:</h4>
                  <p className="text-xs text-muted-foreground">{formatTime(timeElapsed)}</p>
                </div>
              </div>

              <div className="text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded border-l-4 border-amber-400 dark:border-amber-600">
                <strong>Nota importante:</strong> Una volta inviato, l'esercizio sarà sottoposto a revisione dal tuo consulente.
                Non potrai più modificare le tue risposte.
              </div>
            </div>
          </div>

          <AlertDialogFooter className="flex-shrink-0 mt-4">
            <AlertDialogCancel>Modifica ancora</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSubmission}
              disabled={
                submitExerciseMutation.isPending ||
                (workPlatformUrl && workPlatformUrl.trim() !== '' && !workPlatformCompleted) ||
                (questions && questions.length > 0 && getAnsweredQuestions() < getTotalQuestions())
              }
            >
              {submitExerciseMutation.isPending ? "Invio..." : "Conferma e Invia"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Review Dialog for Consultants */}
      <AlertDialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reviewForm.action === 'complete' ? 'Completa Esercizio' : 'Rimanda al Cliente'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  {reviewForm.action === 'complete'
                    ? 'Stai per completare l\'esercizio e assegnare un voto finale.'
                    : 'Stai per rimandare l\'esercizio al cliente per delle correzioni.'
                  }
                </p>

                <div className="space-y-4">
                  {reviewForm.action === 'complete' && (
                    <div>
                      <Label htmlFor="review-score">Voto (0-100) *</Label>
                      <Input
                        id="review-score"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Inserisci un voto da 0 a 100"
                        value={reviewForm.score}
                        onChange={(e) => setReviewForm({ ...reviewForm, score: e.target.value })}
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="review-feedback">
                      {reviewForm.action === 'complete' ? 'Feedback (opzionale)' : 'Spiegazione per il cliente *'}
                    </Label>
                    <Textarea
                      id="review-feedback"
                      placeholder={
                        reviewForm.action === 'complete'
                          ? "Scrivi un feedback per il cliente..."
                          : "Spiega al cliente cosa deve correggere o migliorare..."
                      }
                      value={reviewForm.feedback}
                      onChange={(e) => setReviewForm({ ...reviewForm, feedback: e.target.value })}
                      rows={4}
                    />
                  </div>
                </div>

                {reviewForm.action === 'complete' ? (
                  <div className="bg-green-50 dark:bg-green-950 p-3 rounded border-l-4 border-green-500">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      <strong>Completamento:</strong> Una volta confermato, l'esercizio sarà marcato come completato
                      e il cliente potrà vedere il voto e il feedback.
                    </p>
                  </div>
                ) : (
                  <div className="bg-orange-50 dark:bg-orange-950 p-3 rounded border-l-4 border-orange-500">
                    <p className="text-sm text-orange-700 dark:text-orange-300">
                      <strong>Restituzione:</strong> L'esercizio tornerà in stato "in corso" e il cliente
                      potrà vedere il tuo feedback e apportare le correzioni richieste.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowReviewDialog(false);
              setReviewForm({ score: '', feedback: '', action: 'complete' });
            }}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitReview}
              disabled={reviewMutation.isPending}
              className={reviewForm.action === 'complete' ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}
            >
              {reviewMutation.isPending ? "Elaborando..." : (
                reviewForm.action === 'complete' ? 'Completa Esercizio' : 'Rimanda al Cliente'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* AI Assistant con page context */}
      <AIAssistant pageContext={pageContext} />
    </div>
  );
}