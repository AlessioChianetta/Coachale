import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  PlusCircle,
  Search,
  Filter,
  Edit,
  Eye,
  Calendar,
  Target,
  BarChart3,
  ExternalLink,
  PlayCircle,
  MessageSquare,
  Activity,
  TrendingUp,
  X,
  ArrowLeft,
  Sparkles,
  BookOpen,
  Award,
  Timer,
  Loader2,
  Trash2,
  Edit2,
  FileText,
  MessageCircle,
  Phone,
  Globe,
  ChevronDown,
  ChevronRight,
  User,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import ExerciseForm from "@/components/exercise-form";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox"; // Import Checkbox

interface ExerciseAssignment {
  id: string;
  exerciseId: string;
  clientId: string;
  consultantId: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'completed' | 'rejected' | 'returned';
  assignedAt: string;
  dueDate?: string;
  completedAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  score?: number;
  consultantFeedback?: string | any[]; // Feedback can be a string or an array of objects
  priority?: 'low' | 'medium' | 'high';
  exercise?: Exercise;
  client?: User & { phoneNumber?: string }; // Include phoneNumber in the client type
  autoGradedScore?: number;
  questionGrades?: Array<{ questionId: string; score: number; maxScore: number; isCorrect?: boolean; feedback?: string }>;
  examSubmittedAt?: Date | string;
}

interface ClientWithExercises {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  assignments: ExerciseAssignment[];
  totalAssigned: number;
  completed: number;
  inProgress: number;
  pending: number;
  returned: number;
  submitted: number;
}

export default function ConsultantExercises() {
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'details' | 'edit'>('list');
  const [deletingExercise, setDeletingExercise] = useState<Exercise | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<ExerciseAssignment | null>(null);
  const [reviewForm, setReviewForm] = useState({ score: '', feedback: '' });
  const [reviewData, setReviewData] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [questionGrades, setQuestionGrades] = useState<Array<{ questionId: string; score: number; maxScore: number; isCorrect?: boolean; feedback?: string }>>([]);
  const [loadingReviewData, setLoadingReviewData] = useState(false);
  const [editingClient, setEditingClient] = useState<{ client: User & { phoneNumber?: string }, phoneNumber: string } | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, Record<string, boolean>>>({});
  const [whatsappConfirmDialog, setWhatsappConfirmDialog] = useState<{ assignment: ExerciseAssignment, message: string } | null>(null);
  const [editConfirmDialog, setEditConfirmDialog] = useState<{ exercise: Exercise, assignments: ExerciseAssignment[] } | null>(null);
  const { toast } = useToast();

  // State for selected clients in the ClientSelector component
  const [selectedClients, setSelectedClients] = useState<string[]>([]);


  const isMobile = window.innerWidth < 768; // Define isMobile based on a breakpoint

  // Function to get category label
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "post-consulenza": return "Post Consulenza";
      case "newsletter": return "Metodo Orbitale - Finanza";
      case "metodo-turbo": return "Metodo Turbo - Vendita";
      case "metodo-hybrid": return "Metodo Hybrid - Azienda";
      case "finanza-personale": return "Finanza Personale";
      case "vendita": return "Vendita";
      case "marketing": return "Marketing";
      case "imprenditoria": return "Imprenditoria";
      case "risparmio-investimenti": return "Risparmio & Investimenti";
      case "contabilità": return "Contabilità";
      case "gestione-risorse": return "Gestione Risorse";
      case "strategia": return "Strategia";
      default: return "Generale";
    }
  };

  // Function to get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "post-consulenza": return "📝";
      case "newsletter": return "🌟";
      case "metodo-turbo": return "⚡";
      case "metodo-hybrid": return "🔄";
      case "finanza-personale": return "💰";
      case "vendita": return "💼";
      case "marketing": return "📈";
      case "imprenditoria": return "🚀";
      case "risparmio-investimenti": return "💎";
      case "contabilità": return "📊";
      case "gestione-risorse": return "⚙️";
      case "strategia": return "🎯";
      default: return "💪";
    }
  };

  // Function to group assignments by category
  const groupAssignmentsByCategory = (assignments: any[]) => {
    const grouped: Record<string, any[]> = {};
    assignments.forEach(assignment => {
      const exercise = exercises.find((e: Exercise) => e.id === assignment.exerciseId);
      if (exercise) {
        const category = exercise.category || 'generale';
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(assignment);
      }
    });
    return grouped;
  };

  // Function to toggle category expansion
  const toggleCategory = (clientId: string, category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [clientId]: {
        ...prev[clientId],
        [category]: !prev[clientId]?.[category]
      }
    }));
  };

  // Function to check if category is expanded (default: all collapsed)
  const isCategoryExpanded = (clientId: string, category: string) => {
    return expandedCategories[clientId]?.[category] || false;
  };
  const queryClient = useQueryClient();

  // Fetch templates for template preloading
  const { data: templates = [] } = useQuery({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const response = await fetch("/api/templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });

  // Handle template parameter from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const templateId = urlParams.get('template');

    if (templateId && templates.length > 0) {
      const template = templates.find((t: any) => t.id === templateId);
      if (template) {
        setSelectedTemplate(template);
        setShowExerciseForm(true);
        // Clear the URL parameter
        setLocation('/consultant/exercises');
      }
    }
  }, [location, templates, setLocation]);

  // Fetch clients data
  const { data: clients = [] } = useQuery<User[]>({
    queryKey: ["/api/clients", "active"],
    queryFn: async () => {
      const response = await fetch("/api/clients?activeOnly=true", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  // Fetch exercises data with real-time updates
  const { data: exercises = [] } = useQuery<Exercise[]>({
    queryKey: ["/api/exercises"],
    queryFn: async () => {
      const response = await fetch("/api/exercises", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch exercises");
      return response.json();
    },
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  // Fetch assignments data with real-time updates
  const { data: assignmentsData = [] } = useQuery<ExerciseAssignment[]>({
    queryKey: ["/api/exercise-assignments/consultant"],
    queryFn: async () => {
      const response = await fetch("/api/exercise-assignments/consultant", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch assignments");
      return response.json();
    },
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });

  // Create exercise mutation
  const createExerciseMutation = useMutation({
    mutationFn: async ({ exerciseData, files }: { exerciseData: any, files: File[] }) => {
      console.log('🎯 CREATE EXERCISE MUTATION FUNCTION START', {
        timestamp: new Date().toISOString(),
        exerciseData,
        hasLibraryDocumentId: !!exerciseData.libraryDocumentId,
        libraryDocumentId: exerciseData.libraryDocumentId
      });

      const formData = new FormData();

      // Add all exercise fields
      formData.append('title', exerciseData.title);
      formData.append('description', exerciseData.description);
      formData.append('type', exerciseData.type);
      formData.append('category', exerciseData.category);

      if (exerciseData.instructions) {
        formData.append('instructions', exerciseData.instructions);
      }
      if (exerciseData.estimatedDuration) {
        formData.append('estimatedDuration', exerciseData.estimatedDuration.toString());
      }
      if (exerciseData.priority) {
        formData.append('priority', exerciseData.priority);
      }
      if (exerciseData.workPlatform) {
        console.log('🔗 APPENDING workPlatform', exerciseData.workPlatform);
        formData.append('workPlatform', exerciseData.workPlatform);
      }
      if (exerciseData.libraryDocumentId) {
        console.log('📖 APPENDING libraryDocumentId', {
          libraryDocumentId: exerciseData.libraryDocumentId,
          type: typeof exerciseData.libraryDocumentId,
          length: exerciseData.libraryDocumentId.length
        });
        formData.append('libraryDocumentId', exerciseData.libraryDocumentId);
      } else {
        console.log('⚠️ NO libraryDocumentId TO APPEND', {
          libraryDocumentId: exerciseData.libraryDocumentId,
          isUndefined: exerciseData.libraryDocumentId === undefined,
          isNull: exerciseData.libraryDocumentId === null,
          isEmpty: exerciseData.libraryDocumentId === ''
        });
      }
      if (exerciseData.questions && exerciseData.questions.length > 0) {
        formData.append('questions', JSON.stringify(exerciseData.questions));
      }

      // Add public/client assignment
      formData.append('isPublic', exerciseData.isPublic.toString());
      if (!exerciseData.isPublic && exerciseData.selectedClients && exerciseData.selectedClients.length > 0) {
        formData.append('selectedClients', JSON.stringify(exerciseData.selectedClients));
      }

      // Add custom platform links
      if (exerciseData.customPlatformLinks && Object.keys(exerciseData.customPlatformLinks).length > 0) {
        formData.append('customPlatformLinks', JSON.stringify(exerciseData.customPlatformLinks));
      }

      // Add exam-specific fields
      if (exerciseData.isExam !== undefined) {
        formData.append('isExam', exerciseData.isExam.toString());
      }
      if (exerciseData.examDate) {
        formData.append('examDate', exerciseData.examDate);
      }
      if (exerciseData.yearId) {
        formData.append('yearId', exerciseData.yearId);
      }
      if (exerciseData.trimesterId) {
        formData.append('trimesterId', exerciseData.trimesterId);
      }
      if (exerciseData.autoCorrect !== undefined) {
        formData.append('autoCorrect', exerciseData.autoCorrect.toString());
      }
      if (exerciseData.totalPoints) {
        formData.append('totalPoints', exerciseData.totalPoints.toString());
      }
      if (exerciseData.passingScore) {
        formData.append('passingScore', exerciseData.passingScore.toString());
      }
      if (exerciseData.examTimeLimit) {
        formData.append('examTimeLimit', exerciseData.examTimeLimit.toString());
      }

      // Add files
      files.forEach(file => {
        formData.append('attachments', file);
      });

      console.log('📤 FORMDATA PREPARED - Logging all entries:');
      for (let pair of formData.entries()) {
        console.log(`  ${pair[0]}:`, pair[1]);
      }

      console.log('🚀 CALLING fetch POST /api/exercises');
      // For FormData, we must let the browser set Content-Type with boundary
      const authHeaders = getAuthHeaders();
      const response = await fetch("/api/exercises", {
        method: "POST",
        headers: authHeaders, // Browser will add Content-Type automatically for FormData
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ ERROR RESPONSE FROM POST /api/exercises', errorData);
        throw new Error(errorData.message || "Failed to create exercise");
      }
      const result = await response.json();
      console.log('✅ SUCCESS RESPONSE FROM POST /api/exercises', result);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-assignments/consultant"] });
      setShowExerciseForm(false);
      setSelectedTemplate(null);
      console.log('✅ SUCCESS IN ON onSuccess CALLBACK', { data });
      toast({
        title: "Successo",
        description: data.message || "Esercizio creato e assegnato con successo",
      });
    },
    onError: (error: any) => {
      console.error('❌ ERROR IN ON onError CALLBACK', { error });
      toast({
        title: "Errore",
        description: error.message || "Errore durante la creazione dell'esercizio",
        variant: "destructive",
      });
    },
  });

  // Update exercise mutation
  const updateExerciseMutation = useMutation({
    mutationFn: async ({ exerciseId, exerciseData, files }: { exerciseId: string, exerciseData: any, files: File[] }) => {
      console.log('🔄 UPDATE EXERCISE MUTATION FUNCTION START', {
        timestamp: new Date().toISOString(),
        exerciseId,
        exerciseData,
        hasLibraryDocumentId: !!exerciseData.libraryDocumentId
      });

      const formData = new FormData();

      // Add all exercise fields
      if (exerciseData.title) formData.append('title', exerciseData.title);
      if (exerciseData.description) formData.append('description', exerciseData.description);
      if (exerciseData.type) formData.append('type', exerciseData.type);
      if (exerciseData.category) formData.append('category', exerciseData.category);

      if (exerciseData.instructions !== undefined) {
        formData.append('instructions', exerciseData.instructions);
      }
      if (exerciseData.estimatedDuration) {
        formData.append('estimatedDuration', exerciseData.estimatedDuration.toString());
      }
      if (exerciseData.priority) {
        formData.append('priority', exerciseData.priority);
      }
      if (exerciseData.workPlatform !== undefined) {
        formData.append('workPlatform', exerciseData.workPlatform || '');
      }
      if (exerciseData.libraryDocumentId !== undefined) {
        formData.append('libraryDocumentId', exerciseData.libraryDocumentId || '');
      }
      if (exerciseData.questions) {
        formData.append('questions', JSON.stringify(exerciseData.questions));
      }

      // Add public flag
      if (exerciseData.isPublic !== undefined) {
        formData.append('isPublic', exerciseData.isPublic.toString());
      }

      // Add exam-specific fields
      if (exerciseData.isExam !== undefined) {
        formData.append('isExam', exerciseData.isExam.toString());
      }
      if (exerciseData.examDate) {
        formData.append('examDate', exerciseData.examDate);
      }
      if (exerciseData.yearId !== undefined) {
        formData.append('yearId', exerciseData.yearId || '');
      }
      if (exerciseData.trimesterId !== undefined) {
        formData.append('trimesterId', exerciseData.trimesterId || '');
      }
      if (exerciseData.autoCorrect !== undefined) {
        formData.append('autoCorrect', exerciseData.autoCorrect.toString());
      }
      if (exerciseData.totalPoints) {
        formData.append('totalPoints', exerciseData.totalPoints.toString());
      }
      if (exerciseData.passingScore) {
        formData.append('passingScore', exerciseData.passingScore.toString());
      }
      if (exerciseData.examTimeLimit) {
        formData.append('examTimeLimit', exerciseData.examTimeLimit.toString());
      }

      // Add new files
      files.forEach(file => {
        formData.append('attachments', file);
      });

      console.log('🚀 CALLING fetch PUT /api/exercises/' + exerciseId);
      // For FormData, we must let the browser set Content-Type with boundary
      const authHeaders = getAuthHeaders();
      const response = await fetch(`/api/exercises/${exerciseId}`, {
        method: "PUT",
        headers: authHeaders, // Browser will add Content-Type automatically for FormData
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ ERROR RESPONSE FROM PUT /api/exercises', errorData);
        throw new Error(errorData.message || "Failed to update exercise");
      }
      const result = await response.json();
      console.log('✅ SUCCESS RESPONSE FROM PUT /api/exercises', result);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-assignments/consultant"] });
      setShowExerciseForm(false);
      setSelectedExercise(null);
      setViewMode('list');
      console.log('✅ SUCCESS IN ON onSuccess CALLBACK FOR UPDATE', { data });
      toast({
        title: "Successo",
        description: data.message || "Esercizio aggiornato con successo",
      });
    },
    onError: (error: any) => {
      console.error('❌ ERROR IN ON onError CALLBACK FOR UPDATE', { error });
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento dell'esercizio",
        variant: "destructive",
      });
    },
  });

  // Delete exercise mutation
  const deleteExerciseMutation = useMutation({
    mutationFn: async (exerciseId: string) => {
      console.log('🔥 DELETE EXERCISE MUTATION FUNCTION START', { exerciseId });
      const response = await fetch(`/api/exercises/${exerciseId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ ERROR RESPONSE FROM DELETE /api/exercises', { exerciseId, errorData });
        throw new Error(errorData.message || "Failed to delete exercise");
      }
      const result = await response.json();
      console.log('✅ SUCCESS RESPONSE FROM DELETE /api/exercises', { exerciseId, result });
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercises"] });
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-assignments/consultant"] });
      setDeletingExercise(null);
      setDeleteConfirmation("");
      console.log('✅ SUCCESS IN ON onSuccess CALLBACK FOR DELETE', { data });
      toast({
        title: "Successo",
        description: data.message || "Esercizio eliminato con successo",
      });
    },
    onError: (error: any) => {
      console.error('❌ ERROR IN ON onError CALLBACK FOR DELETE', { error });
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'eliminazione dell'esercizio",
        variant: "destructive",
      });
    },
  });

  // Update WhatsApp sent status mutation
  const updateWhatsappSentMutation = useMutation({
    mutationFn: async ({ assignmentId, sent }: { assignmentId: string, sent: boolean }) => {
      console.log('📲 UPDATE WHATSAPP SENT MUTATION FUNCTION START', { assignmentId, sent });
      const response = await fetch(`/api/exercise-assignments/${assignmentId}/whatsapp-sent`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ whatsappSent: sent }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ ERROR RESPONSE FROM PATCH /api/exercise-assignments/${assignmentId}/whatsapp-sent', { assignmentId, sent, errorData });
        throw new Error(errorData.message || "Failed to update WhatsApp status");
      }
      const result = await response.json();
      console.log('✅ SUCCESS RESPONSE FROM PATCH /api/exercise-assignments/${assignmentId}/whatsapp-sent', { assignmentId, sent, result });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-assignments/consultant"] });
      console.log('✅ SUCCESS IN ON onSuccess CALLBACK FOR UPDATE WHATSAPP SENT');
    },
    onError: (error: any) => {
      console.error('❌ ERROR IN ON onErrorCALLBACK FOR UPDATE WHATSAPP SENT', { error });
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento dello stato WhatsApp",
        variant: "destructive",
      });
    },
  });

  // Review assignment mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ assignmentId, score, feedback, questionGrades }: { assignmentId: string, score?: number, feedback: string, questionGrades?: any[] }) => {
      console.log('⭐ REVIEW MUTATION FUNCTION START', { assignmentId, score, feedback, questionGrades });
      const response = await fetch(`/api/exercise-assignments/${assignmentId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ score, feedback, questionGrades }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ ERROR RESPONSE FROM POST /api/exercise-assignments/${assignmentId}/review', { assignmentId, score, feedback, questionGrades, errorData });
        throw new Error(errorData.message || "Failed to submit review");
      }
      const result = await response.json();
      console.log('✅ SUCCESS RESPONSE FROM POST /api/exercise-assignments/${assignmentId}/review', { assignmentId, score, feedback, questionGrades, result });
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-assignments/consultant"] });
      console.log('✅ SUCCESS IN ON onSuccessCALLBACK FOR REVIEW', { data });
      toast({
        title: "Revisione Inviata",
        description: data.message || "Revisione dell'esercizio inviata con successo",
      });
      setShowReviewDialog(false);
      setSelectedAssignment(null);
      setReviewForm({ score: '', feedback: '' });
    },
    onError: (error: any) => {
      console.error('❌ ERROR IN ON onErrorCALLBACK FOR REVIEW', { error });
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'invio della revisione",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ assignmentId, feedback }: { assignmentId: string, feedback: string }) => {
      console.log('❌ REJECT MUTATION FUNCTION START', { assignmentId, feedback });
      const response = await fetch(`/api/exercise-assignments/${assignmentId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ feedback }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ ERROR RESPONSE FROM POST /api/exercise-assignments/${assignmentId}/reject', { assignmentId, feedback, errorData });
        throw new Error(errorData.message || "Failed to reject exercise");
      }
      const result = await response.json();
      console.log('✅ SUCCESS RESPONSE FROM POST /api/exercise-assignments/${assignmentId}/reject', { assignmentId, feedback, result });
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-assignments/consultant"] });
      console.log('✅ SUCCESS IN ON onSuccessCALLBACK FOR REJECT', { data });
      toast({
        title: "Esercizio Respinto",
        description: data.message || "Esercizio respinto con successo",
      });
      setShowReviewDialog(false);
      setSelectedAssignment(null);
      setReviewForm({ score: '', feedback: '' });
    },
    onError: (error: any) => {
      console.error('❌ ERROR IN ON onErrorCALLBACK FOR REJECT', { error });
      toast({
        title: "Errore",
        description: error.message || "Errore durante il rifiuto dell'esercizio",
        variant: "destructive",
      });
    },
  });

  const handleCreateExercise = async (exerciseData: any, files: File[]) => {
    // Check if we're editing an existing exercise
    const isEditing = selectedExercise?.id;

    console.log(isEditing ? '🔄 UPDATE EXERCISE HANDLER START' : '🎯 CREATE EXERCISE HANDLER START', {
      timestamp: new Date().toISOString(),
      isEditing,
      exerciseId: selectedExercise?.id,
      exerciseData,
      hasLibraryDocumentId: !!exerciseData.libraryDocumentId,
      libraryDocumentId: exerciseData.libraryDocumentId
    });

    if (isEditing) {
      // UPDATE mode: Call updateExerciseMutation
      console.log('🚀 CALLING updateExerciseMutation.mutate with ID:', selectedExercise.id);
      updateExerciseMutation.mutate({
        exerciseId: selectedExercise.id,
        exerciseData,
        files
      });
    } else {
      // CREATE mode: Call createExerciseMutation
      console.log('🚀 CALLING createExerciseMutation.mutate');
      createExerciseMutation.mutate({ exerciseData, files });
    }
  };

  const handleEditExercise = (exercise: Exercise) => {
    // Check if this exercise has any assignments
    const exerciseAssignments = assignmentsData.filter(a => a.exerciseId === exercise.id);

    if (exerciseAssignments.length > 0) {
      // Show confirmation dialog with list of affected clients
      setEditConfirmDialog({ exercise, assignments: exerciseAssignments });
    } else {
      // No assignments, proceed directly to edit
      setSelectedExercise(exercise);
      setViewMode('edit');
      setShowExerciseForm(true);
    }
  };

  const handleConfirmEdit = () => {
    if (editConfirmDialog) {
      setSelectedExercise(editConfirmDialog.exercise);
      setViewMode('edit');
      setShowExerciseForm(true);
      setEditConfirmDialog(null);
    }
  };

  const handleViewExercise = (exercise: Exercise, assignment?: ExerciseAssignment) => {
    // Navigate to the exercise details page with assignment parameter if available
    const url = assignment
      ? `/exercise/${exercise.id}?assignment=${assignment.id}`
      : `/exercise/${exercise.id}`;
    setLocation(url);
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    setDeletingExercise(exerciseId as any); // Set to the ID, not the whole exercise object
    setDeleteConfirmation("");
    console.log('🔥 HANDLE DELETE EXERCISE CALLED', { exerciseId });
  };

  const handleConfirmDelete = () => {
    console.log('✅ HANDLE CONFIRM DELETE CALLED', { deleteConfirmation, deletingExercise });
    if (deleteConfirmation === "CONFERMA" && deletingExercise) {
      deleteExerciseMutation.mutate(deletingExercise);
    }
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedExercise(null);
    setSelectedTemplate(null);
    setShowExerciseForm(false);
  };

  const handleReviewAssignment = async (assignment: ExerciseAssignment) => {
    setSelectedAssignment(assignment);
    setReviewForm({
      score: assignment.score ? String(assignment.score) : '',
      feedback: typeof assignment.consultantFeedback === 'string' ? assignment.consultantFeedback : '',
    });
    setShowReviewDialog(true);
    console.log('⭐ HANDLE REVIEW ASSIGNMENT CALLED', { assignment });

    // Fetch review data from API
    setLoadingReviewData(true);
    try {
      const response = await fetch(`/api/exercise-assignments/${assignment.id}/review-data`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ REVIEW DATA FETCHED', { data });
        setReviewData(data);

        // Initialize questionGrades from the fetched data
        if (data.exercise?.isExam && data.exercise?.autoCorrect && data.exercise?.questions) {
          const initialGrades = data.exercise.questions.map((q: any) => {
            const existingGrade = data.assignment?.questionGrades?.find((g: any) => g.questionId === q.id);
            return existingGrade || {
              questionId: q.id,
              score: 0,
              maxScore: q.points || 0,
              isCorrect: false,
              feedback: ''
            };
          });
          setQuestionGrades(initialGrades);
        }
      }
    } catch (error) {
      console.error('❌ ERROR FETCHING REVIEW DATA', { error });
    } finally {
      setLoadingReviewData(false);
    }
  };

  const handleSubmitReview = () => {
    if (!selectedAssignment) return;

    // Check if this is an exam with autoCorrect
    const isExamWithAutoCorrect = reviewData?.exercise?.isExam && reviewData?.exercise?.autoCorrect;

    if (isExamWithAutoCorrect) {
      // Validate that all manual questions have scores
      const questions = reviewData?.exercise?.questions || [];
      const manualQuestions = questions.filter((q: any) => !q.correctAnswers || q.correctAnswers.length === 0);

      for (const q of manualQuestions) {
        const grade = questionGrades.find(g => g.questionId === q.id);
        if (!grade || grade.score === undefined || grade.score < 0 || grade.score > (q.points || 0)) {
          toast({
            title: "Errore",
            description: `Devi inserire un punteggio valido per tutte le domande manuali (0-${q.points || 0})`,
            variant: "destructive",
          });
          return;
        }
      }

      // Submit with questionGrades
      reviewMutation.mutate({
        assignmentId: selectedAssignment.id,
        feedback: reviewForm.feedback,
        questionGrades: questionGrades,
      });
    } else {
      // Regular exercise - validate score
      if (!reviewForm.score || parseFloat(reviewForm.score) < 0 || parseFloat(reviewForm.score) > 100) {
        toast({
          title: "Errore",
          description: "Il voto deve essere un numero tra 0 e 100",
          variant: "destructive",
        });
        return;
      }

      reviewMutation.mutate({
        assignmentId: selectedAssignment.id,
        score: parseFloat(reviewForm.score),
        feedback: reviewForm.feedback,
      });
    }
  };

  const handleRejectAssignment = () => {
    if (!selectedAssignment || !reviewForm.feedback || !reviewForm.feedback.trim()) {
      toast({
        title: "Errore",
        description: "Il feedback è obbligatorio per respingere un esercizio",
        variant: "destructive",
      });
      return;
    }

    rejectMutation.mutate({
      assignmentId: selectedAssignment.id,
      feedback: reviewForm.feedback,
    });
  };

  // Process clients with their exercises
  const clientsWithExercises: ClientWithExercises[] = clients.map((client: User) => {
    const clientAssignments = assignmentsData.filter((assignment: ExerciseAssignment) =>
      assignment.clientId === client.id
    );

    const completed = clientAssignments.filter((a: ExerciseAssignment) => a.status === 'completed').length;
    const inProgress = clientAssignments.filter((a: ExerciseAssignment) => a.status === 'in_progress').length;
    const pending = clientAssignments.filter((a: ExerciseAssignment) => a.status === 'pending').length;
    const returned = clientAssignments.filter((a: ExerciseAssignment) => a.status === 'returned').length;
    const submitted = clientAssignments.filter((a: ExerciseAssignment) => a.status === 'submitted').length;

    return {
      id: client.id,
      username: client.username,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      avatar: client.avatar,
      assignments: clientAssignments,
      totalAssigned: clientAssignments.length,
      completed,
      inProgress,
      pending,
      returned,
      submitted,
    };
  });

  // Filter clients based on search, status, and category
  const filteredClients = clientsWithExercises.filter((client) => {
    const matchesSearch = client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(searchTerm.toLowerCase());

    // Filter by category
    let matchesCategory = true;
    if (selectedCategory !== 'all') {
      const categoryAssignments = client.assignments.filter((assignment) => {
        const exercise = exercises.find((e: Exercise) => e.id === assignment.exerciseId);
        return exercise && exercise.category === selectedCategory;
      });
      matchesCategory = categoryAssignments.length > 0;
    }

    // Filter by status
    let matchesStatus = true;
    if (statusFilter === "active") matchesStatus = client.inProgress > 0;
    else if (statusFilter === "completed") matchesStatus = client.completed > 0;
    else if (statusFilter === "pending") matchesStatus = client.pending > 0;
    else if (statusFilter === "returned") matchesStatus = client.returned > 0;
    else if (statusFilter === "submitted") matchesStatus = client.submitted > 0;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white border-0 shadow-sm hover:shadow-md transition-all duration-200">
            <CheckCircle size={12} className="mr-1.5" />
            Completato
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 shadow-sm hover:shadow-md transition-all duration-200">
            <PlayCircle size={12} className="mr-1.5" />
            In Corso
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-sm hover:shadow-md transition-all duration-200">
            <Timer size={12} className="mr-1.5" />
            In Attesa
          </Badge>
        );
      case 'submitted':
        return (
          <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 shadow-sm hover:shadow-md transition-all duration-200">
            <AlertCircle size={12} className="mr-1.5" />
            Inviato
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-gradient-to-r from-red-600 to-red-700 text-white border-0 shadow-sm hover:shadow-md transition-all duration-200">
            <X size={12} className="mr-1.5" />
            Respinto
          </Badge>
        );
      case 'returned':
        return (
          <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white border-0 shadow-sm hover:shadow-md transition-all duration-200">
            <ArrowLeft size={12} className="mr-1.5" />
            Restituito
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="border-0 shadow-sm">{status}</Badge>;
    }
  };

  const getExerciseTypeInfo = (exercise: Exercise) => {
    if (exercise.workPlatform && exercise.workPlatform.trim() !== '') {
      return (
        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
          <ExternalLink size={12} />
          <span>Piattaforma di Lavoro</span>
        </div>
      );
    } else {
      const questionCount = exercise.questions ? exercise.questions.length : 0;
      return (
        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
          <MessageSquare size={12} />
          <span>{questionCount} domande</span>
        </div>
      );
    }
  };

  const token = localStorage.getItem('authToken'); // Assuming token is stored in localStorage

  const handleSendWhatsApp = async (assignment: ExerciseAssignment) => {
    console.log('📱 HANDLE SEND WHATSAPP CALLED', { assignment });
    const client = assignment.client;
    const exercise = assignment.exercise;

    if (!client || !exercise) {
      toast({ title: "Errore", description: "Dati del cliente o dell'esercizio mancanti.", variant: "destructive" });
      return;
    }

    // Check if client has phone number
    if (!client.phoneNumber) {
      // Show dialog to add phone number
      setEditingClient({
        client: client,
        phoneNumber: ''
      });
      return;
    }

    // Function to extract consultant feedback from different formats
    const extractConsultantFeedback = (consultantFeedback: any) => {
      if (!consultantFeedback) return null;

      try {
        // If it's a string, try to parse it as JSON first
        if (typeof consultantFeedback === 'string') {
          if (consultantFeedback.trim()) {
            // Try to parse as JSON array first
            try {
              const parsed = JSON.parse(consultantFeedback);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const latestFeedback = parsed[parsed.length - 1];
                if (latestFeedback && latestFeedback.feedback && latestFeedback.feedback.trim()) {
                  return latestFeedback.feedback.trim();
                }
              }
            } catch (jsonError) {
              // If JSON parsing fails, treat as plain string
              return consultantFeedback.trim();
            }
          }
        }

        // If it's already an array
        if (Array.isArray(consultantFeedback) && consultantFeedback.length > 0) {
          const latestFeedback = consultantFeedback[consultantFeedback.length - 1];
          if (latestFeedback && latestFeedback.feedback && latestFeedback.feedback.trim()) {
            return latestFeedback.feedback.trim();
          }
        }
      } catch (error) {
        console.error('Error extracting consultant feedback:', error);
      }

      return null;
    };

    // Function to extract client feedback (from submission)
    const extractClientFeedback = async () => {
      try {
        // Get all submissions for this assignment to retrieve client notes
        const response = await fetch(`/api/exercise-submissions/assignment/${assignment.id}/all`, {
          headers: getAuthHeaders(),
        });

        if (response.ok) {
          const submissions = await response.json();
          if (submissions && submissions.length > 0) {
            // Get all client notes from submissions, sorted by date
            const clientNotes = submissions
              .filter((sub: any) => sub.notes && sub.notes.trim())
              .sort((a: any, b: any) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
              .map((sub: any, index: number) => {
                const date = new Date(sub.submittedAt).toLocaleDateString('it-IT');
                return `Consegna #${index + 1} (${date}): ${sub.notes.trim()}`;
              });

            return clientNotes.length > 0 ? clientNotes.join('\n\n') : null;
          }
        }
      } catch (error) {
        console.error('Error fetching client submissions:', error);
      }

      // Fallback if no submissions found
      if (assignment.submittedAt) {
        return "Il cliente ha inviato la sua risposta all'esercizio";
      }
      return null;
    };

    const consultantFeedback = extractConsultantFeedback(assignment.consultantFeedback);
    const clientFeedback = await extractClientFeedback();

    // Generate automatic message based on assignment status and feedback
    let message = `[Messaggio automatico]\n\n`;
    message += `Ciao ${client.firstName},\n\n`;

    if (assignment.status === 'completed') {
      message += `🎉 Complimenti! Hai completato con successo l'esercizio "${exercise.title}".\n\n`;

      if (assignment.score) {
        message += `Il tuo punteggio: ${assignment.score}/100\n\n`;
      }

      if (clientFeedback) {
        message += `La tua risposta: ${clientFeedback}\n\n`;
      }

      if (consultantFeedback) {
        message += `Il mio feedback: ${consultantFeedback}\n\n`;
      } else {
        message += `Non ho ancora fornito feedback specifici aggiuntivi.\n\n`;
      }
      message += `Continua così! 💪`;

    } else if (assignment.status === 'rejected') {
      message += `L'esercizio "${exercise.title}" necessita di alcune revisioni.\n\n`;

      if (clientFeedback) {
        message += `La tua risposta precedente: ${clientFeedback}\n\n`;
      }

      if (consultantFeedback) {
        message += `Le mie osservazioni: ${consultantFeedback}\n\n`;
      } else {
        message += `Ti prego di contattarmi per maggiori dettagli sulle modifiche necessarie.\n\n`;
      }
      message += `Ti prego di rivedere l'esercizio e risolverlo nuovamente. Sono qui per aiutarti! 🤝`;

    } else if (assignment.status === 'returned') {
      message += `L'esercizio "${exercise.title}" è stato restituito per ulteriori miglioramenti.\n\n`;

      if (clientFeedback) {
        message += `La tua risposta: ${clientFeedback}\n\n`;
      }

      if (consultantFeedback) {
        message += `Le mie note: ${consultantFeedback}\n\n`;
      } else {
        message += `Ti prego di contattarmi per maggiori dettagli sui miglioramenti necessari.\n\n`;
      }
      message += `Una volta apportate le modifiche, potrai reinviare l'esercizio. 📝`;

    } else if (assignment.status === 'submitted') {
      message += `Ho ricevuto il tuo esercizio "${exercise.title}" e lo sto revisionando.\n\n`;

      if (clientFeedback) {
        message += `La tua risposta inviata: ${clientFeedback}\n\n`;
      }

      message += `Ti farò sapere presto i risultati! ⏳`;

    } else if (assignment.status === 'in_progress') {
      message += `Vedo che hai iniziato l'esercizio "${exercise.title}".\n\n`;

      if (clientFeedback) {
        message += `Progresso attuale: ${clientFeedback}\n\n`;
      }

      message += `Prenditi il tempo necessario per completarlo al meglio. Sono qui se hai bisogno di aiuto! 📚`;
    }

    // Clean phone number (remove spaces, dashes, parentheses, country code if it's not needed for WhatsApp)
    const cleanPhone = client.phoneNumber.replace(/[\s\-\(\)]/g, '');

    // Show confirmation dialog instead of directly opening WhatsApp
    setWhatsappConfirmDialog({ assignment, message });
    console.log('📱 WHATSAPP MESSAGE GENERATED', { message, to: cleanPhone });
  };

  const handleConfirmWhatsappSent = async (sent: boolean) => {
    console.log('💬 HANDLE CONFIRM WHATSAPP SENT CALLED', { sent });
    if (!whatsappConfirmDialog) return;

    const { assignment, message } = whatsappConfirmDialog;
    const client = assignment.client;

    if (!client?.phoneNumber) {
      console.error('❌ CLIENT PHONE NUMBER MISSING IN HANDLE CONFIRM WHATSAPP SENT');
      return;
    }

    const cleanPhone = client.phoneNumber.replace(/[\s\-\(\)]/g, '');
    const whatsappUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;

    // Open WhatsApp Web
    window.open(whatsappUrl, '_blank');
    console.log('🔗 OPENED WHATSAPP WEB WINDOW', { url: whatsappUrl });

    // Update the sent status
    if (sent) {
      updateWhatsappSentMutation.mutate({ assignmentId: assignment.id, sent: true });
      console.log('✅ MARKED WHATSAPP AS SENT FOR ASSIGNMENT', { assignmentId: assignment.id });
    }

    setWhatsappConfirmDialog(null);
  };

  const handleReactivateWhatsapp = (assignmentId: string) => {
    console.log('🔄 HANDLE REACTIVATE WHATSAPP CALLED', { assignmentId });
    updateWhatsappSentMutation.mutate({ assignmentId, sent: false });
  };

  const handleUpdateClientPhone = async (clientId: string, phoneNumber: string) => {
    console.log('📞 HANDLE UPDATE CLIENT PHONE CALLED', { clientId, phoneNumber });
    try {
      const response = await fetch(`/api/users/${clientId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ ERROR RESPONSE FROM PATCH /api/users/${clientId}', { clientId, phoneNumber, errorData });
        throw new Error(errorData.message || 'Errore durante l\'aggiornamento del numero');
      }

      const result = await response.json();
      console.log('✅ SUCCESS RESPONSE FROM PATCH /api/users/${clientId}', { clientId, phoneNumber, result });

      toast({
        title: "Successo",
        description: "Numero di telefono aggiornato con successo",
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/exercise-assignments/consultant"] });

      // Find the assignment for this client and try WhatsApp again
      const assignment = assignmentsData.find(a => a.clientId === clientId);
      if (assignment) {
        // Update client object with new phone number for the handleSendWhatsApp call
        const updatedAssignment = {
          ...assignment,
          client: { ...(assignment.client || {}), phoneNumber } // Ensure client exists before spreading
        };
        handleSendWhatsApp(updatedAssignment);
        console.log('📞 TRIGGERED HANDLE SEND WHATSAPP AGAIN WITH UPDATED NUMBER', { updatedAssignment });
      }

      setEditingClient(null);
    } catch (error: any) {
      console.error('❌ ERROR IN HANDLE UPDATE CLIENT PHONE', { error });
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento",
        variant: "destructive",
      });
    }
  };

  if (showExerciseForm) {
    return (
      <div className="min-h-screen bg-background">
        {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
        <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
          <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
            <ExerciseForm
              onSubmit={handleCreateExercise}
              onCancel={() => {
                setShowExerciseForm(false);
                setSelectedTemplate(null);
              }}
              isLoading={createExerciseMutation.isPending}
              existingExercise={viewMode === 'edit' ? selectedExercise : undefined}
              templateData={selectedTemplate}
            />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-8">
            {/* Header */}
            <div className="relative">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <BookOpen size={18} className="text-white" />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                      Gestione Esercizi
                    </h1>
                  </div>
                  <p className="text-muted-foreground md:text-lg">
                    Visualizza e gestisci gli esercizi dei tuoi clienti con facilità
                  </p>
                </div>
                <Button
                  onClick={() => setShowExerciseForm(true)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                  data-testid="button-create-exercise"
                >
                  <Sparkles size={16} className="mr-2" />
                  Nuovo Esercizio
                </Button>
              </div>
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-r from-blue-500/10 to-purple-600/10 rounded-full blur-2xl"></div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Clienti Totali</p>
                      <p className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-blue-100">{clients.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                      <Users className="text-white" size={24} />
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-16 h-16 bg-blue-500/10 rounded-full"></div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-green-700 dark:text-green-300">Esercizi Creati</p>
                      <p className="text-2xl md:text-3xl font-bold text-green-900 dark:text-green-100">{exercises.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                      <Target className="text-white" size={24} />
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-16 h-16 bg-green-500/10 rounded-full"></div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/50 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Assegnazioni Totali</p>
                      <p className="text-2xl md:text-3xl font-bold text-orange-900 dark:text-orange-100">{assignmentsData.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                      <Activity className="text-white" size={24} />
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-16 h-16 bg-orange-500/10 rounded-full"></div>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50 hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Completati</p>
                      <p className="text-2xl md:text-3xl font-bold text-purple-900 dark:text-purple-100">
                        {assignmentsData.filter((a: ExerciseAssignment) => a.status === 'completed').length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                      <Award className="text-white" size={24} />
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-16 h-16 bg-purple-500/10 rounded-full"></div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="assignments" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-muted/50">
                <TabsTrigger value="assignments" className="flex items-center space-x-2">
                  <Users size={16} />
                  <span>Esercizi Assegnati</span>
                </TabsTrigger>
                <TabsTrigger value="exams" className="flex items-center space-x-2">
                  <Award size={16} />
                  <span>Esami</span>
                </TabsTrigger>
                <TabsTrigger value="public" className="flex items-center space-x-2">
                  <Globe size={16} />
                  <span>Esercizi Pubblici</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="assignments" className="space-y-6 mt-6">
                {/* Layout 2: Sidebar + Main Content */}
                <div className="flex gap-6">
                  {/* Left Sidebar - Categories Navigation */}
                  <div className="w-80 flex-shrink-0">
                    <Card className="sticky top-6 shadow-lg border-muted/40">
                      <CardHeader className="pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                            <Filter size={20} className="text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Categorie & Corsi</CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">Filtra per categoria</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                          <Input
                            placeholder="Cerca clienti..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-10 text-sm"
                            data-testid="input-search-clients"
                          />
                        </div>

                        {/* Status Filter */}
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground mb-2 block">Stato</Label>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full h-10" data-testid="select-status-filter">
                              <SelectValue placeholder="Filtra per stato" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">📊 Tutti gli stati</SelectItem>
                              <SelectItem value="active">🔄 In corso</SelectItem>
                              <SelectItem value="completed">✅ Completati</SelectItem>
                              <SelectItem value="pending">⏳ In attesa</SelectItem>
                              <SelectItem value="returned">↩️ Restituiti</SelectItem>
                              <SelectItem value="submitted">📩 Inviati</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <Separator />

                        {/* Categories List */}
                        <div>
                          <Label className="text-xs font-semibold text-muted-foreground mb-3 block">Categorie</Label>
                          <div className="space-y-2">
                            {/* All Categories */}
                            <Button
                              variant={selectedCategory === 'all' ? 'default' : 'ghost'}
                              className={`w-full justify-start text-left h-auto py-3 px-3 ${selectedCategory === 'all'
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700'
                                : 'hover:bg-muted'
                                }`}
                              onClick={() => setSelectedCategory('all')}
                            >
                              <div className="flex items-center gap-3 w-full">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedCategory === 'all' ? 'bg-white/20' : 'bg-gradient-to-r from-blue-500 to-purple-600'
                                  }`}>
                                  <span className={selectedCategory === 'all' ? 'text-white' : 'text-white'}>📚</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">Tutte le Categorie</div>
                                  <div className={`text-xs ${selectedCategory === 'all' ? 'text-white/80' : 'text-muted-foreground'}`}>
                                    {(() => {
                                      // Count all assignments that pass the current filters
                                      const allFilteredAssignments = assignmentsData.filter((a: ExerciseAssignment) => {
                                        // Filter by search term
                                        const client = clients.find(c => c.id === a.clientId);
                                        if (!client) return false;

                                        const matchesSearch = searchTerm === "" ||
                                          client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                          client.email.toLowerCase().includes(searchTerm.toLowerCase());

                                        if (!matchesSearch) return false;

                                        // Filter by status
                                        if (statusFilter === "active" && a.status !== 'in_progress') return false;
                                        if (statusFilter === "completed" && a.status !== 'completed') return false;
                                        if (statusFilter === "pending" && a.status !== 'pending') return false;
                                        if (statusFilter === "returned" && a.status !== 'returned') return false;
                                        if (statusFilter === "submitted" && a.status !== 'submitted') return false;

                                        return true;
                                      });
                                      return allFilteredAssignments.length;
                                    })()} totali
                                  </div>
                                </div>
                              </div>
                            </Button>

                            {/* Individual Categories */}
                            {['post-consulenza', 'metodo-turbo', 'metodo-hybrid', 'newsletter', 'finanza-personale', 'vendita', 'marketing', 'imprenditoria', 'risparmio-investimenti', 'contabilità', 'gestione-risorse', 'strategia'].map((category) => {
                              // Count only assignments from filtered clients
                              const categoryAssignments = assignmentsData.filter((a: ExerciseAssignment) => {
                                const exercise = exercises.find((e: Exercise) => e.id === a.exerciseId);
                                const isInCategory = exercise && exercise.category === category;

                                // Apply same filters as main client list
                                if (!isInCategory) return false;

                                // Filter by search term
                                const client = clients.find(c => c.id === a.clientId);
                                if (!client) return false;

                                const matchesSearch = searchTerm === "" ||
                                  client.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  client.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  client.email.toLowerCase().includes(searchTerm.toLowerCase());

                                if (!matchesSearch) return false;

                                // Filter by status
                                if (statusFilter === "active" && a.status !== 'in_progress') return false;
                                if (statusFilter === "completed" && a.status !== 'completed') return false;
                                if (statusFilter === "pending" && a.status !== 'pending') return false;
                                if (statusFilter === "returned" && a.status !== 'returned') return false;
                                if (statusFilter === "submitted" && a.status !== 'submitted') return false;

                                return true;
                              });

                              if (categoryAssignments.length === 0) return null;

                              return (
                                <Button
                                  key={category}
                                  variant={selectedCategory === category ? 'default' : 'ghost'}
                                  className={`w-full justify-start text-left h-auto py-3 px-3 ${selectedCategory === category
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700'
                                    : 'hover:bg-muted'
                                    }`}
                                  onClick={() => setSelectedCategory(category)}
                                >
                                  <div className="flex items-center gap-3 w-full">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedCategory === category ? 'bg-white/20' : 'bg-muted'
                                      }`}>
                                      <span className="text-lg">{getCategoryIcon(category)}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm truncate">{getCategoryLabel(category)}</div>
                                      <div className={`text-xs ${selectedCategory === category ? 'text-white/80' : 'text-muted-foreground'}`}>
                                        {categoryAssignments.length} {categoryAssignments.length === 1 ? 'esercizio' : 'esercizi'}
                                      </div>
                                    </div>
                                  </div>
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Main Content Area - Client List */}
                  <div className="flex-1 min-w-0">

                    <>
                      {/* Exercise Details View */}
                      {viewMode === 'details' && selectedExercise && (
                        <div className="space-y-6 animate-in fade-in-50 duration-300">
                          {/* Back Navigation */}
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              onClick={handleBackToList}
                              className="text-muted-foreground hover:text-foreground"
                              data-testid="button-back-to-list"
                            >
                              <ArrowLeft size={16} className="mr-2" />
                              Torna alla Lista
                            </Button>
                          </div>

                          <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-card to-muted/10">
                            <CardHeader className="pb-6">
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                <div className="space-y-3">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                      <BookOpen size={20} className="text-white" />
                                    </div>
                                    <div>
                                      <CardTitle className="text-2xl md:text-3xl font-bold">{selectedExercise.title}</CardTitle>
                                      <p className="text-muted-foreground mt-1 text-lg">Dettagli Esercizio</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <Button
                                    onClick={() => handleEditExercise(selectedExercise)}
                                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                                    data-testid="button-edit-from-details"
                                  >
                                    <Edit size={16} className="mr-2" />
                                    Modifica Esercizio
                                  </Button>
                                  <Button
                                    onClick={() => handleDeleteExercise(selectedExercise.id)}
                                    variant="destructive"
                                    className="shadow-lg hover:shadow-xl transition-all duration-200"
                                    data-testid="button-delete-from-details"
                                  >
                                    <Trash2 size={16} className="mr-2" />
                                    Elimina Esercizio
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                              <div>
                                <h3 className="font-semibold mb-2">Descrizione</h3>
                                <p className="text-muted-foreground">{selectedExercise.description}</p>
                              </div>

                              {selectedExercise.workPlatform && selectedExercise.workPlatform.trim() !== '' ? (
                                <div>
                                  <h3 className="font-semibold mb-2">Piattaforma di Lavoro</h3>
                                  <div className="bg-muted p-4 rounded-lg">
                                    <div className="flex items-center space-x-2">
                                      <ExternalLink size={16} className="text-blue-500" />
                                      <a
                                        href={selectedExercise.workPlatform}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:underline"
                                      >
                                        {selectedExercise.workPlatform}
                                      </a>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-2">
                                      Gli studenti useranno questa piattaforma per completare l'esercizio.
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                selectedExercise.questions && selectedExercise.questions.length > 0 && (
                                  <div>
                                    <h3 className="font-semibold mb-2">Domande ({selectedExercise.questions.length})</h3>
                                    <div className="space-y-3">
                                      {selectedExercise.questions.map((question: any, index: number) => (
                                        <div key={index} className="bg-muted p-4 rounded-lg">
                                          <h4 className="font-medium mb-1">Domanda {index + 1}</h4>
                                          <p className="text-sm text-muted-foreground mb-2">{question.question}</p>
                                          <div className="flex items-center space-x-2">
                                            <Badge variant="secondary">{question.type}</Badge>
                                            {question.options && question.options.length > 0 && (
                                              <Badge variant="outline">{question.options.length} opzioni</Badge>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              )}

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h3 className="font-semibold mb-2">Statistiche</h3>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Assegnazioni totali:</span>
                                      <span>{assignmentsData.filter((a: ExerciseAssignment) => a.exerciseId === selectedExercise.id).length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Completati:</span>
                                      <span>{assignmentsData.filter((a: ExerciseAssignment) => a.exerciseId === selectedExercise.id && a.status === 'completed').length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">In corso:</span>
                                      <span>{assignmentsData.filter((a: ExerciseAssignment) => a.exerciseId === selectedExercise.id && a.status === 'in_progress').length}</span>
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <h3 className="font-semibold mb-2">Informazioni</h3>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Creato:</span>
                                      <span>{selectedExercise.createdAt ? new Date(selectedExercise.createdAt).toLocaleDateString('it-IT') : 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Tipo:</span>
                                      <span>{selectedExercise.workPlatform ? 'Piattaforma di Lavoro' : 'Domande'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {/* Clients List */}
                      {viewMode === 'list' && (
                        <div className="space-y-6">
                          {/* Exercises pending review */}
                          {assignmentsData.filter((a: ExerciseAssignment) => a.status === 'submitted').length > 0 && (
                            <Card className="col-span-full border-0 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 shadow-lg">
                              <CardHeader className="pb-4">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-md">
                                      <AlertCircle size={20} className="text-white" />
                                    </div>
                                    <div>
                                      <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                                        Esercizi da Revisionare
                                      </span>
                                      <p className="text-sm text-muted-foreground font-normal mt-1">
                                        {assignmentsData.filter((a: ExerciseAssignment) => a.status === 'submitted').length} {assignmentsData.filter((a: ExerciseAssignment) => a.status === 'submitted').length === 1 ? 'esercizio in attesa' : 'esercizi in attesa'}
                                      </p>
                                    </div>
                                  </CardTitle>
                                  <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 shadow-md text-base px-4 py-1.5">
                                    {assignmentsData.filter((a: ExerciseAssignment) => a.status === 'submitted').length}
                                  </Badge>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="grid gap-4">
                                  {assignmentsData
                                    .filter((a: ExerciseAssignment) => a.status === 'submitted')
                                    .map((assignment: ExerciseAssignment) => {
                                      const exercise = exercises.find((e: Exercise) => e.id === assignment.exerciseId);
                                      if (!exercise) return null;

                                      return (
                                        <div
                                          key={assignment.id}
                                          className="group relative bg-white dark:bg-gray-800 rounded-xl border-2 border-orange-200 dark:border-orange-800 p-4 hover:border-orange-400 dark:hover:border-orange-600 hover:shadow-xl transition-all duration-300"
                                        >
                                          <div className="flex items-start gap-4">
                                            <div className="flex-shrink-0">
                                              <Avatar className="w-12 h-12 border-2 border-orange-200">
                                                <AvatarImage src={assignment.client?.avatar} />
                                                <AvatarFallback className="bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold">
                                                  {assignment.client?.firstName?.charAt(0)}{assignment.client?.lastName?.charAt(0)}
                                                </AvatarFallback>
                                              </Avatar>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-start justify-between gap-3 mb-2">
                                                <div className="flex-1">
                                                  <h4 className="font-bold text-lg text-foreground group-hover:text-orange-600 transition-colors mb-1">
                                                    {exercise.title}
                                                  </h4>
                                                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                                    <User size={14} />
                                                    {assignment.client?.firstName} {assignment.client?.lastName}
                                                  </p>
                                                </div>
                                                {exercise.title.includes("(da template)") && (
                                                  <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200 flex-shrink-0">
                                                    <BookOpen size={12} className="mr-1" />
                                                    Template
                                                  </Badge>
                                                )}
                                              </div>

                                              <div className="flex items-center gap-4 mb-3">
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                                                  <Clock size={12} />
                                                  <span>Consegnato: {assignment.submittedAt ? new Date(assignment.submittedAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}</span>
                                                </div>
                                                {assignment.dueDate && (
                                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                                                    <Calendar size={12} />
                                                    <span>Scadenza: {new Date(assignment.dueDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                                  </div>
                                                )}
                                              </div>

                                              <Button
                                                onClick={() => handleViewExercise(exercise, assignment)}
                                                className="w-full sm:w-auto bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-md hover:shadow-lg transition-all duration-200"
                                                data-testid={`button-review-${assignment.id}`}
                                              >
                                                <Eye size={16} className="mr-2" />
                                                Revisiona Esercizio
                                              </Button>
                                            </div>
                                          </div>

                                          {/* Decorative gradient border */}
                                          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                            {filteredClients.length === 0 ? (
                              <Card className="border-0 shadow-lg col-span-full">
                                <CardContent className="p-12 text-center">
                                  <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Users className="text-muted-foreground" size={40} />
                                  </div>
                                  <h3 className="text-xl font-semibold mb-3">Nessun cliente trovato</h3>
                                  <p className="text-muted-foreground text-lg">
                                    {searchTerm || statusFilter !== "all"
                                      ? "Prova a modificare i filtri di ricerca."
                                      : "Non ci sono clienti con esercizi assegnati."}
                                  </p>
                                </CardContent>
                              </Card>
                            ) : (
                              filteredClients.map((client) => (
                                <Card
                                  key={client.id}
                                  className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-card to-muted/5"
                                  data-testid={`client-card-${client.id}`}
                                >
                                  <CardHeader className="pb-4">
                                    <div className="space-y-4">
                                      <div className="flex items-center space-x-3">
                                        <Avatar className="w-12 h-12 border-2 border-white shadow-md flex-shrink-0">
                                          <AvatarImage src={client.avatar} />
                                          <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold">
                                            {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                          <h3 className="text-lg font-semibold truncate">
                                            {client.firstName} {client.lastName}
                                          </h3>
                                          <p className="text-sm text-muted-foreground truncate">{client.email}</p>
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-3">
                                        <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 shadow-sm flex-shrink-0">
                                          <Target size={12} className="mr-1.5" />
                                          {client.totalAssigned} esercizi
                                        </Badge>
                                        <div className="flex items-center gap-3 flex-wrap">
                                          <div className="flex items-center space-x-1 text-sm text-green-600 dark:text-green-400">
                                            <CheckCircle size={14} />
                                            <span>{client.completed}</span>
                                          </div>
                                          <div className="flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400">
                                            <PlayCircle size={14} />
                                            <span>{client.inProgress}</span>
                                          </div>
                                          <div className="flex items-center space-x-1 text-sm text-amber-600 dark:text-amber-400">
                                            <Clock size={14} />
                                            <span>{client.pending}</span>
                                          </div>
                                          {client.returned > 0 && (
                                            <div className="flex items-center space-x-1 text-sm text-red-600 dark:text-red-400">
                                              <ArrowLeft size={14} />
                                              <span>{client.returned}</span>
                                            </div>
                                          )}
                                          {client.submitted > 0 && (
                                            <div className="flex items-center space-x-1 text-sm text-orange-600 dark:text-orange-400">
                                              <AlertCircle size={14} />
                                              <span>{client.submitted}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </CardHeader>

                                  <CardContent className="pt-2">
                                    {(() => {
                                      // Filter assignments by selected category
                                      const displayAssignments = selectedCategory === 'all'
                                        ? client.assignments
                                        : client.assignments.filter((assignment) => {
                                          const exercise = exercises.find((e: Exercise) => e.id === assignment.exerciseId);
                                          return exercise && exercise.category === selectedCategory;
                                        });

                                      if (displayAssignments.length === 0) {
                                        return (
                                          <div className="text-center py-8">
                                            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                              <BookOpen size={24} className="text-muted-foreground" />
                                            </div>
                                            <p className="text-muted-foreground text-lg">
                                              Nessun esercizio in questa categoria
                                            </p>
                                          </div>
                                        );
                                      }

                                      return (
                                        <div className="space-y-3">
                                          {Object.entries(groupAssignmentsByCategory(displayAssignments)).map(([category, categoryAssignments]) => (
                                            <Collapsible key={category} open={isCategoryExpanded(client.id, category)} onOpenChange={() => toggleCategory(client.id, category)}>
                                              <CollapsibleTrigger asChild>
                                                <Button variant="ghost" className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-all duration-200">
                                                  <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
                                                      <span className="text-lg">{getCategoryIcon(category)}</span>
                                                    </div>
                                                    <div className="text-left">
                                                      <h4 className="font-semibold text-sm">{getCategoryLabel(category)}</h4>
                                                      <p className="text-xs text-muted-foreground">
                                                        {categoryAssignments.length} esercizio{categoryAssignments.length !== 1 ? 'i' : ''}
                                                      </p>
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-2 flex-shrink-0">
                                                    {/* Status Icons Grid */}
                                                    <div className="grid grid-cols-4 gap-1 p-1 bg-muted/30 rounded-md">
                                                      {categoryAssignments.slice(0, 8).map((assignment, idx) => {
                                                        const StatusIcon = assignment.status === 'completed' ? CheckCircle :
                                                          assignment.status === 'submitted' ? AlertCircle :
                                                            assignment.status === 'returned' ? ArrowLeft :
                                                              assignment.status === 'in_progress' ? PlayCircle : Clock;
                                                        const statusColor = assignment.status === 'completed' ? 'text-green-500' :
                                                          assignment.status === 'submitted' ? 'text-orange-500' :
                                                            assignment.status === 'returned' ? 'text-red-500' :
                                                              assignment.status === 'in_progress' ? 'text-blue-500' : 'text-gray-400';
                                                        return (
                                                          <div key={assignment.id} className="flex items-center justify-center w-4 h-4">
                                                            <StatusIcon size={12} className={statusColor} />
                                                          </div>
                                                        );
                                                      })}
                                                      {categoryAssignments.length > 8 && (
                                                        <div className="flex items-center justify-center w-4 h-4 text-[10px] text-muted-foreground font-medium">
                                                          +{categoryAssignments.length - 8}
                                                        </div>
                                                      )}
                                                    </div>
                                                    {/* Chevron */}
                                                    <div className="flex-shrink-0 ml-1">
                                                      {isCategoryExpanded(client.id, category) ?
                                                        <ChevronDown size={16} className="text-muted-foreground" /> :
                                                        <ChevronRight size={16} className="text-muted-foreground" />
                                                      }
                                                    </div>
                                                  </div>
                                                </Button>
                                              </CollapsibleTrigger>
                                              <CollapsibleContent>
                                                <div className="space-y-2 mt-2 ml-2 pl-4 border-l-2 border-muted">
                                                  {[...categoryAssignments]
                                                    .sort((a: any, b: any) => {
                                                      // Converti le date in timestamp, gestendo valori null/undefined
                                                      const getTimestamp = (dateStr: any) => {
                                                        if (!dateStr) return 0;
                                                        const timestamp = new Date(dateStr).getTime();
                                                        return isNaN(timestamp) ? 0 : timestamp;
                                                      };

                                                      const timestampA = getTimestamp(a.assignedAt);
                                                      const timestampB = getTimestamp(b.assignedAt);

                                                      // Ordina dal più recente (timestamp più alto) al più vecchio
                                                      return timestampB - timestampA;
                                                    })
                                                    .map((assignment: any) => {
                                                      const exercise = exercises.find((e: Exercise) => e.id === assignment.exerciseId);
                                                      if (!exercise) {
                                                        return (
                                                          <div
                                                            key={assignment.id}
                                                            className="group relative border border-red-300 rounded-lg p-3 bg-red-50 dark:bg-red-950/20"
                                                            data-testid={`assignment-error-${assignment.id}`}
                                                          >
                                                            <div className="flex items-start gap-3">
                                                              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                                                                <AlertCircle size={12} className="text-white" />
                                                              </div>
                                                              <div className="flex-1 min-w-0">
                                                                <h4 className="font-semibold text-red-700 dark:text-red-300 text-xs">Esercizio non trovato</h4>
                                                                <p className="text-red-600 dark:text-red-400 text-xs truncate">ID: {assignment.exerciseId}</p>
                                                              </div>
                                                            </div>
                                                          </div>
                                                        );
                                                      }

                                                      return (
                                                        <div
                                                          key={assignment.id}
                                                          className="group relative border border-muted/40 rounded-lg p-3 hover:border-blue-300 hover:shadow-md transition-all duration-200 bg-gradient-to-r from-background to-muted/10"
                                                          data-testid={`assignment-card-${assignment.id}`}
                                                        >
                                                          <div className="space-y-3">
                                                            <div className="flex items-start justify-between gap-3">
                                                              <div className="flex-1 min-w-0 space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                  <h4 className="font-semibold text-sm group-hover:text-blue-600 transition-colors leading-tight flex-1">
                                                                    {exercise.title}
                                                                  </h4>
                                                                  {exercise.title.includes("(da template)") && (
                                                                    <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200 text-xs flex-shrink-0">
                                                                      <BookOpen size={8} className="mr-1" />
                                                                      Template
                                                                    </Badge>
                                                                  )}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground line-clamp-1">
                                                                  {exercise.description}
                                                                </p>
                                                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                                                  {getExerciseTypeInfo(exercise)}
                                                                  <span className="text-xs text-muted-foreground">
                                                                    Assegnato: {assignment.assignedAt ? new Date(assignment.assignedAt).toLocaleDateString('it-IT') : 'N/A'}
                                                                  </span>
                                                                </div>
                                                              </div>
                                                              <div className="flex-shrink-0">
                                                                {getStatusBadge(assignment.status)}
                                                              </div>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-2">
                                                              <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleViewExercise(exercise, assignment)}
                                                                className="border-blue-200 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all duration-200 text-xs"
                                                                data-testid={`button-view-exercise-${assignment.id}`}
                                                              >
                                                                <Eye size={12} className="mr-1" />
                                                                <span className="hidden sm:inline">Visualizza</span>
                                                                <span className="sm:hidden">View</span>
                                                              </Button>
                                                              {assignment.status !== 'pending' ? (
                                                                <div className="flex items-center gap-1">
                                                                  <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleSendWhatsApp(assignment)}
                                                                    disabled={assignment.whatsappSent}
                                                                    className={`transition-all duration-200 text-xs ${assignment.whatsappSent
                                                                      ? 'border-gray-200 bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                                                                      : 'border-green-200 hover:border-green-300 hover:bg-green-50 dark:hover:bg-green-950/50 text-green-600 hover:text-green-700'
                                                                      }`}
                                                                    data-testid={`button-whatsapp-${assignment.id}`}
                                                                  >
                                                                    <MessageCircle size={12} className="mr-1" />
                                                                    <span className="hidden sm:inline">
                                                                      {assignment.whatsappSent ? 'Inviato' : 'WhatsApp'}
                                                                    </span>
                                                                    <span className="sm:hidden">
                                                                      {assignment.whatsappSent ? '✓' : 'WA'}
                                                                    </span>
                                                                  </Button>
                                                                  {assignment.whatsappSent && (
                                                                    <Button
                                                                      variant="ghost"
                                                                      size="sm"
                                                                      onClick={() => handleReactivateWhatsapp(assignment.id)}
                                                                      className="w-6 h-6 p-0 text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                                                      title="Riattiva WhatsApp"
                                                                      data-testid={`button-reactivate-whatsapp-${assignment.id}`}
                                                                    >
                                                                      ↻
                                                                    </Button>
                                                                  )}
                                                                </div>
                                                              ) : (
                                                                <div className="flex items-center justify-center text-xs text-muted-foreground bg-muted rounded-md px-2 py-1">
                                                                  In attesa
                                                                </div>
                                                              )}
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                              <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleEditExercise(exercise)}
                                                                className="border-purple-200 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-all duration-200 text-xs"
                                                                data-testid={`button-edit-exercise-${assignment.id}`}
                                                              >
                                                                <Edit size={12} className="mr-1" />
                                                                <span className="hidden sm:inline">Modifica</span>
                                                                <span className="sm:hidden">Edit</span>
                                                              </Button>
                                                              <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="border-red-200 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 text-red-600 hover:text-red-700 transition-all duration-200 text-xs"
                                                                onClick={() => handleDeleteExercise(exercise.id)}
                                                                data-testid={`button-delete-exercise-${exercise.id}`}
                                                              >
                                                                <Trash2 size={12} className="mr-1" />
                                                                <span className="hidden sm:inline">Elimina</span>
                                                                <span className="sm:hidden">Del</span>
                                                              </Button>
                                                            </div>
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                </div>
                                              </CollapsibleContent>
                                            </Collapsible>
                                          ))}
                                        </div>
                                      );
                                    })()}
                                  </CardContent>
                                </Card>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="exams" className="space-y-6 mt-6">
                {/* Exams Section - Similar to assignments but filtered for isExam: true */}
                <div className="space-y-6">
                  {/* Header */}
                  <Card className="border-2 border-yellow-200 dark:border-yellow-800 bg-gradient-to-br from-yellow-50/50 to-amber-50/30 dark:from-yellow-950/20 dark:to-amber-950/20">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                          <Award size={24} className="text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-yellow-900 dark:text-yellow-100 mb-1">📝 Esami dei Clienti</h3>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            Visualizza e gestisci tutti gli esami assegnati ai tuoi clienti
                          </p>
                        </div>
                        <Badge className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white border-0 text-lg px-4 py-2">
                          {assignmentsData.filter((a: ExerciseAssignment) => {
                            const exercise = exercises.find((e: Exercise) => e.id === a.exerciseId);
                            return exercise && (exercise as any).isExam === true;
                          }).length} esami
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Clients with exams */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
                    {(() => {
                      // Filter clients who have exam assignments
                      const clientsWithExams = clientsWithExercises.map((client) => {
                        const examAssignments = client.assignments.filter((assignment) => {
                          const exercise = exercises.find((e: Exercise) => e.id === assignment.exerciseId);
                          return exercise && (exercise as any).isExam === true;
                        });
                        return { ...client, examAssignments };
                      }).filter((client) => client.examAssignments.length > 0);

                      if (clientsWithExams.length === 0) {
                        return (
                          <Card className="border-0 shadow-lg col-span-full">
                            <CardContent className="p-12 text-center">
                              <div className="w-20 h-20 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Award className="text-white" size={40} />
                              </div>
                              <h3 className="text-xl font-semibold mb-3">Nessun esame trovato</h3>
                              <p className="text-muted-foreground text-lg">
                                Non ci sono esami assegnati ai clienti.
                              </p>
                            </CardContent>
                          </Card>
                        );
                      }

                      return clientsWithExams.map((client) => (
                        <Card
                          key={client.id}
                          className="border-2 border-yellow-200 dark:border-yellow-800 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-card to-yellow-50/5 dark:to-yellow-950/5"
                        >
                          <CardHeader className="pb-4">
                            <div className="space-y-4">
                              <div className="flex items-center space-x-3">
                                <Avatar className="w-12 h-12 border-2 border-yellow-300 shadow-md flex-shrink-0">
                                  <AvatarImage src={client.avatar} />
                                  <AvatarFallback className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-semibold">
                                    {client.firstName.charAt(0)}{client.lastName.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-lg font-semibold truncate">
                                    {client.firstName} {client.lastName}
                                  </h3>
                                  <p className="text-sm text-muted-foreground truncate">{client.email}</p>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-3">
                                <Badge className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white border-0 shadow-sm flex-shrink-0">
                                  <Award size={12} className="mr-1.5" />
                                  {client.examAssignments.length} {client.examAssignments.length === 1 ? 'esame' : 'esami'}
                                </Badge>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <div className="flex items-center space-x-1 text-sm text-green-600 dark:text-green-400">
                                    <CheckCircle size={14} />
                                    <span>{client.examAssignments.filter((a: ExerciseAssignment) => a.status === 'completed').length}</span>
                                  </div>
                                  <div className="flex items-center space-x-1 text-sm text-orange-600 dark:text-orange-400">
                                    <AlertCircle size={14} />
                                    <span>{client.examAssignments.filter((a: ExerciseAssignment) => a.status === 'submitted').length}</span>
                                  </div>
                                  <div className="flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400">
                                    <Clock size={14} />
                                    <span>{client.examAssignments.filter((a: ExerciseAssignment) => a.status === 'pending' || a.status === 'in_progress').length}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {client.examAssignments.map((assignment: ExerciseAssignment) => {
                              const exercise = exercises.find((e: Exercise) => e.id === assignment.exerciseId);
                              if (!exercise) return null;

                              return (
                                <div
                                  key={assignment.id}
                                  className="group relative bg-gradient-to-r from-yellow-50/50 to-amber-50/30 dark:from-yellow-950/20 dark:to-amber-950/20 p-4 rounded-lg border-2 border-yellow-200 dark:border-yellow-800 hover:border-yellow-400 dark:hover:border-yellow-600 hover:shadow-md transition-all duration-200"
                                >
                                  <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-bold text-base group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors truncate">
                                        {exercise.title}
                                      </h4>
                                      <div className="flex flex-wrap items-center gap-2 mt-2">
                                        {getStatusBadge(assignment.status)}
                                        {(exercise as any).trimesterId && (
                                          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                                            📅 Trimestrale
                                          </Badge>
                                        )}
                                        {(exercise as any).yearId && !(exercise as any).trimesterId && (
                                          <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700">
                                            📚 Annuale
                                          </Badge>
                                        )}
                                        {(exercise as any).autoCorrect && (
                                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                                            🤖 Auto-grading
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Show auto-graded score if available */}
                                  {assignment.autoGradedScore !== undefined && assignment.autoGradedScore !== null && (
                                    <div className="mb-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-green-700 dark:text-green-300">Punteggio Auto-grading:</span>
                                        <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                          {assignment.autoGradedScore}/{(exercise as any).totalPoints || 100}
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Show final score if completed */}
                                  {assignment.status === 'completed' && assignment.score && (
                                    <div className="mb-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Voto Finale:</span>
                                        <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                                          {assignment.score}/100
                                        </span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Dates */}
                                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                                    {assignment.assignedAt && (
                                      <div className="flex items-center gap-1">
                                        <Calendar size={12} />
                                        Assegnato: {new Date(assignment.assignedAt).toLocaleDateString('it-IT')}
                                      </div>
                                    )}
                                    {assignment.submittedAt && (
                                      <div className="flex items-center gap-1">
                                        <Clock size={12} />
                                        Consegnato: {new Date(assignment.submittedAt).toLocaleDateString('it-IT')}
                                      </div>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-3 gap-2">
                                    <Button
                                      onClick={() => handleViewExercise(exercise, assignment)}
                                      className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                                      size="sm"
                                    >
                                      <Eye size={14} className="mr-2" />
                                      {assignment.status === 'submitted' ? 'Revisiona' : 'Visualizza'}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleEditExercise(exercise)}
                                      className="border-purple-200 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-all duration-200 text-xs"
                                      data-testid={`button-edit-exam-${assignment.id}`}
                                    >
                                      <Edit size={12} className="mr-1" />
                                      <span className="hidden sm:inline">Modifica</span>
                                      <span className="sm:hidden">Edit</span>
                                    </Button>
                                    <Button
                                      onClick={() => handleDeleteExercise(exercise.id)}
                                      variant="outline"
                                      size="sm"
                                      className="border-red-200 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/50 text-red-600 hover:text-red-700 transition-all duration-200"
                                    >
                                      <Trash2 size={14} className="mr-2" />
                                      Elimina
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      ));
                    })()}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="public" className="space-y-6 mt-6">
                {/* Public Exercises Section */}
                <div className="space-y-6">
                  {/* Header */}
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Globe size={32} className="text-white opacity-60" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Esercizi Pubblici</h3>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                      Gli esercizi pubblici sono disponibili per tutti i tuoi clienti. Qui puoi vedere i tuoi esercizi pubblici e le submission ricevute.
                    </p>
                    <div className="mt-6">
                      <Card className="inline-block p-4 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 border border-blue-100 dark:border-blue-800">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <PlusCircle size={14} className="text-white" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Crea un esercizio pubblico</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              Quando crei un nuovo esercizio, seleziona l'opzione "Esercizio Pubblico"
                            </p>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>

                  {/* Public Exercises with Submissions */}
                  <div className="space-y-4">
                    {exercises.filter(exercise => exercise.isPublic).length === 0 ? (
                      <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-muted/10">
                        <CardContent className="p-8">
                          <div className="text-center">
                            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600/10 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Globe size={32} className="text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">Nessun Esercizio Pubblico</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
                              Non hai ancora creato esercizi pubblici. Crea il tuo primo esercizio pubblico per renderlo disponibile a tutti i clienti.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-6">
                        {exercises.filter(exercise => exercise.isPublic).map((exercise) => {
                          const publicAssignments = assignmentsData.filter(assignment => assignment.exerciseId === exercise.id);

                          return (
                            <Card key={exercise.id} className="border-0 shadow-lg bg-gradient-to-br from-card to-muted/10">
                              <CardHeader>
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start space-x-3 flex-1">
                                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg">
                                      <Globe size={20} className="text-white" />
                                    </div>
                                    <div className="flex-1">
                                      <CardTitle className="text-lg font-heading font-semibold mb-1">
                                        {exercise.title}
                                      </CardTitle>
                                      <p className="text-sm text-muted-foreground line-clamp-2">
                                        {exercise.description}
                                      </p>
                                      <div className="flex items-center space-x-4 mt-2">
                                        <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                                          <Globe size={12} className="mr-1" />
                                          Pubblico
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {publicAssignments.length} utenti hanno iniziato
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleViewExercise(exercise)}
                                      className="border-purple-200 hover:border-purple-300 hover:bg-purple-50"
                                      data-testid={`button-view-public-${exercise.id}`}
                                    >
                                      <Eye size={16} />
                                      Visualizza
                                    </Button>
                                    <Button
                                      onClick={() => handleEditExercise(exercise)}
                                      variant="outline"
                                      size="sm"
                                      className="border-blue-200 hover:border-blue-300 hover:bg-blue-50"
                                      data-testid={`button-edit-public-${exercise.id}`}
                                    >
                                      <Edit2 size={16} />
                                      Modifica
                                    </Button>
                                    <Button
                                      onClick={() => handleDeleteExercise(exercise.id)}
                                      variant="outline"
                                      size="sm"
                                      className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      data-testid={`button-delete-public-${exercise.id}`}
                                    >
                                      <Trash2 size={16} />
                                      Elimina
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>

                              {publicAssignments.length > 0 && (
                                <CardContent>
                                  <div className="space-y-3">
                                    <h4 className="font-medium text-sm text-muted-foreground">Submissions ricevute:</h4>
                                    <div className="grid gap-3">
                                      {publicAssignments.map((assignment) => (
                                        <div
                                          key={assignment.id}
                                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                                        >
                                          <div className="flex items-center space-x-3">
                                            <Avatar className="w-8 h-8">
                                              <AvatarImage src={assignment.client?.avatar} />
                                              <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs">
                                                {assignment.client?.firstName?.charAt(0)}{assignment.client?.lastName?.charAt(0)}
                                              </AvatarFallback>
                                            </Avatar>
                                            <div>
                                              <p className="font-medium text-sm">
                                                {assignment.client?.firstName} {assignment.client?.lastName}
                                              </p>
                                              <p className="text-xs text-muted-foreground">
                                                Iniziato: {new Date(assignment.assignedAt).toLocaleDateString('it-IT')}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="flex items-center space-x-3">
                                            {getStatusBadge(assignment.status)}
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleViewExercise(exercise, assignment)}
                                              className="text-xs"
                                            >
                                              <Eye size={12} className="mr-1" />
                                              Vedi
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </CardContent>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingExercise} onOpenChange={() => setDeletingExercise(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertCircle className="text-red-500" size={20} />
              <span>Conferma Eliminazione</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Stai per eliminare l'esercizio con ID: <strong>"{deletingExercise}"</strong>.
              </p>
              {exercises.find(e => e.id === deletingExercise)?.title?.includes("(da template)") && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-md">
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-1">
                    📋 Esercizio derivato da Template
                  </p>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    Questo esercizio è stato creato da un template. L'eliminazione non influenzerà il template originale.
                  </p>
                </div>
              )}
              <p className="text-red-600 font-medium">
                ⚠️ Questa azione eliminerà permanentemente:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                <li>L'esercizio stesso</li>
                <li>Tutte le assegnazioni ai clienti</li>
                <li>Tutte le submissions dei clienti</li>
                <li>Tutti i dati di performance associati</li>
              </ul>
              <p className="font-medium">
                Per confermare, digita <span className="font-mono bg-muted px-2 py-1 rounded">CONFERMA</span> nel campo sottostante:
              </p>
              <Input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Digita CONFERMA per procedere"
                className="font-mono"
                data-testid="input-delete-confirmation"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeletingExercise(null);
              setDeleteConfirmation("");
            }}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteConfirmation !== "CONFERMA" || deleteExerciseMutation.isPending}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              data-testid="button-confirm-delete"
            >
              {deleteExerciseMutation.isPending ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Eliminazione...
                </>
              ) : (
                <>
                  <Trash2 size={16} className="mr-2" />
                  Elimina Definitivamente
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisiona Esercizio</DialogTitle>
            <DialogDescription>
              {selectedAssignment && (
                <span>Stai revisionando l'esercizio di <strong>{selectedAssignment.client?.firstName} {selectedAssignment.client?.lastName}</strong></span>
              )}
            </DialogDescription>
          </DialogHeader>

          {loadingReviewData ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Caricamento dati revisione...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Check if this is an exam with autoCorrect */}
              {reviewData?.exercise?.isExam && reviewData?.exercise?.autoCorrect ? (
                <>
                  {/* Exam Review Mode */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                      📝 Revisione Esame con Auto-Correzione
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Questo esame ha domande auto-corrette e domande manuali. Il punteggio finale verrà calcolato automaticamente.
                    </p>
                  </div>

                  {/* Auto-graded Score */}
                  {reviewData?.assignment?.autoGradedScore !== undefined && (
                    <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        ✅ Punteggio Auto-Graded: <strong>{reviewData.assignment.autoGradedScore}</strong> punti
                      </p>
                    </div>
                  )}

                  {/* Questions List */}
                  <div className="space-y-4">
                    <h4 className="font-semibold">Domande e Punteggi:</h4>
                    {reviewData?.exercise?.questions?.map((question: any, index: number) => {
                      const studentAnswer = reviewData?.submission?.answers?.find((a: any) => a.questionId === question.id);
                      const isAutoGraded = question.correctAnswers && question.correctAnswers.length > 0;
                      const currentGrade = questionGrades.find(g => g.questionId === question.id);

                      return (
                        <Card key={question.id} className={isAutoGraded ? "border-green-200" : "border-orange-200"}>
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              {/* Question Header */}
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-medium">
                                    {index + 1}. {question.question}
                                    <Badge className="ml-2" variant={isAutoGraded ? "default" : "secondary"}>
                                      {isAutoGraded ? "Auto-Graded" : "Manuale"}
                                    </Badge>
                                  </p>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Punti disponibili: {question.points || 0}
                                  </p>
                                </div>
                              </div>

                              {/* Student Answer */}
                              <div className="p-3 bg-muted rounded-md">
                                <Label className="text-sm font-medium">Risposta dello studente:</Label>
                                <p className="mt-1 text-sm">
                                  {Array.isArray(studentAnswer?.answer)
                                    ? studentAnswer.answer.join(", ")
                                    : studentAnswer?.answer || "Nessuna risposta"}
                                </p>
                              </div>

                              {/* Auto-graded Question: Show score and correct answer */}
                              {isAutoGraded ? (
                                <>
                                  <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-md">
                                    <Label className="text-sm font-medium text-green-800 dark:text-green-200">
                                      Risposta corretta:
                                    </Label>
                                    <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                                      {question.correctAnswers.join(", ")}
                                    </p>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Label className="font-medium">Punteggio:</Label>
                                    <Input
                                      type="number"
                                      value={currentGrade?.score || 0}
                                      disabled
                                      className="w-20 bg-muted"
                                    />
                                    <span className="text-sm text-muted-foreground">/ {question.points || 0}</span>
                                    {currentGrade?.isCorrect && (
                                      <Badge variant="default" className="ml-2">✓ Corretta</Badge>
                                    )}
                                  </div>
                                </>
                              ) : (
                                /* Manual Question: Input for score and feedback */
                                <>
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                      <Label htmlFor={`score-${question.id}`} className="font-medium">
                                        Punteggio manuale:
                                      </Label>
                                      <Input
                                        id={`score-${question.id}`}
                                        type="number"
                                        min="0"
                                        max={question.points || 0}
                                        placeholder="0"
                                        value={currentGrade?.score || ''}
                                        onChange={(e) => {
                                          const newScore = parseFloat(e.target.value) || 0;
                                          setQuestionGrades(prev => {
                                            const existing = prev.find(g => g.questionId === question.id);
                                            if (existing) {
                                              return prev.map(g =>
                                                g.questionId === question.id
                                                  ? { ...g, score: newScore }
                                                  : g
                                              );
                                            } else {
                                              return [...prev, {
                                                questionId: question.id,
                                                score: newScore,
                                                maxScore: question.points || 0,
                                                feedback: ''
                                              }];
                                            }
                                          });
                                        }}
                                        className="w-24"
                                      />
                                      <span className="text-sm text-muted-foreground">/ {question.points || 0}</span>
                                    </div>
                                    <div>
                                      <Label htmlFor={`feedback-${question.id}`} className="text-sm">
                                        Feedback opzionale:
                                      </Label>
                                      <Textarea
                                        id={`feedback-${question.id}`}
                                        placeholder="Aggiungi un feedback specifico per questa domanda..."
                                        value={currentGrade?.feedback || ''}
                                        onChange={(e) => {
                                          const newFeedback = e.target.value;
                                          setQuestionGrades(prev => {
                                            const existing = prev.find(g => g.questionId === question.id);
                                            if (existing) {
                                              return prev.map(g =>
                                                g.questionId === question.id
                                                  ? { ...g, feedback: newFeedback }
                                                  : g
                                              );
                                            } else {
                                              return [...prev, {
                                                questionId: question.id,
                                                score: 0,
                                                maxScore: question.points || 0,
                                                feedback: newFeedback
                                              }];
                                            }
                                          });
                                        }}
                                        rows={2}
                                        className="text-sm"
                                      />
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Final Score Display */}
                  <div className="p-4 bg-primary/10 border border-primary rounded-md">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-lg">Punteggio Finale Calcolato:</span>
                      <span className="text-2xl font-bold text-primary">
                        {calculateTotalScore()}/100
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Il punteggio viene calcolato automaticamente in base alle risposte corrette e ai punteggi manuali assegnati
                    </p>
                  </div>

                  {/* General Feedback */}
                  <div>
                    <Label htmlFor="general-feedback">
                      Feedback Generale (opzionale)
                    </Label>
                    <Textarea
                      id="general-feedback"
                      placeholder="Aggiungi un feedback generale per l'intero esame..."
                      value={reviewForm.feedback}
                      onChange={(e) => setReviewForm({ ...reviewForm, feedback: e.target.value })}
                      rows={3}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Regular Exercise Review Mode */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="score">Voto (0-100)</Label>
                      <Input
                        id="score"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Inserisci un voto da 0 a 100"
                        value={reviewForm.score}
                        onChange={(e) => setReviewForm({ ...reviewForm, score: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="feedback">
                        Feedback per il cliente
                        <span className="text-muted-foreground"> (opzionale per approvazione, obbligatorio per rifiuto)</span>
                      </Label>
                      <Textarea
                        id="feedback"
                        placeholder="Scrivi un feedback per aiutare il cliente a migliorare..."
                        value={reviewForm.feedback}
                        onChange={(e) => setReviewForm({ ...reviewForm, feedback: e.target.value })}
                        rows={4}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setShowReviewDialog(false);
                setSelectedAssignment(null);
                setReviewForm({ score: '', feedback: '' });
                setReviewData(null);
                setQuestionGrades([]);
              }}
            >
              Annulla
            </Button>
            <div className="flex space-x-2">
              <Button
                variant="destructive"
                onClick={handleRejectAssignment}
                disabled={rejectMutation.isPending || reviewMutation.isPending || loadingReviewData}
                data-testid="button-reject-assignment"
              >
                {rejectMutation.isPending ? (
                  "Respingendo..."
                ) : (
                  <>
                    <X size={16} className="mr-2" />
                    Respingi
                  </>
                )}
              </Button>
              <Button
                onClick={handleSubmitReview}
                disabled={reviewMutation.isPending || rejectMutation.isPending || loadingReviewData}
              >
                {reviewMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Completa Revisione"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone Number Edit Dialog */}
      <Dialog open={!!editingClient} onOpenChange={() => setEditingClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi Numero di Telefono</DialogTitle>
            <DialogDescription>
              Il cliente {editingClient?.client.firstName} {editingClient?.client.lastName} non ha un numero di telefono.
              Aggiungilo per poter inviare messaggi WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                <Phone className="h-4 w-4 mr-2 inline" />
                Telefono
              </Label>
              <Input
                id="phone"
                placeholder="+39 123 456 7890"
                value={editingClient?.phoneNumber || ''}
                onChange={(e) => setEditingClient(prev => prev ? { ...prev, phoneNumber: e.target.value } : null)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingClient(null)}>
              Annulla
            </Button>
            <Button
              onClick={() => {
                if (editingClient && editingClient.phoneNumber.trim()) {
                  handleUpdateClientPhone(editingClient.client.id, editingClient.phoneNumber.trim());
                }
              }}
              disabled={!editingClient?.phoneNumber?.trim()}
            >
              Salva e Invia WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Confirmation Dialog */}
      <Dialog open={!!whatsappConfirmDialog} onOpenChange={() => setWhatsappConfirmDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="text-green-500" size={20} />
              Conferma Invio WhatsApp
            </DialogTitle>
            <DialogDescription>
              Hai inviato il messaggio WhatsApp al cliente?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Anteprima messaggio:</p>
              <div className="text-xs bg-white dark:bg-gray-800 p-2 rounded border max-h-32 overflow-y-auto">
                {whatsappConfirmDialog?.message.slice(0, 200)}
                {whatsappConfirmDialog?.message && whatsappConfirmDialog.message.length > 200 && '...'}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleConfirmWhatsappSent(false)}
              className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
              No, non inviato
            </Button>
            <Button
              onClick={() => handleConfirmWhatsappSent(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <MessageCircle size={16} className="mr-2" />
              Sì, inviato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Exercise Confirmation Dialog */}
      <Dialog open={!!editConfirmDialog} onOpenChange={() => setEditConfirmDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="text-amber-500" size={24} />
              Attenzione: Esercizio Già Assegnato
            </DialogTitle>
            <DialogDescription>
              Questo esercizio è stato assegnato a {editConfirmDialog?.assignments.length} {editConfirmDialog?.assignments.length === 1 ? 'cliente' : 'clienti'}.
              Le modifiche che apporti saranno applicate per tutti.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
              <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
                <Users size={16} />
                Clienti con questo esercizio assegnato:
              </h4>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {editConfirmDialog?.assignments.map((assignment, index) => (
                  <div key={assignment.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded border border-amber-100 dark:border-amber-900">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {assignment.client?.firstName} {assignment.client?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {assignment.client?.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={
                        assignment.status === 'completed' ? 'default' :
                          assignment.status === 'submitted' ? 'secondary' :
                            assignment.status === 'in_progress' ? 'outline' :
                              'outline'
                      } className="text-xs">
                        {assignment.status === 'completed' && 'Completato'}
                        {assignment.status === 'submitted' && 'Consegnato'}
                        {assignment.status === 'in_progress' && 'In Corso'}
                        {assignment.status === 'pending' && 'In Attesa'}
                        {assignment.status === 'returned' && 'Restituito'}
                        {assignment.status === 'rejected' && 'Respinto'}
                      </Badge>
                      {assignment.dueDate && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar size={12} />
                          Scadenza: {new Date(assignment.dueDate).toLocaleDateString('it-IT')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                ℹ️ <strong>Nota:</strong> Modificando questo esercizio, le modifiche saranno visibili immediatamente per tutti i clienti sopra elencati.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditConfirmDialog(null)}
            >
              Annulla
            </Button>
            <Button
              onClick={handleConfirmEdit}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
            >
              <Edit size={16} className="mr-2" />
              Procedi Comunque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConsultantAIAssistant />
    </div>
  );
}