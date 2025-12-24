import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  BookOpen,
  Plus,
  Search,
  Edit3,
  Trash2,
  Settings,
  FileText,
  Folder,
  Tag,
  Clock,
  Eye,
  Users,
  Sparkles,
  Video,
  ChevronRight,
  ChevronDown,
  Menu,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { type LibraryCategory, type LibraryDocument, type LibrarySubcategory } from "@shared/schema";
import { COURSE_THEMES } from "@shared/course-themes";
import { useIsMobile } from "@/hooks/use-mobile";

export default function ConsultantLibrary() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showSubcategoryDialog, setShowSubcategoryDialog] = useState(false);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<LibraryCategory | undefined>();
  const [editingSubcategory, setEditingSubcategory] = useState<LibrarySubcategory | undefined>();
  const [editingDocument, setEditingDocument] = useState<LibraryDocument | undefined>();
  const [deletingSubcategory, setDeletingSubcategory] = useState<string | undefined>();
  const [deletingDocument, setDeletingDocument] = useState<string | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [assigningCategory, setAssigningCategory] = useState<LibraryCategory | undefined>();
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [navSidebarOpen, setNavSidebarOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Category form state
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    icon: "BookOpen",
    color: "blue",
    theme: "classic",
    sortOrder: 0,
  });

  // Subcategory form state
  const [subcategoryForm, setSubcategoryForm] = useState({
    categoryId: "",
    name: "",
    description: "",
    icon: "Folder",
    color: "gray",
    sortOrder: 0,
  });

  // Document form state
  const [documentForm, setDocumentForm] = useState({
    categoryId: "",
    subcategoryId: "",
    title: "",
    subtitle: "",
    description: "",
    content: "",
    contentType: "text" as "text" | "video" | "both",
    videoUrl: "",
    level: "base" as "base" | "intermedio" | "avanzato",
    estimatedDuration: "",
    tags: [] as string[],
    sortOrder: 0,
    isPublished: true,
    attachments: [] as File[],
  });

  const [newTag, setNewTag] = useState("");

  // Aggiungi stili personalizzati per l'editor
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      [contenteditable="true"]:empty:before {
        content: attr(data-placeholder);
        color: #9ca3af;
        pointer-events: none;
        display: block;
      }

      [contenteditable="true"] {
        line-height: 1.6;
      }

      [contenteditable="true"] p {
        margin: 0.5rem 0;
      }

      [contenteditable="true"] br {
        line-height: 1.6;
      }

      [contenteditable="true"] h1,
      [contenteditable="true"] h2,
      [contenteditable="true"] h3 {
        margin: 1rem 0 0.5rem 0;
        font-weight: bold;
      }

      [contenteditable="true"] h1 {
        font-size: 1.5rem;
      }

      [contenteditable="true"] h2 {
        font-size: 1.25rem;
      }

      [contenteditable="true"] h3 {
        font-size: 1.1rem;
      }

      [contenteditable="true"] ul,
      [contenteditable="true"] ol {
        margin: 0.5rem 0;
        padding-left: 1.5rem;
      }

      [contenteditable="true"] li {
        margin: 0.25rem 0;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/library/categories"],
    queryFn: async () => {
      const response = await fetch("/api/library/categories", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  // Fetch ALL subcategories (unfiltered to correctly show module counts in sidebar)
  const { data: subcategories = [] } = useQuery({
    queryKey: ["/api/library/subcategories"],
    queryFn: async () => {
      const response = await fetch("/api/library/subcategories", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch subcategories");
      return response.json();
    },
  });

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ["/api/library/documents", selectedCategory, selectedSubcategory, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("categoryId", selectedCategory);
      if (selectedSubcategory !== "all") params.append("subcategoryId", selectedSubcategory);
      if (searchTerm) params.append("search", searchTerm);

      const response = await fetch(`/api/library/documents?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    },
  });

  // Fetch clients
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

  // Fetch category assignments
  const { data: categoryAssignments = [] } = useQuery({
    queryKey: ["/api/library/categories", assigningCategory?.id, "assignments"],
    queryFn: async () => {
      if (!assigningCategory?.id) return [];
      const response = await fetch(`/api/library/categories/${assigningCategory.id}/assignments`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch assignments");
      return response.json();
    },
    enabled: !!assigningCategory?.id,
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: any) => {
      const response = await fetch("/api/library/categories", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(categoryData),
      });
      if (!response.ok) throw new Error("Failed to create category");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library/categories"] });
      setShowCategoryDialog(false);
      resetCategoryForm();
      toast({
        title: "Corso creato",
        description: "Il corso è stato creato con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la creazione del corso",
        variant: "destructive",
      });
    },
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, categoryData }: { id: string; categoryData: any }) => {
      const response = await fetch(`/api/library/categories/${id}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(categoryData),
      });
      if (!response.ok) throw new Error("Failed to update category");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library/categories"] });
      setShowCategoryDialog(false);
      setEditingCategory(undefined);
      resetCategoryForm();
      toast({
        title: "Corso aggiornato",
        description: "Il corso è stato aggiornato con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento del corso",
        variant: "destructive",
      });
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      const response = await fetch(`/api/library/categories/${categoryId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete category");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library/categories"] });
      setDeletingCategoryId(null);
      toast({
        title: "Corso eliminato",
        description: "Il corso è stato eliminato con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'eliminazione del corso",
        variant: "destructive",
      });
    },
  });

  // Create subcategory mutation
  const createSubcategoryMutation = useMutation({
    mutationFn: async (subcategoryData: any) => {
      const response = await fetch("/api/library/subcategories", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subcategoryData),
      });
      if (!response.ok) throw new Error("Failed to create subcategory");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library/subcategories"] });
      setShowSubcategoryDialog(false);
      resetSubcategoryForm();
      toast({
        title: "Sotto-categoria creata",
        description: "La sotto-categoria è stata creata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante la creazione della sotto-categoria",
        variant: "destructive",
      });
    },
  });

  // Update subcategory mutation
  const updateSubcategoryMutation = useMutation({
    mutationFn: async ({ id, subcategoryData }: { id: string; subcategoryData: any }) => {
      const response = await fetch(`/api/library/subcategories/${id}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subcategoryData),
      });
      if (!response.ok) throw new Error("Failed to update subcategory");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library/subcategories"] });
      setShowSubcategoryDialog(false);
      setEditingSubcategory(undefined);
      resetSubcategoryForm();
      toast({
        title: "Sotto-categoria aggiornata",
        description: "La sotto-categoria è stata aggiornata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento della sotto-categoria",
        variant: "destructive",
      });
    },
  });

  // Delete subcategory mutation
  const deleteSubcategoryMutation = useMutation({
    mutationFn: async (subcategoryId: string) => {
      const response = await fetch(`/api/library/subcategories/${subcategoryId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete subcategory");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library/subcategories"] });
      setDeletingSubcategory(undefined);
      toast({
        title: "Sotto-categoria eliminata",
        description: "La sotto-categoria è stata eliminata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'eliminazione della sotto-categoria",
        variant: "destructive",
      });
    },
  });


  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async ({ id, documentData }: { id: string; documentData: any }) => {
      // Se ci sono nuovi file, usa FormData, altrimenti usa JSON
      if (documentData.newAttachments && documentData.newAttachments.length > 0) {
        const formData = new FormData();

        // Add all form fields except attachments
        Object.keys(documentData).forEach(key => {
          if (key !== 'newAttachments' && key !== 'existingAttachments') {
            if (key === 'tags' && Array.isArray(documentData[key])) {
              formData.append(key, JSON.stringify(documentData[key]));
            } else {
              formData.append(key, String(documentData[key]));
            }
          }
        });

        // Add existing attachments info
        if (documentData.existingAttachments) {
          formData.append('existingAttachments', JSON.stringify(documentData.existingAttachments));
        }

        // Add new file attachments
        documentData.newAttachments.forEach((file: File) => {
          formData.append('attachments', file);
        });

        const response = await fetch(`/api/library/documents/${id}`, {
          method: "PUT",
          headers: getAuthHeaders(), // No Content-Type for FormData
          body: formData,
        });
        if (!response.ok) throw new Error("Failed to update document");
        return response.json();
      } else {
        // No new files, just update JSON data
        const response = await fetch(`/api/library/documents/${id}`, {
          method: "PUT",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(documentData),
        });
        if (!response.ok) throw new Error("Failed to update document");
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library/documents"] });
      setShowDocumentDialog(false);
      setEditingDocument(undefined);
      resetDocumentForm();
      toast({
        title: "Lezione aggiornata",
        description: "La lezione è stata aggiornata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'aggiornamento della lezione",
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/library/documents/${documentId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete document");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library/documents"] });
      setDeletingDocument(undefined);
      toast({
        title: "Lezione eliminata",
        description: "La lezione è stata eliminata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'eliminazione della lezione",
        variant: "destructive",
      });
    },
  });

  // Create document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (documentData: any) => {
      const formData = new FormData();

      // Add all form fields except attachments
      Object.keys(documentData).forEach(key => {
        if (key !== 'attachments') {
          if (key === 'tags' && Array.isArray(documentData[key])) {
            formData.append(key, JSON.stringify(documentData[key]));
          } else {
            formData.append(key, String(documentData[key]));
          }
        }
      });

      // Add file attachments
      if (documentData.attachments && documentData.attachments.length > 0) {
        documentData.attachments.forEach((file: File) => {
          formData.append('attachments', file);
        });
      }

      const response = await fetch("/api/library/documents", {
        method: "POST",
        headers: getAuthHeaders(), // Non includere Content-Type per FormData
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to create document");
      return response.json();
    },
    onSuccess: (newDocument) => {
      // Invalida tutte le query dei documenti
      queryClient.invalidateQueries({ queryKey: ["/api/library/documents"] });

      // Se è stata selezionata una categoria specifica, seleziona la categoria del nuovo documento
      if (newDocument.categoryId && selectedCategory === "all") {
        setSelectedCategory(newDocument.categoryId);
      }

      setShowDocumentDialog(false);
      resetDocumentForm();
      toast({
        title: "Lezione creata",
        description: "La lezione è stata creata con successo",
      });
    },
    onError: (error: any) => {
      console.error('Document creation error:', error);
      let errorMessage = "Errore durante la creazione della lezione";

      // Se c'è un messaggio di errore specifico, usalo
      if (error.message) {
        errorMessage = error.message;
        // Se è un errore di validazione, rendiamolo più leggibile
        if (error.message.includes("validation")) {
          errorMessage = "Errore di validazione: controlla che tutti i campi obbligatori siano compilati correttamente";
        }
      }

      toast({
        title: "Errore",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Mutation for assigning courses to clients
  const assignCategoryMutation = useMutation({
    mutationFn: async ({ categoryId, clientIds }: { categoryId: string; clientIds: string[] }) => {
      const response = await fetch(`/api/library/categories/${categoryId}/assign-clients`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientIds }),
      });
      if (!response.ok) throw new Error("Failed to save assignments");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library/categories", assigningCategory?.id, "assignments"] });
      toast({
        title: "Assegnazione salvata",
        description: "Le assegnazioni del corso sono state salvate con successo.",
      });
      setShowAssignmentDialog(false);
      setAssigningCategory(undefined);
      setSelectedClients([]);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il salvataggio delle assegnazioni",
        variant: "destructive",
      });
    },
  });

  const resetCategoryForm = () => {
    setCategoryForm({
      name: "",
      description: "",
      icon: "BookOpen",
      color: "blue",
      theme: "classic",
      sortOrder: 0,
    });
  };

  const resetSubcategoryForm = () => {
    setSubcategoryForm({
      categoryId: "",
      name: "",
      description: "",
      icon: "Folder",
      color: "gray",
      sortOrder: 0,
    });
  };

  const resetDocumentForm = () => {
    setDocumentForm({
      categoryId: "",
      subcategoryId: "",
      title: "",
      subtitle: "",
      description: "",
      content: "",
      contentType: "text",
      videoUrl: "",
      level: "base",
      estimatedDuration: "",
      tags: [],
      sortOrder: 0,
      isPublished: true,
      attachments: [],
    });
  };

  const handleCreateCategory = () => {
    // Valida che ci sia un nome
    if (!categoryForm.name || !categoryForm.name.trim()) {
      toast({
        title: "Errore",
        description: "Il nome del corso è obbligatorio",
        variant: "destructive",
      });
      return;
    }

    if (editingCategory) {
      updateCategoryMutation.mutate({
        id: editingCategory.id,
        categoryData: categoryForm,
      });
    } else {
      createCategoryMutation.mutate(categoryForm);
    }
  };

  const handleEditCategory = (category: LibraryCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description,
      icon: category.icon || "BookOpen",
      color: category.color || "blue",
      theme: (category as any).theme || "classic",
      sortOrder: category.sortOrder,
    });
    setShowCategoryDialog(true);
  };

  const handleCreateSubcategory = () => {
    // Valida che ci sia un corso selezionato
    if (!subcategoryForm.categoryId || !subcategoryForm.categoryId.trim()) {
      toast({
        title: "Errore",
        description: "Seleziona un corso per la categoria",
        variant: "destructive",
      });
      return;
    }

    if (!subcategoryForm.name || !subcategoryForm.name.trim()) {
      toast({
        title: "Errore",
        description: "Il nome della categoria è obbligatorio",
        variant: "destructive",
      });
      return;
    }

    if (editingSubcategory) {
      updateSubcategoryMutation.mutate({
        id: editingSubcategory.id,
        subcategoryData: subcategoryForm,
      });
    } else {
      createSubcategoryMutation.mutate(subcategoryForm);
    }
  };

  const handleEditSubcategory = (subcategory: LibrarySubcategory) => {
    setEditingSubcategory(subcategory);
    setSubcategoryForm({
      categoryId: subcategory.categoryId,
      name: subcategory.name,
      description: subcategory.description || "",
      icon: subcategory.icon || "Folder",
      color: subcategory.color || "gray",
      sortOrder: subcategory.sortOrder,
    });
    setShowSubcategoryDialog(true);
  };

  const handleViewDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/library/documents/${documentId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch document");
      const document = await response.json();

      // Qui potresti aprire un dialog di visualizzazione o navigare a una pagina dettaglio
      toast({
        title: "Lezione caricata",
        description: `Lezione: ${document.title}`,
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile caricare la lezione",
        variant: "destructive",
      });
    }
  };

  const handleEditDocument = (document: LibraryDocument) => {
    setEditingDocument(document);
    setDocumentForm({
      categoryId: document.categoryId,
      subcategoryId: document.subcategoryId || "",
      title: document.title,
      subtitle: document.subtitle || "",
      description: document.description || "",
      content: document.content || "",
      contentType: (document as any).contentType || "text",
      videoUrl: (document as any).videoUrl || "",
      level: document.level,
      estimatedDuration: document.estimatedDuration?.toString() || "",
      tags: document.tags || [],
      sortOrder: document.sortOrder,
      isPublished: document.isPublished !== false,
      attachments: [],
    });
    setShowDocumentDialog(true);
  };

  const handleCreateDocument = () => {
    // Valida i campi obbligatori prima di inviare
    if (!documentForm.categoryId || !documentForm.categoryId.trim()) {
      toast({
        title: "Errore",
        description: "Seleziona un corso per la lezione",
        variant: "destructive",
      });
      return;
    }

    if (!documentForm.title || !documentForm.title.trim()) {
      toast({
        title: "Errore",
        description: "Il titolo della lezione è obbligatorio",
        variant: "destructive",
      });
      return;
    }

    // Validazione per contenuto video
    if (documentForm.contentType === "video" || documentForm.contentType === "both") {
      if (!documentForm.videoUrl || !documentForm.videoUrl.trim()) {
        toast({
          title: "Errore",
          description: "Il link del video è obbligatorio per le lezioni video",
          variant: "destructive",
        });
        return;
      }

      // Validazione URL video (YouTube, Vimeo, Wistia)
      const videoUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com\/|.*\.wistia\.com\/)/i;
      if (!videoUrlPattern.test(documentForm.videoUrl)) {
        toast({
          title: "Errore",
          description: "Inserisci un link valido di YouTube, Vimeo o Wistia",
          variant: "destructive",
        });
        return;
      }
    }

    // Validazione per contenuto testuale
    if (documentForm.contentType === "text" || documentForm.contentType === "both") {
      if (!documentForm.content || !documentForm.content.trim()) {
        toast({
          title: "Errore",
          description: "Il contenuto testuale è obbligatorio",
          variant: "destructive",
        });
        return;
      }
    }

    if (editingDocument) {
      // Per l'editing, usa l'update mutation che gestisce JSON
      const documentData = {
        categoryId: documentForm.categoryId.trim(),
        subcategoryId: documentForm.subcategoryId?.trim() || null, // Include subcategoryId
        title: documentForm.title.trim(),
        subtitle: documentForm.subtitle?.trim() || '',
        description: documentForm.description?.trim() || '',
        content: documentForm.content?.trim() || '',
        contentType: documentForm.contentType || 'text',
        videoUrl: (documentForm.contentType === 'video' || documentForm.contentType === 'both')
          ? (documentForm.videoUrl?.trim() || '')
          : '', // Include videoUrl solo per video o both
        level: documentForm.level || 'base',
        estimatedDuration: documentForm.estimatedDuration ? parseInt(documentForm.estimatedDuration, 10) : undefined,
        sortOrder: documentForm.sortOrder || 0,
        isPublished: documentForm.isPublished !== false, // Mantieni lo stato di pubblicazione
        tags: Array.isArray(documentForm.tags) ? documentForm.tags : [],
        // Per l'editing, usa gli allegati aggiornati dal documento in editing (potrebbero essere stati rimossi)
        existingAttachments: editingDocument?.attachments || [],
        newAttachments: documentForm.attachments || [],
      };

      // Remove only truly undefined values, but keep false values for isPublished and empty strings for videoUrl
      Object.keys(documentData).forEach(key => {
        const value = documentData[key as keyof typeof documentData];
        // Non rimuovere videoUrl anche se è stringa vuota (per pulire il campo quando si passa da video a text)
        if (value === undefined && key !== 'videoUrl') {
          delete documentData[key as keyof typeof documentData];
        }
      });

      updateDocumentMutation.mutate({
        id: editingDocument.id,
        documentData,
      });
    } else {
      // Per la creazione, usa FormData per i file
      const documentData = {
        categoryId: documentForm.categoryId.trim(),
        subcategoryId: documentForm.subcategoryId && documentForm.subcategoryId.trim() !== '' ? documentForm.subcategoryId.trim() : null,
        title: documentForm.title.trim(),
        subtitle: documentForm.subtitle?.trim() || '',
        description: documentForm.description?.trim() || '',
        content: documentForm.content?.trim() || '',
        contentType: documentForm.contentType || 'text',
        videoUrl: documentForm.videoUrl?.trim() || '',
        level: documentForm.level || 'base',
        estimatedDuration: documentForm.estimatedDuration ? parseInt(documentForm.estimatedDuration, 10) : undefined,
        sortOrder: documentForm.sortOrder || 0,
        isPublished: true, // Sempre pubblicato
        tags: Array.isArray(documentForm.tags) ? documentForm.tags : [],
        attachments: documentForm.attachments || [],
      };

      // Remove undefined values
      Object.keys(documentData).forEach(key => {
        if (documentData[key as keyof typeof documentData] === undefined) {
          delete documentData[key as keyof typeof documentData];
        }
      });

      createDocumentMutation.mutate(documentData);
    }
  };

  const handleCreateDocumentClick = () => {
    // Reset per nuova lezione
    setEditingDocument(undefined);
    resetDocumentForm();

    // Pre-compila il form con le selezioni correnti
    const formData: any = {};
    if (selectedCategory !== "all") {
      formData.categoryId = selectedCategory;
    }
    if (selectedSubcategory !== "all") {
      formData.subcategoryId = selectedSubcategory;
    }

    setDocumentForm(prev => ({
      ...prev,
      ...formData,
    }));
    setShowDocumentDialog(true);
  };

  const addTag = () => {
    if (newTag.trim() && !documentForm.tags.includes(newTag.trim())) {
      setDocumentForm({
        ...documentForm,
        tags: [...documentForm.tags, newTag.trim()],
      });
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setDocumentForm({
      ...documentForm,
      tags: documentForm.tags.filter(tag => tag !== tagToRemove),
    });
  };

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case "BookOpen": return <BookOpen size={20} />;
      case "FileText": return <FileText size={20} />;
      case "Folder": return <Folder size={20} />;
      case "Users": return <Users size={20} />;
      default: return <BookOpen size={20} />;
    }
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case "base": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "intermedio": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "avanzato": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  // Filter documents to show only published ones, unless "all" is selected or it's a search
  const visibleDocuments = documents.filter(
    (doc: LibraryDocument) => doc.isPublished || selectedCategory === "all" || searchTerm
  );

  // Filter documents by level and sort by sortOrder
  const filteredDocuments = ((selectedLevel === "all")
    ? visibleDocuments
    : visibleDocuments.filter((doc: LibraryDocument) => doc.level === selectedLevel)
  ).sort((a: LibraryDocument, b: LibraryDocument) => {
    // Sort by sortOrder first (ascending), then by createdAt (oldest first)
    const orderA = (a as any).sortOrder ?? 999;
    const orderB = (b as any).sortOrder ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    // Fallback to createdAt if sortOrder is the same (oldest first = natural order)
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateA - dateB;
  });

  // Placeholder for getCategoryProgress if it's used elsewhere and needs to be defined
  const getCategoryProgress = (categoryId: string) => {
    // Replace with actual logic if needed
    return 0;
  };

  // Funzione per aggiornare lo stato visivo della toolbar
  const updateToolbarState = () => {
    try {
      // Ottieni tutti i bottoni della toolbar
      const boldButton = document.querySelector('[data-format="bold"]') as HTMLElement;
      const italicButton = document.querySelector('[data-format="italic"]') as HTMLElement;
      const underlineButton = document.querySelector('[data-format="underline"]') as HTMLElement;

      // Funzione helper per aggiornare un singolo bottone
      const updateButton = (button: HTMLElement, isActive: boolean) => {
        if (!button) return;

        // Rimuovi tutte le classi di stato precedenti
        button.className = button.className
          .replace(/bg-blue-\d+/g, '')
          .replace(/dark:bg-blue-\d+\/\d+/g, '')
          .replace(/text-blue-\d+/g, '')
          .replace(/dark:text-blue-\d+/g, '')
          .replace(/border-blue-\d+/g, '')
          .replace(/shadow-\w+/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (isActive) {
          // Aggiungi stile attivo con bordo e ombra per maggiore visibilità
          button.className += ' bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600 shadow-sm';
        }
      };

      // Verifica e aggiorna lo stato di ogni bottone
      if (boldButton) {
        const isBold = document.queryCommandState('bold');
        updateButton(boldButton, isBold);
      }

      if (italicButton) {
        const isItalic = document.queryCommandState('italic');
        updateButton(italicButton, isItalic);
      }

      if (underlineButton) {
        const isUnderline = document.queryCommandState('underline');
        updateButton(underlineButton, isUnderline);
      }
    } catch (error) {
      // Ignora errori di queryCommandState quando l'editor non è in focus
      console.debug('updateToolbarState error:', error);
    }
  };

  // Sincronizza selectedClients con categoryAssignments quando cambiano
  useEffect(() => {
    if (showAssignmentDialog && categoryAssignments) {
      setSelectedClients(categoryAssignments.map((assignment: any) => assignment.clientId));
    }
  }, [categoryAssignments, showAssignmentDialog]);

  const handleAssignCategory = (category: LibraryCategory) => {
    setAssigningCategory(category);
    setShowAssignmentDialog(true);
  };

  const getColorGradient = (color: string) => {
    switch (color) {
      case 'blue': return 'from-blue-500 to-blue-600';
      case 'green': return 'from-green-500 to-green-600';
      case 'purple': return 'from-purple-500 to-purple-600';
      case 'red': return 'from-red-500 to-red-600';
      case 'yellow': return 'from-yellow-500 to-yellow-600';
      default: return 'from-purple-500 to-indigo-600';
    }
  };

  const getColorBorder = (color: string = 'purple') => {
    const borders: Record<string, string> = {
      blue: 'border-blue-300 dark:border-blue-700',
      green: 'border-green-300 dark:border-green-700',
      purple: 'border-purple-300 dark:border-purple-700',
      red: 'border-red-300 dark:border-red-700',
      yellow: 'border-yellow-300 dark:border-yellow-700',
    };
    return borders[color] || borders.purple;
  };

  const startDeleteProcess = (categoryId: string) => {
    setDeletingCategoryId(categoryId);
    setDeleteStep(1);
    setDeleteConfirmText("");
  };

  const cancelDeleteProcess = () => {
    setDeletingCategoryId(null);
    setDeleteStep(0);
    setDeleteConfirmText("");
  };

  const proceedDeleteStep = () => {
    if (deleteStep < 3) {
      setDeleteStep(deleteStep + 1);
    }
  };

  const confirmFinalDelete = () => {
    if (deleteConfirmText.toUpperCase() === "CANCELLA" && deletingCategoryId) {
      deleteCategoryMutation.mutate(deletingCategoryId);
      cancelDeleteProcess();
    }
  };

  const toggleCourseExpansion = (courseId: string) => {
    setExpandedCourses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(courseId)) {
        newSet.delete(courseId);
      } else {
        newSet.add(courseId);
      }
      return newSet;
    });
  };

  const handleCourseClick = (courseId: string) => {
    setSelectedCategory(courseId);
    setSelectedSubcategory("all");
    if (!expandedCourses.has(courseId)) {
      setExpandedCourses(prev => new Set([...prev, courseId]));
    }
    if (isMobile) setNavSidebarOpen(false);
  };

  const handleSubcategoryClick = (courseId: string, subcategoryId: string) => {
    setSelectedCategory(courseId);
    setSelectedSubcategory(subcategoryId);
    if (isMobile) setNavSidebarOpen(false);
  };

  const handleAllCoursesClick = () => {
    setSelectedCategory("all");
    setSelectedSubcategory("all");
    if (isMobile) setNavSidebarOpen(false);
  };

  const getBreadcrumbText = () => {
    if (selectedCategory === "all") return "Tutti i corsi";
    const course = categories.find((c: LibraryCategory) => c.id === selectedCategory);
    if (!course) return "Tutti i corsi";
    if (selectedSubcategory === "all") return course.name;
    const subcategory = subcategories.find((s: LibrarySubcategory) => s.id === selectedSubcategory);
    return subcategory ? `${course.name} > ${subcategory.name}` : course.name;
  };

  const handleSaveAssignment = () => {
    if (!assigningCategory?.id) return;

    const clientsToAssign = selectedClients;
    const existingAssignedClientIds = categoryAssignments.map((assignment: any) => assignment.clientId);

    // For now, we'll just send the list of selected clients.
    // A more robust solution would handle additions and removals separately.
    assignCategoryMutation.mutate({
      categoryId: assigningCategory.id,
      clientIds: clientsToAssign,
    });
  };

  const NavigationSidebar = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Cerca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3">
          <button
            onClick={handleAllCoursesClick}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-3 ${
              selectedCategory === "all"
                ? "bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-100"
                : "hover:bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen size={16} />
            Tutti i corsi
          </button>

          <div className="space-y-3">
            {categories.map((category: LibraryCategory) => {
              const categorySubcats = subcategories.filter((s: LibrarySubcategory) => s.categoryId === category.id);
              const isExpanded = expandedCourses.has(category.id);
              const isSelected = selectedCategory === category.id && selectedSubcategory === "all";
              const lessonCount = documents.filter((d: LibraryDocument) => d.categoryId === category.id).length;

              return (
                <div key={category.id} className="mb-3">
                  <Card className={`transition-all duration-200 hover:shadow-md ${
                    isSelected ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'bg-white dark:bg-slate-800'
                  }`}>
                    <div className={`h-1.5 bg-gradient-to-r ${getColorGradient(category.color || 'purple')}`} />
                    
                    <CardContent className="p-3 min-w-0">
                      <div className="flex items-center gap-2 mb-2 min-w-0">
                        {categorySubcats.length > 0 && (
                          <button 
                            onClick={() => toggleCourseExpansion(category.id)} 
                            className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                        <button 
                          onClick={() => handleCourseClick(category.id)} 
                          className={`flex-1 text-left min-w-0 ${categorySubcats.length === 0 ? 'ml-6' : ''}`}
                        >
                          <h4 className="font-semibold text-sm line-clamp-2 break-words">{category.name}</h4>
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                        <span className="flex items-center gap-1">
                          <FileText size={12} />
                          {lessonCount} lezioni
                        </span>
                        <span className="flex items-center gap-1">
                          <Folder size={12} />
                          {categorySubcats.length} moduli
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-0.5 sm:gap-1 pt-2 border-t flex-wrap">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleEditCategory(category)}
                          className="flex-1 h-7 text-xs hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 min-w-0 px-1 sm:px-2"
                        >
                          <Edit3 size={12} className="sm:mr-1" /> 
                          <span className="hidden sm:inline">Modifica</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleAssignCategory(category)}
                          className="flex-1 h-7 text-xs hover:bg-green-100 hover:text-green-600 dark:hover:bg-green-900/30 min-w-0 px-1 sm:px-2"
                        >
                          <Users size={12} className="sm:mr-1" /> 
                          <span className="hidden sm:inline">Assegna</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => startDeleteProcess(category.id)}
                          className="h-7 w-7 p-0 hover:bg-red-100 text-destructive dark:hover:bg-red-900/30"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {isExpanded && categorySubcats.length > 0 && (
                    <div className="mt-2 pl-3 space-y-1">
                      <div className={`border-l-2 pl-3 space-y-1 ${getColorBorder(category.color)}`}>
                        {categorySubcats.map((subcategory: LibrarySubcategory) => {
                          const isSubSelected = selectedCategory === category.id && selectedSubcategory === subcategory.id;
                          const subDocCount = documents.filter((d: LibraryDocument) => d.subcategoryId === subcategory.id).length;

                          return (
                            <div key={subcategory.id} className="flex items-start group min-w-0">
                              <button
                                onClick={() => handleSubcategoryClick(category.id, subcategory.id)}
                                className={`flex-1 flex items-start gap-2 px-2.5 py-2 rounded-lg text-sm transition-all duration-200 min-w-0 ${
                                  isSubSelected
                                    ? "bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-900 dark:from-purple-900/40 dark:to-indigo-900/40 dark:text-purple-100 shadow-sm"
                                    : "hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                                }`}
                              >
                                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                                  isSubSelected ? 'bg-purple-200 dark:bg-purple-800' : 'bg-slate-200 dark:bg-slate-600'
                                }`}>
                                  <Folder size={12} className={isSubSelected ? 'text-purple-700 dark:text-purple-300' : 'text-slate-500 dark:text-slate-400'} />
                                </div>
                                <span className="flex-1 text-left break-words whitespace-normal leading-tight">{subcategory.name}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                  isSubSelected 
                                    ? 'bg-purple-200 text-purple-700 dark:bg-purple-800 dark:text-purple-200' 
                                    : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'
                                }`}>
                                  {subDocCount}
                                </span>
                              </button>
                              <div className="flex opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => handleEditSubcategory(subcategory)}
                                >
                                  <Edit3 size={10} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-destructive"
                                  onClick={() => setDeletingSubcategory(subcategory.id)}
                                >
                                  <Trash2 size={10} />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      <div className="p-3 border-t">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowCategoryDialog(true)}
        >
          <Plus size={14} className="mr-2" />
          Nuovo Corso
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center justify-between px-4 md:px-6 h-14">
              <div className="flex items-center gap-3">
                {isMobile && (
                  <Sheet open={navSidebarOpen} onOpenChange={setNavSidebarOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="sm" className="md:hidden">
                        <Menu size={20} />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[85vw] max-w-80 p-0">
                      <NavigationSidebar />
                    </SheetContent>
                  </Sheet>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <BookOpen size={16} className="text-white" />
                  </div>
                  <h1 className="text-lg md:text-xl font-bold">Libreria Formativa</h1>
                </div>
                <div className="hidden md:flex items-center gap-2 ml-4">
                  <Badge variant="secondary" className="text-xs">
                    {categories.length} Corsi
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {visibleDocuments.length} Lezioni
                  </Badge>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
                    <Plus size={16} className="mr-2" />
                    Nuovo
                    <ChevronDown size={14} className="ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocation("/consultant/library/ai-builder")}>
                    <Sparkles size={16} className="mr-2 text-pink-500" />
                    Crea con AI
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowCategoryDialog(true)}>
                    <Folder size={16} className="mr-2" />
                    Nuovo Corso
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setEditingSubcategory(undefined);
                    setSubcategoryForm({
                      categoryId: selectedCategory !== "all" ? selectedCategory : "",
                      name: "",
                      description: "",
                      icon: "Folder",
                      color: "gray",
                      sortOrder: 0,
                    });
                    setShowSubcategoryDialog(true);
                  }}>
                    <Folder size={16} className="mr-2" />
                    Nuovo Modulo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCreateDocumentClick}>
                    <FileText size={16} className="mr-2" />
                    Nuova Lezione
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {!isMobile && (
              <div className="w-80 min-w-80 border-r bg-muted/30 hidden md:flex flex-col min-h-0">
                <NavigationSidebar />
              </div>
            )}

            <div className="flex-1 overflow-auto">
              <div className="p-4 md:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BookOpen size={14} />
                    <span className="font-medium">{getBreadcrumbText()}</span>
                  </div>
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger className="w-full sm:w-40 h-9">
                      <SelectValue placeholder="Tutti i livelli" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti i livelli</SelectItem>
                      <SelectItem value="base">🟢 Base</SelectItem>
                      <SelectItem value="intermedio">🟡 Intermedio</SelectItem>
                      <SelectItem value="avanzato">🔴 Avanzato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filteredDocuments.length === 0 ? (
                  <Card className="p-12 text-center">
                    <BookOpen size={48} className="mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">
                      {categories.length === 0 ? "Nessun corso disponibile" : "Nessuna lezione trovata"}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {categories.length === 0
                        ? "Inizia creando il tuo primo corso!"
                        : "Non ci sono lezioni che corrispondono ai filtri selezionati."}
                    </p>
                    {categories.length === 0 ? (
                      <Button onClick={() => setShowCategoryDialog(true)}>
                        <Plus size={16} className="mr-2" />
                        Crea Primo Corso
                      </Button>
                    ) : (
                      <Button onClick={handleCreateDocumentClick}>
                        <Plus size={16} className="mr-2" />
                        Aggiungi Lezione
                      </Button>
                    )}
                  </Card>
                ) : (
                  <div className="flex flex-col gap-3">
                    {filteredDocuments.map((document: LibraryDocument, index: number) => {
                      const course = categories.find((c: LibraryCategory) => c.id === document.categoryId);
                      const subcategory = document.subcategoryId
                        ? subcategories.find((s: LibrarySubcategory) => s.id === document.subcategoryId)
                        : null;
                      const sortOrder = (document as any).sortOrder;

                      return (
                        <Card key={document.id} className="group hover:shadow-lg transition-all duration-200 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                          <CardContent className="p-3 sm:p-4">
                            <div className="flex items-start gap-3 sm:gap-4">
                              {/* Order Badge */}
                              <div className="flex-shrink-0">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center text-xs sm:text-sm font-bold shadow-md">
                                  {sortOrder ?? index + 1}
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-start gap-1 sm:gap-2 mb-1">
                                  <h3 className="font-semibold text-sm sm:text-base text-slate-800 dark:text-slate-100 break-words leading-tight w-full sm:w-auto">
                                    {document.title}
                                  </h3>
                                  <div className="flex flex-wrap gap-1">
                                    <Badge className={`${getLevelBadgeColor(document.level)} text-xs font-medium px-2 py-0 flex-shrink-0`}>
                                      {document.level}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs px-2 flex-shrink-0">
                                      {(document as any).contentType === 'video' ? '🎥' : (document as any).contentType === 'both' ? '📚' : '📄'}
                                    </Badge>
                                    {document.estimatedDuration && (
                                      <Badge variant="outline" className="text-xs flex items-center gap-1 flex-shrink-0">
                                        <Clock size={10} />
                                        {document.estimatedDuration}m
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {document.subtitle && (
                                  <p className="text-xs sm:text-sm text-muted-foreground break-words leading-tight">{document.subtitle}</p>
                                )}
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                  <Folder size={11} className="text-primary/70 flex-shrink-0" />
                                  <span className="break-words">
                                    {course?.name}{subcategory ? ` > ${subcategory.name}` : ''}
                                  </span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewDocument(document.id)}
                                  className="h-7 w-7 sm:h-9 sm:w-9 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600"
                                  title="Visualizza"
                                >
                                  <Eye size={14} className="sm:w-4 sm:h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditDocument(document)}
                                  className="h-7 w-7 sm:h-9 sm:w-9 p-0 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600"
                                  title="Modifica"
                                >
                                  <Edit3 size={14} className="sm:w-4 sm:h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingDocument(document.id)}
                                  className="h-7 w-7 sm:h-9 sm:w-9 p-0 hover:bg-red-100 dark:hover:bg-red-900/30 text-destructive"
                                  title="Elimina"
                                >
                                  <Trash2 size={14} className="sm:w-4 sm:h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Modifica Corso" : "Nuovo Corso"}
            </DialogTitle>
            <DialogDescription>
              Crea un nuovo corso per organizzare le lezioni formative.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">Nome Corso</Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="Nome del corso"
              />
            </div>
            <div>
              <Label htmlFor="category-description">Descrizione Corso</Label>
              <Textarea
                id="category-description"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Descrizione del corso"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category-icon">Icona Corso</Label>
                <Select
                  value={categoryForm.icon}
                  onValueChange={(value) => setCategoryForm({ ...categoryForm, icon: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BookOpen">📖 Libro</SelectItem>
                    <SelectItem value="FileText">📄 Documento</SelectItem>
                    <SelectItem value="Folder">📁 Cartella</SelectItem>
                    <SelectItem value="Users">👥 Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="category-color">Colore Corso</Label>
                <Select
                  value={categoryForm.color}
                  onValueChange={(value) => setCategoryForm({ ...categoryForm, color: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">🔵 Blu</SelectItem>
                    <SelectItem value="green">🟢 Verde</SelectItem>
                    <SelectItem value="purple">🟣 Viola</SelectItem>
                    <SelectItem value="red">🔴 Rosso</SelectItem>
                    <SelectItem value="yellow">🟡 Giallo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="category-theme">Tema Lezioni AI</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Definisce lo stile visivo delle lezioni generate dall'AI
              </p>
              <Select
                value={categoryForm.theme}
                onValueChange={(value) => setCategoryForm({ ...categoryForm, theme: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COURSE_THEMES.map((theme) => (
                    <SelectItem key={theme.id} value={theme.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: theme.preview.primary }}
                        />
                        <span className="font-medium">{theme.name}</span>
                        <span className="text-xs text-muted-foreground">- {theme.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleCreateCategory} disabled={!categoryForm.name.trim()}>
              {editingCategory ? "Aggiorna" : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Document Creation Dialog */}
      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
        <DialogContent className="sm:max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <FileText size={20} className="text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl">
                  ✨ {editingDocument ? "Modifica Lezione" : "Creatore Lezione Avanzato"}
                </DialogTitle>
                <DialogDescription>
                  {editingDocument
                    ? "Modifica la lezione esistente con strumenti avanzati di editing e anteprima"
                    : "Crea contenuti formativi professionali con strumenti avanzati di editing e anteprima"
                  }
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="content" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="content" className="flex items-center gap-2">
                  <FileText size={16} />
                  Contenuto
                </TabsTrigger>
                <TabsTrigger value="structure" className="flex items-center gap-2">
                  <Settings size={16} />
                  Struttura
                </TabsTrigger>
                <TabsTrigger value="media" className="flex items-center gap-2">
                  <Eye size={16} />
                  Media
                </TabsTrigger>
                <TabsTrigger value="preview" className="flex items-center gap-2">
                  <Eye size={16} />
                  Anteprima
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto">
                {/* Content Tab */}
                <TabsContent value="content" className="space-y-6 mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Basic Information */}
                    <Card className="p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Tag size={18} />
                        Informazioni Base Lezione
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor="document-category">Corso *</Label>
                            <Select
                              value={documentForm.categoryId}
                              onValueChange={(value) => {
                                setDocumentForm({ ...documentForm, categoryId: value, subcategoryId: "" });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona corso" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((category: LibraryCategory) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="document-subcategory">Categoria</Label>
                            <Select
                              value={documentForm.subcategoryId}
                              onValueChange={(value) => setDocumentForm({ ...documentForm, subcategoryId: value })}
                              disabled={!documentForm.categoryId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona categoria" />
                              </SelectTrigger>
                              <SelectContent>
                                {subcategories
                                  .filter((sub: any) => sub.categoryId === documentForm.categoryId)
                                  .map((subcategory: any) => (
                                    <SelectItem key={subcategory.id} value={subcategory.id}>
                                      {subcategory.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="document-level">Livello di Difficoltà *</Label>
                            <Select
                              value={documentForm.level}
                              onValueChange={(value: "base" | "intermedio" | "avanzato") =>
                                setDocumentForm({ ...documentForm, level: value })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="base">🟢 Base - Principianti</SelectItem>
                                <SelectItem value="intermedio">🟡 Intermedio - Esperienza Media</SelectItem>
                                <SelectItem value="avanzato">🔴 Avanzato - Esperti</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="document-title">Titolo della Lezione *</Label>
                          <Input
                            id="document-title"
                            value={documentForm.title}
                            onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })}
                            placeholder="es. Fondamenti di Investimento Immobiliare"
                            className="text-lg"
                          />
                        </div>

                        <div>
                          <Label htmlFor="document-subtitle">Sottotitolo Accattivante</Label>
                          <Input
                            id="document-subtitle"
                            value={documentForm.subtitle}
                            onChange={(e) => setDocumentForm({ ...documentForm, subtitle: e.target.value })}
                            placeholder="es. La guida completa per iniziare nel real estate"
                          />
                        </div>

                        <div>
                          <Label htmlFor="document-description">Descrizione e Obiettivi</Label>
                          <Textarea
                            id="document-description"
                            value={documentForm.description}
                            onChange={(e) => setDocumentForm({ ...documentForm, description: e.target.value })}
                            placeholder="Descrivi cosa imparerà il cliente, quali problemi risolve questa lezione e perché è importante..."
                            rows={4}
                            className="resize-none"
                          />
                        </div>

                        <div>
                          <Label htmlFor="document-content-type">Tipo di Contenuto *</Label>
                          <Select
                            value={documentForm.contentType}
                            onValueChange={(value: "text" | "video" | "both") =>
                              setDocumentForm({ ...documentForm, contentType: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">
                                <div className="flex items-center gap-2">
                                  <FileText size={16} />
                                  📄 Solo Testo
                                </div>
                              </SelectItem>
                              <SelectItem value="video">
                                <div className="flex items-center gap-2">
                                  <Video size={16} />
                                  🎥 Solo Video
                                </div>
                              </SelectItem>
                              <SelectItem value="both">
                                <div className="flex items-center gap-2">
                                  <Sparkles size={16} />
                                  📚 Testo + Video
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {(documentForm.contentType === "video" || documentForm.contentType === "both") && (
                          <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                            <Label htmlFor="document-video-url">Link Video *</Label>
                            <Input
                              id="document-video-url"
                              value={documentForm.videoUrl}
                              onChange={(e) => setDocumentForm({ ...documentForm, videoUrl: e.target.value })}
                              placeholder="https://www.youtube.com/watch?v=... o https://vimeo.com/... o link Wistia"
                              className="mt-2"
                            />
                            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                              <strong>Piattaforme supportate:</strong> YouTube, Vimeo, Wistia
                            </p>
                            <div className="mt-3 text-xs text-red-700 dark:text-red-300">
                              <p><strong>Esempi di link validi:</strong></p>
                              <ul className="list-disc list-inside mt-1 space-y-1">
                                <li>YouTube: https://www.youtube.com/watch?v=dQw4w9WgXcQ</li>
                                <li>Vimeo: https://vimeo.com/123456789</li>
                                <li>Wistia: https://company.wistia.com/medias/abcd1234</li>
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* Content Creation */}
                    {(documentForm.contentType === "text" || documentForm.contentType === "both") && (
                      <Card className="p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <FileText size={18} />
                          Editor Contenuto Lezione {documentForm.contentType === "both" ? "(Testo + Video)" : "di Testo"}
                        </h3>
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label htmlFor="document-content">Contenuto Principale</Label>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock size={14} />
                              {documentForm.content ? Math.ceil(documentForm.content.replace(/<[^>]*>/g, '').length / 200) : 0} min lettura
                            </div>
                          </div>

                          {/* Advanced Rich Text Editor Toolbar */}
                          <div className="border border-input rounded-t-md bg-muted/20 p-3 flex flex-wrap gap-2 shadow-sm">
                            <div className="flex items-center gap-1 border-r border-border pr-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  document.execCommand('bold', false);
                                  const editor = document.querySelector('[contenteditable="true"]');
                                  if (editor) editor.focus();
                                  setTimeout(updateToolbarState, 10);
                                }}
                                className="h-8 px-2 hover:bg-primary/10 transition-all duration-200 border border-transparent"
                                data-format="bold"
                                title="Grassetto (Ctrl+B)"
                              >
                                <strong className="text-sm">B</strong>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  document.execCommand('italic', false);
                                  const editor = document.querySelector('[contenteditable="true"]');
                                  if (editor) editor.focus();
                                  setTimeout(updateToolbarState, 10);
                                }}
                                className="h-8 px-2 hover:bg-primary/10 transition-all duration-200 border border-transparent"
                                data-format="italic"
                                title="Corsivo (Ctrl+I)"
                              >
                                <em className="text-sm">I</em>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  document.execCommand('underline', false);
                                  const editor = document.querySelector('[contenteditable="true"]');
                                  if (editor) editor.focus();
                                  setTimeout(updateToolbarState, 10);
                                }}
                                className="h-8 px-2 hover:bg-primary/10 transition-all duration-200 border border-transparent"
                                data-format="underline"
                                title="Sottolineato (Ctrl+U)"
                              >
                                <u className="text-sm">U</u>
                              </Button>
                            </div>

                            <div className="flex items-center gap-1 border-r border-border pr-2">
                              <select
                                onChange={(e) => {
                                  if (e.target.value) {
                                    document.execCommand('formatBlock', false, e.target.value);
                                    const editor = document.querySelector('[contenteditable="true"]');
                                    if (editor) editor.focus();
                                  }
                                }}
                                className="h-8 px-2 text-xs bg-background border border-input rounded hover:bg-accent"
                                defaultValue=""
                              >
                                <option value="">Normale</option>
                                <option value="h1">Titolo 1</option>
                                <option value="h2">Titolo 2</option>
                                <option value="h3">Titolo 3</option>
                                <option value="p">Paragrafo</option>
                              </select>
                            </div>

                            <div className="flex items-center gap-1 border-r border-border pr-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  document.execCommand('insertUnorderedList', false);
                                  const editor = document.querySelector('[contenteditable="true"]');
                                  if (editor) editor.focus();
                                }}
                                className="h-8 px-2 text-xs hover:bg-primary/10"
                                title="Lista puntata"
                              >
                                •
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  document.execCommand('insertOrderedList', false);
                                  const editor = document.querySelector('[contenteditable="true"]');
                                  if (editor) editor.focus();
                                }}
                                className="h-8 px-2 text-xs hover:bg-primary/10"
                                title="Lista numerata"
                              >
                                1.
                              </Button>
                            </div>

                            <div className="flex items-center gap-1 border-r border-border pr-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  document.execCommand('justifyLeft', false);
                                  const editor = document.querySelector('[contenteditable="true"]');
                                  if (editor) editor.focus();
                                }}
                                className="h-8 px-2 text-xs hover:bg-primary/10"
                                title="Allinea a sinistra"
                              >
                                ⬅
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  document.execCommand('justifyCenter', false);
                                  const editor = document.querySelector('[contenteditable="true"]');
                                  if (editor) editor.focus();
                                }}
                                className="h-8 px-2 text-xs hover:bg-primary/10"
                                title="Centra"
                              >
                                ⬌
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  document.execCommand('justifyRight', false);
                                  const editor = document.querySelector('[contenteditable="true"]');
                                  if (editor) editor.focus();
                                }}
                                className="h-8 px-2 text-xs hover:bg-primary/10"
                                title="Allinea a destra"
                              >
                                ➡
                              </Button>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  document.execCommand('createLink', false, prompt('Inserisci URL:') || '');
                                  const editor = document.querySelector('[contenteditable="true"]');
                                  if (editor) editor.focus();
                                }}
                                className="h-8 px-2 text-xs hover:bg-primary/10"
                                title="Inserisci link"
                              >
                                🔗
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  document.execCommand('removeFormat', false);
                                  const editor = document.querySelector('[contenteditable="true"]');
                                  if (editor) editor.focus();
                                }}
                                className="h-8 px-2 text-xs hover:bg-destructive/10 text-destructive"
                                title="Rimuovi formattazione"
                              >
                                🧹
                              </Button>
                            </div>
                          </div>

                          {/* Advanced Rich Text Editor */}
                          <div
                            contentEditable
                            className="min-h-[400px] w-full border border-input border-t-0 rounded-b-md bg-background p-6 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 prose prose-sm max-w-none leading-relaxed"
                            style={{
                              minHeight: '400px',
                              maxHeight: '600px',
                              overflowY: 'auto',
                              lineHeight: '1.8',
                              fontFamily: 'system-ui, -apple-system, sans-serif'
                            }}
                            dangerouslySetInnerHTML={{ __html: documentForm.content || '' }}
                            onInput={(e) => {
                              const target = e.currentTarget;
                              if (!target) return;

                              const content = target.innerHTML;
                              // Pulizia più sofisticata che preserva la formattazione
                              const cleanContent = content
                                // Normalizza i div di Chrome/Firefox in paragrafi
                                .replace(/<div><br><\/div>/g, '<br>')
                                .replace(/<div>/g, '<p>')
                                .replace(/<\/div>/g, '</p>')
                                // Rimuovi paragrafi vuoti consecutivi
                                .replace(/<p>\s*<\/p>/g, '')
                                // Normalizza i br multipli
                                .replace(/(<br\s*\/?>){3,}/gi, '<br><br>')
                                // Pulisci span vuoti
                                .replace(/<span>\s*<\/span>/g, '')
                                .trim();

                              setDocumentForm({ ...documentForm, content: cleanContent });

                              // Aggiorna lo stato dei bottoni della toolbar
                              updateToolbarState();
                            }}
                            onSelectionChange={() => {
                              // Aggiorna lo stato quando cambia la selezione
                              setTimeout(updateToolbarState, 10);
                            }}
                            onMouseUp={() => {
                              // Aggiorna lo stato quando si clicca
                              setTimeout(updateToolbarState, 10);
                            }}
                            onKeyUp={() => {
                              // Aggiorna lo stato quando si usano le frecce o si digita
                              setTimeout(updateToolbarState, 10);
                            }}
                            onKeyDown={(e) => {
                              // Scorciatoie da tastiera per formattazione
                              if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
                                switch (e.key.toLowerCase()) {
                                  case 'b':
                                    e.preventDefault();
                                    document.execCommand('bold', false);
                                    setTimeout(updateToolbarState, 10);
                                    return;
                                  case 'i':
                                    e.preventDefault();
                                    document.execCommand('italic', false);
                                    setTimeout(updateToolbarState, 10);
                                    return;
                                  case 'u':
                                    e.preventDefault();
                                    document.execCommand('underline', false);
                                    setTimeout(updateToolbarState, 10);
                                    return;
                                }
                              }

                              // Gestione naturale dell'Enter
                              if (e.key === 'Enter') {
                                if (e.shiftKey) {
                                  // Shift+Enter = line break
                                  e.preventDefault();
                                  document.execCommand('insertHTML', false, '<br>');
                                } else {
                                  // Enter normale = nuovo paragrafo
                                  e.preventDefault();
                                  document.execCommand('insertHTML', false, '<div><br></div>');
                                }
                                return;
                              }

                              // Gestione del Tab per indentazione
                              if (e.key === 'Tab') {
                                e.preventDefault();
                                if (e.shiftKey) {
                                  document.execCommand('outdent', false);
                                } else {
                                  document.execCommand('indent', false);
                                }
                              }
                            }}
                            onPaste={(e) => {
                              e.preventDefault();

                              // Prova a ottenere HTML formattato
                              const htmlData = e.clipboardData?.getData('text/html');
                              const textData = e.clipboardData?.getData('text/plain');

                              // Funzione helper per bilanciare i tag
                              const balanceTags = (html: string): string => {
                                // Conta e bilancia i tag strong
                                const strongOpens = (html.match(/<strong>/gi) || []).length;
                                const strongCloses = (html.match(/<\/strong>/gi) || []).length;
                                
                                if (strongOpens > strongCloses) {
                                  // Aggiungi tag di chiusura mancanti
                                  html += '</strong>'.repeat(strongOpens - strongCloses);
                                } else if (strongCloses > strongOpens) {
                                  // Rimuovi tag di chiusura in eccesso
                                  let count = strongCloses - strongOpens;
                                  html = html.replace(/<\/strong>/gi, (match) => {
                                    if (count > 0) {
                                      count--;
                                      return '';
                                    }
                                    return match;
                                  });
                                }

                                // Conta e bilancia i tag em
                                const emOpens = (html.match(/<em>/gi) || []).length;
                                const emCloses = (html.match(/<\/em>/gi) || []).length;
                                
                                if (emOpens > emCloses) {
                                  html += '</em>'.repeat(emOpens - emCloses);
                                } else if (emCloses > emOpens) {
                                  let count = emCloses - emOpens;
                                  html = html.replace(/<\/em>/gi, (match) => {
                                    if (count > 0) {
                                      count--;
                                      return '';
                                    }
                                    return match;
                                  });
                                }

                                // Conta e bilancia i tag u
                                const uOpens = (html.match(/<u>/gi) || []).length;
                                const uCloses = (html.match(/<\/u>/gi) || []).length;
                                
                                if (uOpens > uCloses) {
                                  html += '</u>'.repeat(uOpens - uCloses);
                                } else if (uCloses > uOpens) {
                                  let count = uCloses - uOpens;
                                  html = html.replace(/<\/u>/gi, (match) => {
                                    if (count > 0) {
                                      count--;
                                      return '';
                                    }
                                    return match;
                                  });
                                }

                                return html;
                              };

                              if (htmlData && htmlData.trim()) {
                                // Verifica se l'HTML contiene effettivamente formattazione significativa
                                const hasFormattingTags = /<(strong|b|em|i|u|h[1-6]|ul|ol|li)[\s>]/i.test(htmlData);

                                if (hasFormattingTags) {
                                  // Pulizia avanzata per preservare solo formattazione intenzionale
                                  let cleanHTML = htmlData
                                    // Rimuovi script e stili pericolosi
                                    .replace(/<script[^>]*>.*?<\/script>/gi, '')
                                    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
                                    // Rimuovi tutti gli attributi di stile inline e class
                                    .replace(/\s*style="[^"]*"/gi, '')
                                    .replace(/\s*class="[^"]*"/gi, '')
                                    // Rimuovi span senza attributi significativi
                                    .replace(/<span[^>]*>/gi, '')
                                    .replace(/<\/span>/gi, '')
                                    // Rimuovi font tag
                                    .replace(/<font[^>]*>/gi, '')
                                    .replace(/<\/font>/gi, '')
                                    // Normalizza spazi e caratteri speciali
                                    .replace(/&nbsp;/g, ' ')
                                    .replace(/&amp;/g, '&')
                                    .replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>')
                                    // Sostituisci div con paragrafi
                                    .replace(/<div[^>]*>/gi, '<p>')
                                    .replace(/<\/div>/gi, '</p>')
                                    // Pulisci tag meta e office specifici
                                    .replace(/<meta[^>]*>/gi, '')
                                    .replace(/<o:[^>]*>/gi, '')
                                    .replace(/<\/o:[^>]*>/gi, '')
                                    // Pulisci paragrafi vuoti
                                    .replace(/<p[^>]*>\s*<\/p>/gi, '')
                                    .replace(/(<br\s*\/?>){3,}/gi, '<br><br>')
                                    // Normalizza i titoli
                                    .replace(/<h([1-6])[^>]*>/gi, '<h$1>')
                                    // Assicurati che i tag di formattazione base siano corretti
                                    .replace(/<(\/?)b[^>]*>/gi, '<$1strong>')
                                    .replace(/<(\/?)i[^>]*>/gi, '<$1em>');

                                  // Dividi in paragrafi per gestire meglio la formattazione
                                  const paragraphs = cleanHTML.split(/<\/p>/gi);
                                  const processedParagraphs = paragraphs
                                    .map(p => p.replace(/<p[^>]*>/gi, '').trim())
                                    .filter(p => p.length > 0)
                                    .map(p => {
                                      // Bilancia i tag in ogni paragrafo
                                      p = balanceTags(p);
                                      return `<p>${p}</p>`;
                                    });

                                  const finalHTML = processedParagraphs.join('');
                                  document.execCommand('insertHTML', false, finalHTML);
                                } else {
                                  // Se l'HTML non contiene formattazione significativa, trattalo come testo normale
                                  const plainText = htmlData.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
                                  const paragraphs = plainText.split(/\n\s*\n/);
                                  const htmlContent = paragraphs
                                    .map(p => p.trim())
                                    .filter(p => p.length > 0)
                                    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
                                    .join('');

                                  document.execCommand('insertHTML', false, htmlContent);
                                }
                              } else if (textData) {
                                // Se è solo testo, mantieni i paragrafi senza formattazione
                                const paragraphs = textData.split(/\n\s*\n/);
                                const htmlContent = paragraphs
                                  .map(p => p.trim())
                                  .filter(p => p.length > 0)
                                  .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
                                  .join('');

                                document.execCommand('insertHTML', false, htmlContent);
                              }

                              // Forza l'aggiornamento del contenuto dopo l'incollaggio
                              setTimeout(() => {
                                const target = e.currentTarget;
                                if (target) {
                                  let content = target.innerHTML;

                                  // Pulizia finale: bilancia tutti i tag rimasti
                                  content = balanceTags(content);

                                  // Rimuovi tag vuoti
                                  content = content
                                    .replace(/<strong>\s*<\/strong>/gi, '')
                                    .replace(/<em>\s*<\/em>/gi, '')
                                    .replace(/<u>\s*<\/u>/gi, '')
                                    // Normalizza spazi multipli
                                    .replace(/\s+/g, ' ')
                                    .trim();

                                  setDocumentForm({ ...documentForm, content: content });
                                }
                              }, 100);
                            }}
                            data-placeholder="Inizia a scrivere il tuo contenuto qui...
• Incolla testo formattato da qualsiasi fonte (Word, Gemini, etc.)
• Usa Enter per nuovi paragrafi, Shift+Enter per andare a capo
• Seleziona il testo per applicare la formattazione"
                            suppressContentEditableWarning={true}
                          />

                          {/* Help Text */}
                          <div className="mt-2 text-xs text-muted-foreground">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <strong>Formattazione supportata:</strong>
                                <ul className="mt-1 space-y-1">
                                  <li>• <strong>Grassetto</strong>, <em>Corsivo</em>, <u>Sottolineato</u></li>
                                  <li>• Titoli H1, H2, H3</li>
                                  <li>• Liste puntate e numerate</li>
                                </ul>
                              </div>
                              <div>
                                <strong>Suggerimenti:</strong>
                                <ul className="mt-1 space-y-1">
                                  <li>• Seleziona il testo per formattarlo</li>
                                  <li>• Usa i titoli per strutturare il contenuto</li>
                                  <li>• Le liste migliorano la leggibilità</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                    )}

                    {/* Video Preview Card */}
                    {(documentForm.contentType === "video" || documentForm.contentType === "both") && documentForm.videoUrl && (
                      <div>
                        <h4 className="font-medium mb-2">Video:</h4>
                        <div className="bg-background rounded-md p-4 border">
                          <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                            <Video className="text-muted-foreground" size={48} />
                          </div>
                          <p className="text-sm text-muted-foreground mt-2 break-all">{documentForm.videoUrl}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Advanced Settings */}
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Settings size={18} />
                      Impostazioni Avanzate Lezione
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="document-duration">Durata Stimata (minuti)</Label>
                        <Input
                          id="document-duration"
                          type="number"
                          value={documentForm.estimatedDuration}
                          onChange={(e) => setDocumentForm({ ...documentForm, estimatedDuration: e.target.value })}
                          placeholder="30"
                          min="1"
                          max="300"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Tempo necessario per completare la lettura</p>
                      </div>

                      <div>
                        <Label>Priorità Lezione</Label>
                        <Select
                          value={documentForm.sortOrder.toString()}
                          onValueChange={(value) => setDocumentForm({ ...documentForm, sortOrder: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">🔥 Priorità Alta</SelectItem>
                            <SelectItem value="50">⭐ Priorità Media</SelectItem>
                            <SelectItem value="100">📋 Priorità Normale</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Stato di Pubblicazione</Label>
                        <Select
                          value={documentForm.isPublished ? "published" : "draft"}
                          onValueChange={(value) => setDocumentForm({ ...documentForm, isPublished: value === "published" })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="published">✅ Pubblicato</SelectItem>
                            <SelectItem value="draft">📝 Bozza (non pubblicato)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                {/* Structure Tab */}
                <TabsContent value="structure" className="space-y-6 mt-0">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Tag size={18} />
                      Tag e Sotto-categorie
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <Label>Tag Personalizzati</Label>
                        <div className="flex flex-wrap gap-2 mb-3 min-h-[40px] p-2 border rounded-md">
                          {documentForm.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-sm flex items-center gap-1">
                              <Tag size={12} />
                              {tag}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="ml-1 h-auto p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => removeTag(tag)}
                              >
                                ×
                              </Button>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex space-x-2">
                          <Input
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addTag()}
                            placeholder="Aggiungi tag (es. investimenti, principianti, immobiliare)"
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={addTag}
                            disabled={!newTag.trim()}
                          >
                            <Plus size={16} />
                          </Button>
                        </div>

                        {/* Tag Suggestions */}
                        <div className="mt-3">
                          <p className="text-sm text-muted-foreground mb-2">Tag Suggeriti:</p>
                          <div className="flex flex-wrap gap-2">
                            {["investimenti", "finanza-personale", "imprenditoria", "risparmio", "budget", "strategie", "principianti", "avanzato"].map((suggestedTag) => (
                              <Button
                                key={suggestedTag}
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (!documentForm.tags.includes(suggestedTag)) {
                                    setDocumentForm({
                                      ...documentForm,
                                      tags: [...documentForm.tags, suggestedTag]
                                    });
                                  }
                                }}
                                className="text-xs"
                                disabled={documentForm.tags.includes(suggestedTag)}
                              >
                                {suggestedTag}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                {/* Media Tab */}
                <TabsContent value="media" className="space-y-6 mt-0">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText size={18} />
                      Allegati e Risorse Lezione
                    </h3>
                    <div className="space-y-4">
                      {/* File Upload Area */}
                      <div
                        className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/40 transition-colors cursor-pointer"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.add('border-primary', 'bg-primary/5');
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                          const files = Array.from(e.dataTransfer.files);
                          if (files.length > 0) {
                            setDocumentForm({ ...documentForm, attachments: [...(documentForm.attachments || []), ...files] });
                          }
                        }}
                      >
                        <div className="mx-auto w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-4">
                          <Plus size={24} className="text-muted-foreground" />
                        </div>
                        <h4 className="text-lg font-medium mb-2">Aggiungi Allegati</h4>
                        <p className="text-muted-foreground mb-4">
                          Carica PDF, immagini, fogli di calcolo o altri documenti di supporto
                        </p>
                        <Button variant="outline" type="button">
                          Seleziona File
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                          o trascina i file qui
                        </p>
                      </div>

                      {/* Hidden File Input */}
                      <input
                        id="file-upload"
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.txt,.rtf,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.bmp,.webp,.mp4,.mov,.avi,.mp3,.wav"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length > 0) {
                            setDocumentForm({ ...documentForm, attachments: [...(documentForm.attachments || []), ...files] });
                          }
                          e.target.value = ''; // Reset input
                        }}
                        className="hidden"
                      />

                      {/* Existing Attachments (when editing) */}
                      {editingDocument && editingDocument.attachments && editingDocument.attachments.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-medium">Allegati Esistenti:</h4>
                          <div className="grid gap-2">
                            {editingDocument.attachments.map((attachment, index) => {
                              const getFileName = (att: any) => {
                                if (typeof att === 'object' && att.originalName) {
                                  return att.originalName;
                                }
                                if (typeof att === 'string' && att.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\..+$/i)) {
                                  const extension = att.split('.').pop();
                                  return `Documento.${extension}`;
                                }
                                return typeof att === 'string' ? att : 'File sconosciuto';
                              };

                              const getFileIcon = (att: any) => {
                                const filename = getFileName(att).toLowerCase();
                                if (filename.includes('.pdf')) return '📄';
                                if (filename.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) return '🖼️';
                                if (filename.match(/\.(mp4|mov|avi|mkv|webm)$/)) return '🎥';
                                if (filename.match(/\.(mp3|wav|ogg)$/)) return '🎵';
                                return '📋';
                              };

                              return (
                                <div key={index} className="flex items-center justify-between p-3 bg-blue-50/50 rounded-lg border border-blue-200">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-sm">
                                      {getFileIcon(attachment)}
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">{getFileName(attachment)}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Allegato esistente
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const link = document.createElement('a');
                                        const filename = typeof attachment === 'object' ? attachment.filename : attachment;
                                        link.href = `/uploads/${filename}`;
                                        link.download = getFileName(attachment);
                                        link.target = '_blank';
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                      }}
                                      className="text-blue-600 hover:text-blue-700"
                                      title="Scarica file"
                                    >
                                      <FileText size={14} />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (editingDocument) {
                                          // Remove the attachment from the existing attachments array
                                          const updatedAttachments = [...editingDocument.attachments];
                                          updatedAttachments.splice(index, 1);

                                          // Update the editing document state preserving all other properties
                                          setEditingDocument({
                                            ...editingDocument,
                                            attachments: updatedAttachments
                                          });

                                          toast({
                                            title: "Allegato rimosso",
                                            description: "L'allegato verrà rimosso al salvataggio della lezione",
                                          });
                                        }
                                      }}
                                      className="text-destructive hover:text-destructive"
                                      title="Rimuovi allegato"
                                    >
                                      <Trash2 size={14} />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Selected Files List */}
                      {documentForm.attachments && documentForm.attachments.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-medium">Nuovi File Selezionati:</h4>
                          <div className="grid gap-2">
                            {documentForm.attachments.map((file, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg border border-green-200">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                                    {file.type.startsWith('image/') ? '🖼️' :
                                     file.type.includes('pdf') ? '📄' :
                                     file.type.includes('video') ? '🎥' :
                                     file.type.includes('audio') ? '🎵' : '📋'}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newAttachments = [...(documentForm.attachments || [])];
                                    newAttachments.splice(index, 1);
                                    setDocumentForm({ ...documentForm, attachments: newAttachments });
                                  }}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">Tipi di File Supportati:</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• PDF - Guides and documents</li>
                            <li>• Images - Charts and infographics</li>
                            <li>• Excel/CSV - Spreadsheets</li>
                            <li>• Video - Multimedia content</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">Maximum Size:</h4>
                          <p className="text-sm text-muted-foreground">50MB per file</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </TabsContent>

                {/* Preview Tab */}
                <TabsContent value="preview" className="space-y-6 mt-0">
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Eye size={18} />
                      Anteprima Lezione
                    </h3>
                    <div className="bg-gradient-to-br from-muted/50 to-muted/20 rounded-lg p-6 border">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge className={getLevelBadgeColor(documentForm.level)}>
                                {documentForm.level}
                              </Badge>
                              {documentForm.estimatedDuration && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Clock size={12} />
                                  {documentForm.estimatedDuration} min
                                </Badge>
                              )}
                            </div>
                            <h2 className="text-xl font-bold">
                              {documentForm.title || "Titolo della lezione"}
                            </h2>
                            {documentForm.subtitle && (
                              <p className="text-muted-foreground">{documentForm.subtitle}</p>
                            )}
                          </div>
                        </div>

                        {documentForm.description && (
                          <div>
                            <h4 className="font-medium mb-2">Descrizione:</h4>
                            <p className="text-muted-foreground">{documentForm.description}</p>
                          </div>
                        )}

                        <div>
                          <h4 className="font-medium mb-2">Tipo di Contenuto:</h4>
                          <div className="flex items-center gap-2 mb-4">
                            <Badge
                              variant="outline"
                              className={`flex items-center gap-2 ${
                                documentForm.contentType === 'video'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : documentForm.contentType === 'both'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}
                            >
                              {documentForm.contentType === 'video' ? (
                                <>
                                  <Video size={16} />
                                  Lezione Video
                                </>
                              ) : documentForm.contentType === 'both' ? (
                                <>
                                  <Sparkles size={16} />
                                  Lezione Testo + Video
                                </>
                              ) : (
                                <>
                                  <FileText size={16} />
                                  Lezione di Testo
                                </>
                              )}
                            </Badge>
                          </div>
                        </div>

                        {(documentForm.contentType === "video" || documentForm.contentType === "both") && documentForm.videoUrl && (
                          <div>
                            <h4 className="font-medium mb-2">Video:</h4>
                            <div className="bg-background rounded-md p-4 border">
                              <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                                <Video className="text-muted-foreground" size={48} />
                              </div>
                              <p className="text-sm text-muted-foreground mt-2 break-all">{documentForm.videoUrl}</p>
                            </div>
                          </div>
                        )}

                        {documentForm.content && documentForm.contentType !== "video" && (
                          <div>
                            <h4 className="font-medium mb-2">Contenuto:</h4>
                            <div className="bg-background rounded-md p-4 max-h-60 overflow-y-auto prose prose-sm max-w-none">
                              <div
                                dangerouslySetInnerHTML={{ __html: documentForm.content }}
                                className="text-sm leading-relaxed"
                              />
                            </div>
                          </div>
                        )}

                        {documentForm.tags.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Tags:</h4>
                            <div className="flex flex-wrap gap-1">
                              {documentForm.tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {((editingDocument && editingDocument.attachments && editingDocument.attachments.length > 0) ||
                          (documentForm.attachments && documentForm.attachments.length > 0)) && (
                          <div>
                            <h4 className="font-medium mb-2">
                              Allegati ({(editingDocument?.attachments?.length || 0) + (documentForm.attachments?.length || 0)}):
                            </h4>
                            <div className="space-y-2">
                              {/* Existing attachments */}
                              {editingDocument && editingDocument.attachments && editingDocument.attachments.map((attachment, index) => {
                                const getFileName = (att: any) => {
                                  if (typeof att === 'object' && att.originalName) {
                                    return att.originalName;
                                  }
                                  if (typeof att === 'string' && att.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\..+$/i)) {
                                    const extension = att.split('.').pop();
                                    return `Documento.${extension}`;
                                  }
                                  return typeof att === 'string' ? att : 'File sconosciuto';
                                };

                                const getFileIcon = (att: any) => {
                                  const filename = getFileName(att).toLowerCase();
                                  if (filename.includes('.pdf')) return '📄';
                                  if (filename.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) return '🖼️';
                                  if (filename.match(/\.(mp4|mov|avi|mkv|webm)$/)) return '🎥';
                                  if (filename.match(/\.(mp3|wav|ogg)$/)) return '🎵';
                                  return '📋';
                                };

                                return (
                                  <div key={`existing-${index}`} className="flex items-center gap-2 text-sm bg-blue-50/50 rounded p-2 border border-blue-200">
                                    <div className="w-4 h-4 text-xs">
                                      {getFileIcon(attachment)}
                                    </div>
                                    <span className="flex-1">{getFileName(attachment)}</span>
                                    <span className="text-xs text-blue-600">
                                      Esistente
                                    </span>
                                  </div>
                                );
                              })}

                              {/* New attachments */}
                              {documentForm.attachments && documentForm.attachments.map((file, index) => (
                                <div key={`new-${index}`} className="flex items-center gap-2 text-sm bg-green-50/50 rounded p-2 border border-green-200">
                                  <div className="w-4 h-4 text-xs">
                                    {file.type.startsWith('image/') ? '🖼️' :
                                     file.type.includes('pdf') ? '📄' :
                                     file.type.includes('video') ? '🎥' :
                                     file.type.includes('audio') ? '🎵' : '📋'}
                                  </div>
                                  <span className="flex-1">{file.name}</span>
                                  <span className="text-xs text-green-600">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB - Nuovo
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
          </div>

          <DialogFooter className="border-t pt-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 text-sm text-muted-foreground">
              💡 Suggerimento: Usa l'anteprima per verificare come apparirà la lezione ai tuoi clienti
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowDocumentDialog(false)}>
                Annulla
              </Button>
              <Button
                onClick={handleCreateDocument}
                disabled={!documentForm.title.trim() || !documentForm.categoryId}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                <Sparkles size={16} className="mr-2" />
                {editingDocument ? "Aggiorna Lezione" : "Crea Lezione"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Course Assignment Dialog */}
      <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              Assegna Corso ai Clienti
            </DialogTitle>
            <DialogDescription>
              Seleziona i clienti che potranno accedere al corso "{assigningCategory?.name}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div>
              <Label className="text-base font-medium mb-4 block">Clienti disponibili</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                {clients.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nessun cliente disponibile
                  </p>
                ) : (
                  clients.map((client: any) => {
                    const isAssigned = categoryAssignments.some((assignment: any) => assignment.clientId === client.id);
                    const isSelected = selectedClients.includes(client.id);

                    return (
                      <div
                        key={client.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800'
                            : 'bg-white border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {client.firstName?.[0]}{client.lastName?.[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {client.firstName} {client.lastName}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {client.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {isAssigned && (
                            <Badge variant="secondary" className="text-xs">
                              Attualmente assegnato
                            </Badge>
                          )}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedClients([...selectedClients, client.id]);
                              } else {
                                setSelectedClients(selectedClients.filter(id => id !== client.id));
                              }
                            }}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-800 dark:border-gray-600"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                📋 Riepilogo assegnazione
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {selectedClients.length === 0
                  ? "Nessun cliente selezionato. Il corso non sarà visibile a nessuno."
                  : `Il corso "${assigningCategory?.name}" sarà visibile a ${selectedClients.length} client${selectedClients.length === 1 ? 'e' : 'i'}.`
                }
              </p>
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignmentDialog(false);
                setAssigningCategory(undefined);
                setSelectedClients([]);
              }}
              disabled={assignCategoryMutation.isPending}
            >
              Annulla
            </Button>
            <Button
              onClick={handleSaveAssignment}
              disabled={assignCategoryMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {assignCategoryMutation.isPending ? "Salvataggio..." : "Salva Assegnazioni"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4-Level Delete Confirmation Dialog */}
      <Dialog open={deleteStep > 0} onOpenChange={(open) => !open && cancelDeleteProcess()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={20} />
              {deleteStep === 1 && "Conferma Eliminazione"}
              {deleteStep === 2 && "Sei Assolutamente Sicuro?"}
              {deleteStep === 3 && "Ultimo Avvertimento!"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            {deleteStep === 1 && (
              <p className="text-muted-foreground">
                Stai per eliminare questo corso. Sei sicuro di voler procedere?
              </p>
            )}
            {deleteStep === 2 && (
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  Questa azione è <strong className="text-destructive">IRREVERSIBILE</strong>.
                </p>
                <p className="text-muted-foreground">
                  Tutte le lezioni e i moduli associati verranno eliminati permanentemente.
                </p>
              </div>
            )}
            {deleteStep === 3 && (
              <div className="space-y-4">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                    ATTENZIONE: Stai per eliminare DEFINITIVAMENTE questo corso con tutte le sue lezioni e moduli!
                  </p>
                </div>
                <div>
                  <Label htmlFor="delete-confirm">Scrivi <strong className="text-destructive">CANCELLA</strong> per confermare:</Label>
                  <Input
                    id="delete-confirm"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Scrivi CANCELLA"
                    className="mt-2"
                  />
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelDeleteProcess}>
              Annulla
            </Button>
            {deleteStep < 3 ? (
              <Button variant="destructive" onClick={proceedDeleteStep}>
                {deleteStep === 1 ? "Sì, continua" : "Confermo, continua"}
              </Button>
            ) : (
              <Button 
                variant="destructive" 
                onClick={confirmFinalDelete}
                disabled={deleteConfirmText.toUpperCase() !== "CANCELLA"}
              >
                Elimina Definitivamente
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document Dialog */}
      <AlertDialog open={!!deletingDocument} onOpenChange={() => setDeletingDocument(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione Lezione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questa lezione? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDocument && deleteDocumentMutation.mutate(deletingDocument)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subcategory Dialog */}
      <Dialog open={showSubcategoryDialog} onOpenChange={setShowSubcategoryDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSubcategory ? "Modifica Categoria" : "Nuova Categoria"}
            </DialogTitle>
            <DialogDescription>
              Crea una nuova categoria per organizzare le lezioni all'interno del corso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="subcategory-course">Corso di Appartenenza</Label>
              <Select
                value={subcategoryForm.categoryId}
                onValueChange={(value) => setSubcategoryForm({ ...subcategoryForm, categoryId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona corso" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category: LibraryCategory) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="subcategory-name">Nome Categoria</Label>
              <Input
                id="subcategory-name"
                value={subcategoryForm.name}
                onChange={(e) => setSubcategoryForm({ ...subcategoryForm, name: e.target.value })}
                placeholder="Nome della categoria"
              />
            </div>
            <div>
              <Label htmlFor="subcategory-description">Descrizione Categoria</Label>
              <Textarea
                id="subcategory-description"
                value={subcategoryForm.description}
                onChange={(e) => setSubcategoryForm({ ...subcategoryForm, description: e.target.value })}
                placeholder="Descrizione della categoria"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="subcategory-icon">Icona Categoria</Label>
                <Select
                  value={subcategoryForm.icon}
                  onValueChange={(value) => setSubcategoryForm({ ...subcategoryForm, icon: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Folder">📁 Cartella</SelectItem>
                    <SelectItem value="FileText">📄 Documento</SelectItem>
                    <SelectItem value="BookOpen">📖 Libro</SelectItem>
                    <SelectItem value="Users">👥 Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="subcategory-color">Colore Categoria</Label>
                <Select
                  value={subcategoryForm.color}
                  onValueChange={(value) => setSubcategoryForm({ ...subcategoryForm, color: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gray">⚪ Grigio</SelectItem>
                    <SelectItem value="blue">🔵 Blu</SelectItem>
                    <SelectItem value="green">🟢 Verde</SelectItem>
                    <SelectItem value="purple">🟣 Viola</SelectItem>
                    <SelectItem value="red">🔴 Rosso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubcategoryDialog(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleCreateSubcategory}
              disabled={!subcategoryForm.name.trim() || !subcategoryForm.categoryId.trim()}
            >
              {editingSubcategory ? "Aggiorna" : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Subcategory Dialog */}
      <AlertDialog open={!!deletingSubcategory} onOpenChange={() => setDeletingSubcategory(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina Categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questa categoria? Questa azione non può essere annullata.
              Tutte le lezioni in questa categoria dovranno essere eliminate prima.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSubcategory && deleteSubcategoryMutation.mutate(deletingSubcategory)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ConsultantAIAssistant />
    </div>
  );
}