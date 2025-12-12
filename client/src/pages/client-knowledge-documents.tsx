import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Upload,
  Trash2,
  Edit3,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Database,
  Calendar,
  Eye,
  Tag,
  BarChart3,
  X,
  Sparkles,
  Star,
  MessageCircle,
  Cloud,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Table2,
  Rows3,
  Columns3,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import GoogleDriveBrowser from "@/components/google-drive/GoogleDriveBrowser";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { openAIAndAskAboutDocument } from "@/hooks/use-document-focus";

type DocumentCategory = "white_paper" | "case_study" | "manual" | "normative" | "research" | "article" | "other";
type DocumentStatus = "uploading" | "processing" | "indexed" | "error";
type FileType = "pdf" | "docx" | "txt" | "md" | "rtf" | "odt" | "csv" | "xlsx" | "xls" | "pptx" | "mp3" | "wav" | "m4a" | "ogg" | "webm_audio";

interface StructuredSheet {
  name: string;
  headers: string[];
  rows: any[][];
  rowCount: number;
  columnCount: number;
}

interface StructuredTableData {
  sheets: StructuredSheet[];
  totalRows: number;
  totalColumns: number;
  fileType: 'csv' | 'xlsx' | 'xls';
}

interface KnowledgeDocument {
  id: string;
  clientId: string;
  title: string;
  description: string | null;
  category: DocumentCategory;
  fileName: string;
  fileType: FileType;
  fileSize: number;
  filePath: string;
  extractedContent: string | null;
  contentSummary: string | null;
  summaryEnabled: boolean;
  keywords: string[] | null;
  tags: string[] | null;
  structuredData: StructuredTableData | null;
  version: number;
  priority: number;
  status: DocumentStatus;
  errorMessage: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeStats {
  documents: {
    total: number;
    indexed: number;
    processing: number;
    error: number;
    totalUsage: number;
    byCategory: Record<string, number>;
    mostUsed: Array<{ id: string; title: string; category: string; usageCount: number; lastUsedAt: string | null }>;
  };
  apis: {
    total: number;
    active: number;
    totalUsage: number;
    mostUsed: Array<{ id: string; name: string; category: string; usageCount: number; lastUsedAt: string | null }>;
  };
  totalKnowledgeItems: number;
  totalUsage: number;
}

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  white_paper: "White Paper",
  case_study: "Case Study",
  manual: "Manuale",
  normative: "Normativa",
  research: "Ricerca",
  article: "Articolo",
  other: "Altro",
};

const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  white_paper: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  case_study: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  manual: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  normative: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  research: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  article: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

const STATUS_CONFIG: Record<DocumentStatus, { icon: React.ComponentType<any>; label: string; color: string }> = {
  uploading: { icon: Loader2, label: "Caricamento...", color: "text-blue-500" },
  processing: { icon: Clock, label: "Elaborazione...", color: "text-amber-500" },
  indexed: { icon: CheckCircle2, label: "Indicizzato", color: "text-green-500" },
  error: { icon: AlertCircle, label: "Errore", color: "text-red-500" },
};

const FILE_TYPE_ICONS: Record<FileType, { color: string; label: string }> = {
  pdf: { color: "text-red-500", label: "PDF" },
  docx: { color: "text-blue-500", label: "DOCX" },
  txt: { color: "text-gray-500", label: "TXT" },
  md: { color: "text-purple-500", label: "Markdown" },
  rtf: { color: "text-orange-500", label: "RTF" },
  odt: { color: "text-teal-500", label: "ODT" },
  csv: { color: "text-green-500", label: "CSV" },
  xlsx: { color: "text-emerald-600", label: "Excel" },
  xls: { color: "text-emerald-600", label: "Excel" },
  pptx: { color: "text-orange-600", label: "PowerPoint" },
  mp3: { color: "text-pink-500", label: "MP3" },
  wav: { color: "text-pink-500", label: "WAV" },
  m4a: { color: "text-pink-500", label: "M4A" },
  ogg: { color: "text-pink-500", label: "OGG" },
  webm_audio: { color: "text-pink-500", label: "WebM" },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ClientKnowledgeDocuments() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDocument, setEditingDocument] = useState<KnowledgeDocument | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<KnowledgeDocument | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tablePreviewPage, setTablePreviewPage] = useState(0);
  const [tablePreviewSheet, setTablePreviewSheet] = useState(0);
  const ROWS_PER_PAGE = 50;
  const [showAskConfirmDialog, setShowAskConfirmDialog] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    category: "other" as DocumentCategory,
    priority: 5,
  });

  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    category: "other" as DocumentCategory,
    priority: 5,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documentsResponse, isLoading } = useQuery({
    queryKey: ["/api/client/knowledge/documents"],
    queryFn: async () => {
      const response = await fetch("/api/client/knowledge/documents", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    },
  });

  const documents: KnowledgeDocument[] = documentsResponse?.data || [];

  const { data: statsResponse } = useQuery({
    queryKey: ["/api/client/knowledge/stats"],
    queryFn: async () => {
      const response = await fetch("/api/client/knowledge/stats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });
  const stats: KnowledgeStats | null = statsResponse?.data || null;

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/client/knowledge/documents", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload document");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/knowledge/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/knowledge/stats"] });
      setUploadingFiles([]);
      setUploadForm({ title: "", description: "", category: "other", priority: 5 });
      toast({
        title: "Documento caricato",
        description: "Il documento è stato caricato con successo. L'elaborazione è in corso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore caricamento",
        description: error.message || "Errore durante il caricamento del documento",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/client/knowledge/documents/${id}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update document");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/knowledge/documents"] });
      setShowEditDialog(false);
      setEditingDocument(null);
      toast({
        title: "Documento aggiornato",
        description: "Le modifiche sono state salvate con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore aggiornamento",
        description: error.message || "Errore durante l'aggiornamento del documento",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/client/knowledge/documents/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete document");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/knowledge/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client/knowledge/stats"] });
      setDeletingDocumentId(null);
      toast({
        title: "Documento eliminato",
        description: "Il documento è stato eliminato con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore eliminazione",
        description: error.message || "Errore durante l'eliminazione del documento",
        variant: "destructive",
      });
    },
  });

  const toggleSummaryMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await fetch(`/api/client/knowledge/documents/${id}/toggle-summary`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to toggle summary");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/knowledge/documents"] });
      if (previewDocument && data.data) {
        setPreviewDocument(data.data);
      }
      toast({
        title: data.data?.summaryEnabled ? "Riassunto abilitato" : "Riassunto disabilitato",
        description: data.data?.summaryEnabled 
          ? "Il riassunto verrà mostrato per questo documento"
          : "Il riassunto è stato nascosto",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nel modificare il riassunto",
        variant: "destructive",
      });
    },
  });

  const updateTagsMutation = useMutation({
    mutationFn: async ({ id, tags }: { id: string; tags: string[] }) => {
      const response = await fetch(`/api/client/knowledge/documents/${id}/tags`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tags }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update tags");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/client/knowledge/documents"] });
      if (previewDocument && data.data) {
        setPreviewDocument(data.data);
      }
      toast({
        title: "Tags aggiornati",
        description: "I tags sono stati salvati con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'aggiornare i tags",
        variant: "destructive",
      });
    },
  });

  const handlePreview = async (doc: KnowledgeDocument) => {
    setTablePreviewPage(0);
    setTablePreviewSheet(0);
    try {
      const response = await fetch(`/api/client/knowledge/documents/${doc.id}/preview`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const result = await response.json();
        setPreviewDocument(result.data);
        setShowPreviewDialog(true);
      }
    } catch (error) {
      setPreviewDocument(doc);
      setShowPreviewDialog(true);
    }
  };

  const handleAddTag = () => {
    if (!previewDocument || !tagInput.trim()) return;
    const newTags = [...(previewDocument.tags || []), tagInput.trim().toLowerCase()];
    updateTagsMutation.mutate({ id: previewDocument.id, tags: newTags });
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!previewDocument) return;
    const newTags = (previewDocument.tags || []).filter(t => t !== tagToRemove);
    updateTagsMutation.mutate({ id: previewDocument.id, tags: newTags });
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter((file) => {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: "File troppo grande",
          description: `${file.name} supera il limite di 10MB`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });
    setUploadingFiles(validFiles);
    if (validFiles.length > 0) {
      setUploadForm((prev) => ({
        ...prev,
        title: validFiles[0].name.replace(/\.[^/.]+$/, ""),
      }));
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "text/plain": [".txt"],
      "text/markdown": [".md", ".markdown"],
      "text/rtf": [".rtf"],
      "application/rtf": [".rtf"],
      "application/vnd.oasis.opendocument.text": [".odt"],
      "text/csv": [".csv"],
      "application/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "application/vnd.ms-powerpoint": [".ppt"],
      "audio/mpeg": [".mp3"],
      "audio/wav": [".wav"],
      "audio/mp4": [".m4a"],
      "audio/ogg": [".ogg"],
      "audio/webm": [".webm"],
    },
    multiple: true,
  });

  const handleUpload = async () => {
    if (uploadingFiles.length === 0) return;
    
    const filesToUpload = [...uploadingFiles];
    setUploadingFiles([]);
    setUploadForm({ title: "", description: "", category: "other", priority: 5 });
    
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const title = filesToUpload.length === 1 
        ? uploadForm.title.trim() 
        : file.name.replace(/\.[^/.]+$/, "");
      
      if (!title) {
        toast({
          title: "Titolo richiesto",
          description: `Inserisci un titolo per ${file.name}`,
          variant: "destructive",
        });
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("description", uploadForm.description);
      formData.append("category", uploadForm.category);
      formData.append("priority", uploadForm.priority.toString());

      try {
        await uploadMutation.mutateAsync(formData);
      } catch (error) {
        // Error already handled by mutation onError
      }
    }
  };

  const handleEdit = (doc: KnowledgeDocument) => {
    setEditingDocument(doc);
    setEditForm({
      title: doc.title,
      description: doc.description || "",
      category: doc.category,
      priority: doc.priority,
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (!editingDocument) return;
    updateMutation.mutate({
      id: editingDocument.id,
      data: editForm,
    });
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || doc.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="mb-4 sm:mb-6 md:mb-8">
            <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl">
                      <Database className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold">
                        Base di Conoscenza - Documenti
                      </h1>
                      <p className="text-emerald-100 text-xs sm:text-sm md:text-base lg:text-lg hidden sm:block">
                        Carica e gestisci documenti per arricchire le risposte AI
                      </p>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:flex items-center space-x-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                    <div className="text-3xl font-bold">{stats?.documents?.total || 0}</div>
                    <div className="text-sm text-emerald-100">Documenti</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                    <div className="text-3xl font-bold">{stats?.documents?.indexed || 0}</div>
                    <div className="text-sm text-emerald-100">Indicizzati</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                    <div className="text-3xl font-bold">{stats?.documents?.processing || 0}</div>
                    <div className="text-sm text-emerald-100">In Elaborazione</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                    <div className="text-3xl font-bold">{stats?.documents?.error || 0}</div>
                    <div className="text-sm text-emerald-100">Errori</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 lg:hidden">
            <Card className="text-center">
              <CardContent className="p-3">
                <div className="text-2xl font-bold text-emerald-600">{stats?.documents?.total || 0}</div>
                <div className="text-xs text-gray-500">Totali</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-3">
                <div className="text-2xl font-bold text-green-600">{stats?.documents?.indexed || 0}</div>
                <div className="text-xs text-gray-500">Indicizzati</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-3">
                <div className="text-2xl font-bold text-amber-600">{stats?.documents?.processing || 0}</div>
                <div className="text-xs text-gray-500">Elaborazione</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-3">
                <div className="text-2xl font-bold text-red-600">{stats?.documents?.error || 0}</div>
                <div className="text-xs text-gray-500">Errori</div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Importa da Google Drive</CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Importa documenti direttamente dal tuo Google Drive
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
                        isSettingsOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <GoogleDriveBrowser
                    apiPrefix="/api/client"
                    onImportSuccess={(count) => {
                      queryClient.invalidateQueries({ queryKey: ["/api/client/knowledge/documents"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/client/knowledge/stats"] });
                    }}
                  />
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-1 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-emerald-400 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5 text-emerald-500" />
                  Carica Documento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDragActive
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-emerald-300"
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload
                    className={`w-10 h-10 mx-auto mb-3 ${
                      isDragActive ? "text-emerald-500" : "text-gray-400"
                    }`}
                  />
                  {isDragActive ? (
                    <p className="text-emerald-600 font-medium">Rilascia il file qui...</p>
                  ) : (
                    <>
                      <p className="text-gray-600 dark:text-gray-400 font-medium">
                        Trascina un file qui
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        oppure clicca per selezionare
                      </p>
                      <p className="text-xs text-gray-400 mt-2">PDF, DOCX, TXT, MD, CSV, XLSX, PPTX, Audio (max 10MB)</p>
                    </>
                  )}
                </div>

                {uploadingFiles.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                      <FileText className="w-5 h-5 text-emerald-500" />
                      <span className="text-sm font-medium truncate flex-1">
                        {uploadingFiles[0].name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatFileSize(uploadingFiles[0].size)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="upload-title">Titolo *</Label>
                        <Input
                          id="upload-title"
                          value={uploadForm.title}
                          onChange={(e) =>
                            setUploadForm((prev) => ({ ...prev, title: e.target.value }))
                          }
                          placeholder="Titolo del documento"
                        />
                      </div>
                      <div>
                        <Label htmlFor="upload-description">Descrizione</Label>
                        <Textarea
                          id="upload-description"
                          value={uploadForm.description}
                          onChange={(e) =>
                            setUploadForm((prev) => ({ ...prev, description: e.target.value }))
                          }
                          placeholder="Descrizione opzionale"
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="upload-category">Categoria</Label>
                        <Select
                          value={uploadForm.category}
                          onValueChange={(value: DocumentCategory) =>
                            setUploadForm((prev) => ({ ...prev, category: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Priorità: {uploadForm.priority}</Label>
                        <Slider
                          value={[uploadForm.priority]}
                          onValueChange={([value]) =>
                            setUploadForm((prev) => ({ ...prev, priority: value }))
                          }
                          min={1}
                          max={10}
                          step={1}
                          className="mt-2"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleUpload}
                          disabled={uploadMutation.isPending}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                        >
                          {uploadMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Caricamento...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Carica
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setUploadingFiles([]);
                            setUploadForm({ title: "", description: "", category: "other", priority: 5 });
                          }}
                        >
                          Annulla
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-500" />
                    I tuoi Documenti
                  </span>
                  <Badge variant="secondary">{filteredDocuments.length} documenti</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Cerca documenti..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte</SelectItem>
                      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Stato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      <SelectItem value="indexed">Indicizzati</SelectItem>
                      <SelectItem value="processing">In elaborazione</SelectItem>
                      <SelectItem value="error">Errori</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Nessun documento trovato</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Carica il tuo primo documento per iniziare
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredDocuments.map((doc) => {
                      const StatusIcon = STATUS_CONFIG[doc.status]?.icon || Clock;
                      const statusColor = STATUS_CONFIG[doc.status]?.color || "text-gray-500";
                      const fileTypeInfo = FILE_TYPE_ICONS[doc.fileType] || FILE_TYPE_ICONS.txt;
                      const categoryLabel = CATEGORY_LABELS[doc.category as DocumentCategory] || doc.category;
                      const categoryColor = CATEGORY_COLORS[doc.category as DocumentCategory] || CATEGORY_COLORS.other;

                      return (
                        <Card
                          key={doc.id}
                          className="group hover:shadow-lg transition-all duration-200 border-l-4"
                          style={{
                            borderLeftColor:
                              doc.status === "indexed"
                                ? "#22c55e"
                                : doc.status === "error"
                                ? "#ef4444"
                                : "#f59e0b",
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <FileText className={`w-5 h-5 flex-shrink-0 ${fileTypeInfo.color}`} />
                                  <h3 className="font-semibold text-sm truncate">{doc.title}</h3>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-2">
                                  <Badge className={categoryColor} variant="secondary">
                                    {categoryLabel}
                                  </Badge>
                                  <Badge variant="outline" className={fileTypeInfo.color}>
                                    {fileTypeInfo.label}
                                  </Badge>
                                  <div className={`flex items-center gap-1 text-xs ${statusColor}`}>
                                    <StatusIcon
                                      className={`w-3 h-3 ${
                                        doc.status === "uploading" || doc.status === "processing"
                                          ? "animate-spin"
                                          : ""
                                      }`}
                                    />
                                    {STATUS_CONFIG[doc.status]?.label}
                                  </div>
                                </div>
                                {doc.tags && doc.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {doc.tags.slice(0, 3).map((tag, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">
                                        <Tag className="w-2.5 h-2.5 mr-1" />
                                        {tag}
                                      </Badge>
                                    ))}
                                    {doc.tags.length > 3 && (
                                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                                        +{doc.tags.length - 3}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Star className="w-3 h-3" />
                                    {doc.priority}/10
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(doc.createdAt)}
                                  </span>
                                  <span>{formatFileSize(doc.fileSize)}</span>
                                  {doc.usageCount > 0 && (
                                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                                      <BarChart3 className="w-3 h-3" />
                                      Usato {doc.usageCount}x
                                    </span>
                                  )}
                                  {doc.summaryEnabled && (
                                    <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full">
                                      <Sparkles className="w-3 h-3" />
                                      Riassunto
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handlePreview(doc)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEdit(doc)}
                                >
                                  <Edit3 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-600"
                                  onClick={() => setDeletingDocumentId(doc.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Documento</DialogTitle>
            <DialogDescription>
              Aggiorna le informazioni del documento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-title">Titolo</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Descrizione</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-category">Categoria</Label>
              <Select
                value={editForm.category}
                onValueChange={(value: DocumentCategory) =>
                  setEditForm((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona categoria" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priorità: {editForm.priority}</Label>
              <Slider
                value={[editForm.priority]}
                onValueChange={([value]) => setEditForm((prev) => ({ ...prev, priority: value }))}
                min={1}
                max={10}
                step={1}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                "Salva modifiche"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingDocumentId}
        onOpenChange={() => setDeletingDocumentId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo documento? Questa azione non può essere annullata
              e il documento sarà rimosso permanentemente dalla base di conoscenza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDocumentId && deleteMutation.mutate(deletingDocumentId)}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminazione...
                </>
              ) : (
                "Elimina"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-500" />
              {previewDocument?.title}
            </DialogTitle>
            <DialogDescription>
              {previewDocument?.fileName} • {previewDocument && formatFileSize(previewDocument.fileSize)}
            </DialogDescription>
          </DialogHeader>
          
          {previewDocument && (
            <div className="flex-1 overflow-hidden flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={CATEGORY_COLORS[previewDocument.category as DocumentCategory] || CATEGORY_COLORS.other}>
                    {CATEGORY_LABELS[previewDocument.category as DocumentCategory] || previewDocument.category}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    Priorità: {previewDocument.priority}/10
                  </span>
                  {previewDocument.usageCount > 0 && (
                    <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                      <BarChart3 className="w-4 h-4" />
                      Usato {previewDocument.usageCount} volte dall'AI
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="summary-switch" className="text-sm">
                    Riassunto AI
                  </Label>
                  <Switch
                    id="summary-switch"
                    checked={previewDocument.summaryEnabled}
                    onCheckedChange={(checked) => 
                      toggleSummaryMutation.mutate({ id: previewDocument.id, enabled: checked })
                    }
                    disabled={toggleSummaryMutation.isPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1 text-sm">
                  <Tag className="w-4 h-4" />
                  Tags personalizzati
                </Label>
                <div className="flex flex-wrap gap-2">
                  {(previewDocument.tags || []).map((tag: string, idx: number) => (
                    <Badge 
                      key={idx} 
                      variant="secondary" 
                      className="flex items-center gap-1 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/20"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      {tag}
                      <X className="w-3 h-3" />
                    </Badge>
                  ))}
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="Nuovo tag..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      className="h-7 w-32 text-sm"
                    />
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleAddTag}
                      className="h-7"
                      disabled={!tagInput.trim()}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>

              {previewDocument.summaryEnabled && previewDocument.contentSummary && (
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">
                    <Sparkles className="w-4 h-4" />
                    Riassunto AI
                  </h4>
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    {previewDocument.contentSummary}
                  </p>
                </div>
              )}

              <div className="flex-1 min-h-0">
                {previewDocument.structuredData ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm flex items-center gap-2">
                        <Table2 className="w-4 h-4 text-emerald-500" />
                        Anteprima Tabella
                      </Label>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Rows3 className="w-4 h-4" />
                          {previewDocument.structuredData.totalRows.toLocaleString()} righe
                        </span>
                        <span className="flex items-center gap-1">
                          <Columns3 className="w-4 h-4" />
                          {previewDocument.structuredData.totalColumns} colonne
                        </span>
                      </div>
                    </div>
                    
                    {previewDocument.structuredData.sheets.length > 1 && (
                      <Tabs 
                        value={tablePreviewSheet.toString()} 
                        onValueChange={(v) => { setTablePreviewSheet(parseInt(v)); setTablePreviewPage(0); }}
                      >
                        <TabsList className="h-8">
                          {previewDocument.structuredData.sheets.map((sheet, idx) => (
                            <TabsTrigger key={idx} value={idx.toString()} className="text-xs">
                              {sheet.name} ({sheet.rowCount.toLocaleString()})
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </Tabs>
                    )}
                    
                    {(() => {
                      const sheet = previewDocument.structuredData!.sheets[tablePreviewSheet] || previewDocument.structuredData!.sheets[0];
                      const totalPages = Math.ceil(sheet.rows.length / ROWS_PER_PAGE);
                      const startIdx = tablePreviewPage * ROWS_PER_PAGE;
                      const endIdx = Math.min(startIdx + ROWS_PER_PAGE, sheet.rows.length);
                      const pageRows = sheet.rows.slice(startIdx, endIdx);
                      
                      return (
                        <>
                          <ScrollArea className="h-[280px] border rounded-lg bg-white dark:bg-slate-900">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm border-collapse">
                                <thead className="sticky top-0 bg-gray-100 dark:bg-slate-800">
                                  <tr>
                                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 border-b w-12">#</th>
                                    {sheet.headers.map((header, idx) => (
                                      <th key={idx} className="px-2 py-1.5 text-left text-xs font-medium text-gray-600 dark:text-gray-300 border-b whitespace-nowrap">
                                        {header || `Col ${idx + 1}`}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {pageRows.map((row, rowIdx) => (
                                    <tr key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                      <td className="px-2 py-1 text-xs text-gray-400 border-b">{startIdx + rowIdx + 1}</td>
                                      {row.map((cell, cellIdx) => (
                                        <td key={cellIdx} className="px-2 py-1 text-xs border-b whitespace-nowrap max-w-[200px] truncate" title={String(cell ?? '')}>
                                          {cell === null || cell === undefined ? '' : String(cell)}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </ScrollArea>
                          
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-500">
                                Righe {startIdx + 1}-{endIdx} di {sheet.rows.length.toLocaleString()}
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setTablePreviewPage(p => Math.max(0, p - 1))}
                                  disabled={tablePreviewPage === 0}
                                >
                                  <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <span className="text-gray-600 dark:text-gray-400">
                                  Pagina {tablePreviewPage + 1} di {totalPages}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setTablePreviewPage(p => Math.min(totalPages - 1, p + 1))}
                                  disabled={tablePreviewPage >= totalPages - 1}
                                >
                                  <ChevronRight className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <>
                    <Label className="text-sm mb-2 block">Contenuto Estratto</Label>
                    <ScrollArea className="h-[300px] border rounded-lg p-4 bg-white dark:bg-slate-900">
                      <pre className="text-sm whitespace-pre-wrap font-sans">
                        {previewDocument.extractedContent || "Contenuto non disponibile"}
                      </pre>
                    </ScrollArea>
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="flex-shrink-0 mt-4">
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Chiudi
            </Button>
            <Button
              onClick={() => setShowAskConfirmDialog(true)}
              className="bg-amber-500 hover:bg-amber-600"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Chiedimi qualcosa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showAskConfirmDialog} onOpenChange={setShowAskConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chiedi all'AI su questo documento</AlertDialogTitle>
            <AlertDialogDescription>
              Vuoi aprire l'AI Assistant e chiedere informazioni sul documento "{previewDocument?.title}"?
              L'assistente AI analizzerà il contenuto del documento e risponderà alle tue domande.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (previewDocument) {
                  openAIAndAskAboutDocument({
                    id: previewDocument.id,
                    title: previewDocument.title,
                    category: previewDocument.category,
                    fileName: previewDocument.fileName,
                  });
                  setShowAskConfirmDialog(false);
                  setShowPreviewDialog(false);
                  toast({
                    title: "AI Assistant aperto",
                    description: "Sto analizzando il documento per te...",
                  });
                }
              }}
              className="bg-amber-500 hover:bg-amber-600"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Chiedi all'AI
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AIAssistant />
    </div>
  );
}
