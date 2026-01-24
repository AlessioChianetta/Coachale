import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Upload,
  Trash2,
  Edit3,
  Search,
  Filter,
  FileType,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Clock,
  Database,
  Calendar,
  Star,
  Eye,
  MessageCircle,
  Tag,
  BarChart3,
  X,
  Sparkles,
  Cloud,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Table2,
  Rows3,
  Columns3,
  RefreshCw,
  Folder,
  FolderPlus,
  Home,
  List,
  LayoutGrid,
  Move,
  FolderOpen,
  Plus,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GoogleDriveBrowser from "@/components/google-drive/GoogleDriveBrowser";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { openAIAndAskAboutDocument } from "@/hooks/use-document-focus";
import { cn } from "@/lib/utils";

type DocumentCategory = "white_paper" | "case_study" | "manual" | "normative" | "research" | "article" | "other";
type DocumentStatus = "uploading" | "processing" | "indexed" | "error";
type FileTypeEnum = "pdf" | "docx" | "txt" | "md" | "rtf" | "odt" | "csv" | "xlsx" | "xls" | "pptx" | "mp3" | "wav" | "m4a" | "ogg" | "webm_audio";
type ViewMode = "list" | "grid";

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
  consultantId: string;
  title: string;
  description: string | null;
  category: DocumentCategory;
  fileName: string;
  fileType: FileTypeEnum;
  fileSize: number;
  filePath: string;
  folderId: string | null;
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
  fileSearchSyncedAt: string | null;
  syncProgress: number | null;
  syncCurrentChunk: number | null;
  syncTotalChunks: number | null;
  syncMessage: string | null;
  googleDriveFileId?: string | null;
}

interface KnowledgeFolder {
  id: string;
  consultantId: string;
  name: string;
  parentId: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  documentCount: number;
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

type DocumentProgressPhase = 'extracting' | 'extracting_complete' | 'syncing' | 'chunking' | 'complete' | 'error';

interface DocumentProgress {
  phase: DocumentProgressPhase;
  progress: number;
  message: string;
  needsChunking?: boolean;
  totalChunks?: number;
  currentChunk?: number;
  error?: string;
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

const FILE_TYPE_ICONS: Record<FileTypeEnum, { color: string; label: string }> = {
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

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default function ConsultantKnowledgeDocuments() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingDocument, setEditingDocument] = useState<KnowledgeDocument | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<KnowledgeDocument | null>(null);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tablePreviewPage, setTablePreviewPage] = useState(0);
  const [tablePreviewSheet, setTablePreviewSheet] = useState(0);
  const ROWS_PER_PAGE = 50;
  const [showAskConfirmDialog, setShowAskConfirmDialog] = useState(false);
  const [isGoogleDriveOpen, setIsGoogleDriveOpen] = useState(false);
  const [documentProgressMap, setDocumentProgressMap] = useState<Record<string, DocumentProgress>>({});
  const [retryingDocId, setRetryingDocId] = useState<string | null>(null);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState<KnowledgeFolder | null>(null);
  const [folderForm, setFolderForm] = useState({ name: "", color: "#6366f1" });
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [movingToFolderId, setMovingToFolderId] = useState<string | null>(null);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showUploadSection, setShowUploadSection] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);

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

  const {
    data: documentsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: [
      "/api/consultant/knowledge/documents",
      { folderId: selectedFolderId, search: debouncedSearch, category: categoryFilter, status: statusFilter }
    ],
    queryFn: async ({ pageParam = null }) => {
      const params = new URLSearchParams();
      if (pageParam) params.append("cursor", pageParam);
      if (selectedFolderId) params.append("folderId", selectedFolderId);
      else params.append("folderId", "root");
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);
      params.append("limit", "50");

      const response = await fetch(`/api/consultant/knowledge/documents?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    },
    getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: null as string | null,
  });

  const documents: KnowledgeDocument[] = useMemo(() => {
    return documentsData?.pages.flatMap(p => p.data) ?? [];
  }, [documentsData]);

  const totalCount = documentsData?.pages[0]?.totalCount ?? 0;

  const { data: foldersResponse } = useQuery({
    queryKey: ["/api/consultant/knowledge/folders"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/knowledge/folders", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch folders");
      return response.json();
    },
  });

  const folders: KnowledgeFolder[] = foldersResponse?.data || [];

  const virtualizer = useVirtualizer({
    count: documents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => viewMode === "list" ? 100 : 200,
    overscan: 5,
  });

  useEffect(() => {
    const items = virtualizer.getVirtualItems();
    const lastItem = items[items.length - 1];

    if (lastItem && lastItem.index >= documents.length - 5 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualizer.getVirtualItems(), hasNextPage, isFetchingNextPage, documents.length, fetchNextPage]);

  const subscribedDocsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (documents.length > 0) {
      const initialProgress: Record<string, DocumentProgress> = {};
      const docsNeedingSubscription: string[] = [];
      
      for (const doc of documents) {
        if (doc.syncProgress !== null && doc.syncProgress !== undefined && doc.syncProgress > 0 && !doc.fileSearchSyncedAt) {
          initialProgress[doc.id] = {
            phase: 'chunking',
            progress: doc.syncProgress,
            message: doc.syncMessage || `Sincronizzazione in corso...`,
            needsChunking: doc.syncTotalChunks ? doc.syncTotalChunks > 1 : false,
            totalChunks: doc.syncTotalChunks || undefined,
            currentChunk: doc.syncCurrentChunk || undefined,
          };
          if (!subscribedDocsRef.current.has(doc.id)) {
            docsNeedingSubscription.push(doc.id);
          }
        }
      }
      
      if (Object.keys(initialProgress).length > 0) {
        setDocumentProgressMap(prev => ({ ...prev, ...initialProgress }));
      }
      
      if (docsNeedingSubscription.length > 0) {
        setTimeout(() => {
          docsNeedingSubscription.forEach(docId => {
            if (!subscribedDocsRef.current.has(docId)) {
              subscribedDocsRef.current.add(docId);
              subscribeToDocumentProgressRef.current?.(docId);
            }
          });
        }, 100);
      }
    }
  }, [documentsData]);
  
  const subscribeToDocumentProgressRef = useRef<((docId: string) => void) | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/consultant/knowledge/documents", {
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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/folders"] });
      setUploadingFiles([]);
      setUploadForm({ title: "", description: "", category: "other", priority: 5 });
      toast({
        title: "Documento caricato",
        description: "Il documento è stato caricato con successo. L'elaborazione è in corso.",
      });
      if (result.data?.id) {
        subscribeToDocumentProgress(result.data.id);
      }
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
      const response = await fetch(`/api/consultant/knowledge/documents/${id}`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/documents"] });
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
      const response = await fetch(`/api/consultant/knowledge/documents/${id}`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/folders"] });
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      const response = await fetch("/api/consultant/knowledge/documents/bulk-delete", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentIds }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete documents");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/folders"] });
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
      toast({
        title: "Documenti eliminati",
        description: "I documenti selezionati sono stati eliminati",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore eliminazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkMoveMutation = useMutation({
    mutationFn: async ({ documentIds, folderId }: { documentIds: string[]; folderId: string | null }) => {
      const response = await fetch("/api/consultant/knowledge/documents/bulk-move", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentIds, folderId }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to move documents");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/folders"] });
      setSelectedIds(new Set());
      setShowMoveDialog(false);
      toast({
        title: "Documenti spostati",
        description: "I documenti selezionati sono stati spostati",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore spostamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const response = await fetch("/api/consultant/knowledge/folders", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create folder");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/folders"] });
      setShowFolderDialog(false);
      setFolderForm({ name: "", color: "#6366f1" });
      toast({
        title: "Cartella creata",
        description: "La cartella è stata creata con successo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; color: string } }) => {
      const response = await fetch(`/api/consultant/knowledge/folders/${id}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update folder");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/folders"] });
      setShowFolderDialog(false);
      setEditingFolder(null);
      setFolderForm({ name: "", color: "#6366f1" });
      toast({
        title: "Cartella aggiornata",
        description: "La cartella è stata aggiornata",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/consultant/knowledge/folders/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete folder");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/documents"] });
      if (selectedFolderId === editingFolder?.id) {
        setSelectedFolderId(null);
      }
      setEditingFolder(null);
      toast({
        title: "Cartella eliminata",
        description: "La cartella è stata eliminata",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: statsResponse } = useQuery({
    queryKey: ["/api/consultant/knowledge/stats"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/knowledge/stats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });
  const stats: KnowledgeStats | null = statsResponse?.data || null;

  const toggleSummaryMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await fetch(`/api/consultant/knowledge/documents/${id}/toggle-summary`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/documents"] });
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
      const response = await fetch(`/api/consultant/knowledge/documents/${id}/tags`, {
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
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/documents"] });
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

  const subscribeToDocumentProgress = useCallback(async (documentId: string) => {
    try {
      subscribedDocsRef.current.add(documentId);
      
      const tokenResponse = await fetch(`/api/consultant/knowledge/documents/${documentId}/progress-token`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      
      if (!tokenResponse.ok) {
        subscribedDocsRef.current.delete(documentId);
        return;
      }
      
      const { token } = await tokenResponse.json();
      const eventSource = new EventSource(`/api/consultant/knowledge/documents/${documentId}/progress?token=${token}`);
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "connected") {
            setDocumentProgressMap(prev => ({
              ...prev,
              [documentId]: { phase: "extracting", progress: 5, message: "Connesso..." }
            }));
          } else if (data.type === "document_progress") {
            setDocumentProgressMap(prev => ({
              ...prev,
              [documentId]: {
                phase: data.phase,
                progress: data.progress,
                message: data.message,
                needsChunking: data.needsChunking,
                totalChunks: data.totalChunks,
                currentChunk: data.currentChunk,
                error: data.error,
              }
            }));
            
            if (data.phase === "complete" || data.phase === "error") {
              setTimeout(() => {
                eventSource.close();
                subscribedDocsRef.current.delete(documentId);
                queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/documents"] });
                if (data.phase === "complete") {
                  setTimeout(() => {
                    setDocumentProgressMap(prev => {
                      const newMap = { ...prev };
                      delete newMap[documentId];
                      return newMap;
                    });
                  }, 3000);
                }
              }, 1000);
            }
          }
        } catch (e) {
          console.error("Error parsing SSE:", e);
        }
      };
      
      eventSource.onerror = () => {
        eventSource.close();
        subscribedDocsRef.current.delete(documentId);
      };
      
      return () => {
        eventSource.close();
        subscribedDocsRef.current.delete(documentId);
      };
    } catch (e) {
      console.error("Error subscribing to document progress:", e);
      subscribedDocsRef.current.delete(documentId);
    }
  }, [queryClient]);
  
  useEffect(() => {
    subscribeToDocumentProgressRef.current = subscribeToDocumentProgress;
  }, [subscribeToDocumentProgress]);

  const retryMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`/api/consultant/knowledge/documents/${documentId}/retry`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to retry");
      }
      return { documentId, ...await response.json() };
    },
    onSuccess: (data) => {
      setRetryingDocId(null);
      subscribeToDocumentProgress(data.documentId);
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/documents"] });
    },
    onError: (error: any) => {
      setRetryingDocId(null);
      toast({
        title: "Errore",
        description: error.message || "Errore durante il retry",
        variant: "destructive",
      });
    },
  });

  const handleRetry = (documentId: string) => {
    setRetryingDocId(documentId);
    retryMutation.mutate(documentId);
  };

  const handlePreview = async (doc: KnowledgeDocument) => {
    setTablePreviewPage(0);
    setTablePreviewSheet(0);
    try {
      const response = await fetch(`/api/consultant/knowledge/documents/${doc.id}/preview`, {
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
      setShowUploadSection(true);
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
      if (selectedFolderId) {
        formData.append("folderId", selectedFolderId);
      }

      uploadMutation.mutate(formData);
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

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(documents.map(d => d.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleOpenFolderDialog = (folder?: KnowledgeFolder) => {
    if (folder) {
      setEditingFolder(folder);
      setFolderForm({ name: folder.name, color: folder.color });
    } else {
      setEditingFolder(null);
      setFolderForm({ name: "", color: "#6366f1" });
    }
    setShowFolderDialog(true);
  };

  const handleSaveFolder = () => {
    if (editingFolder) {
      updateFolderMutation.mutate({ id: editingFolder.id, data: folderForm });
    } else {
      createFolderMutation.mutate(folderForm);
    }
  };

  const handleBulkMove = () => {
    if (selectedIds.size === 0) return;
    setMovingToFolderId(null);
    setShowMoveDialog(true);
  };

  const handleConfirmMove = () => {
    bulkMoveMutation.mutate({
      documentIds: Array.from(selectedIds),
      folderId: movingToFolderId,
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setShowBulkDeleteDialog(true);
  };

  const handleConfirmBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  };

  const renderDocumentCard = (doc: KnowledgeDocument, isSelected: boolean) => {
    const StatusIcon = STATUS_CONFIG[doc.status].icon;
    const fileTypeConfig = FILE_TYPE_ICONS[doc.fileType];
    const progress = documentProgressMap[doc.id];
    const isGoogleDriveDoc = !!doc.googleDriveFileId;

    if (viewMode === "grid") {
      return (
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow h-full">
          <div className="flex items-start gap-2 mb-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => toggleSelection(doc.id)}
              className="mt-1"
            />
            <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700 ${fileTypeConfig.color}`}>
              <FileType className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                {doc.title}
              </h4>
              <span className="text-xs text-gray-400">{fileTypeConfig.label}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 mb-2">
            <Badge className={cn(CATEGORY_COLORS[doc.category], "text-xs py-0")}>
              {CATEGORY_LABELS[doc.category]}
            </Badge>
            <span className={`flex items-center gap-0.5 text-xs ${STATUS_CONFIG[doc.status].color}`}>
              <StatusIcon className={`w-3 h-3 ${doc.status === "uploading" || doc.status === "processing" ? "animate-spin" : ""}`} />
            </span>
            {isGoogleDriveDoc && (
              <span className="flex items-center gap-0.5 text-xs text-blue-600">
                <Cloud className="w-3 h-3" />
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" onClick={() => handlePreview(doc)} className="h-7 w-7">
              <Eye className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleEdit(doc)} className="h-7 w-7">
              <Edit3 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDeletingDocumentId(doc.id)} className="h-7 w-7 text-red-500">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleSelection(doc.id)}
          className="mt-1"
        />
        <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700 ${fileTypeConfig.color}`}>
          <FileType className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {doc.title}
              </h4>
              {doc.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                  {doc.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePreview(doc)}
                className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                title="Anteprima"
              >
                <Eye className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEdit(doc)}
                className="h-8 w-8"
                title="Modifica"
              >
                <Edit3 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeletingDocumentId(doc.id)}
                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Elimina"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge className={CATEGORY_COLORS[doc.category]}>
              {CATEGORY_LABELS[doc.category]}
            </Badge>
            <span className={`flex items-center gap-1 text-xs ${STATUS_CONFIG[doc.status].color}`}>
              <StatusIcon className={`w-3.5 h-3.5 ${doc.status === "uploading" || doc.status === "processing" ? "animate-spin" : ""}`} />
              {STATUS_CONFIG[doc.status].label}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Star className="w-3.5 h-3.5" />
              {doc.priority}/10
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {fileTypeConfig.label} • {formatFileSize(doc.fileSize)}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(doc.createdAt)}
            </span>
            {doc.usageCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                <BarChart3 className="w-3 h-3" />
                Usato {doc.usageCount}x
              </span>
            )}
            {doc.summaryEnabled && (
              <span className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                Riassunto
              </span>
            )}
            {doc.fileSearchSyncedAt && (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                <Database className="w-3 h-3" />
                File Search
              </span>
            )}
            {isGoogleDriveDoc && (
              <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                <Cloud className="w-3 h-3" />
                Google Drive
              </span>
            )}
          </div>

          {progress && progress.phase !== "complete" && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {progress.message}
                </span>
              </div>
              <Progress value={progress.progress} className="h-2" />
              {progress.needsChunking && progress.totalChunks && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Documento grande - suddivisione in {progress.totalChunks} parti
                  {progress.currentChunk ? ` (${progress.currentChunk}/${progress.totalChunks})` : ''}
                </p>
              )}
              {progress.phase === "complete" && (
                <div className="flex items-center gap-2 mt-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm">Completato!</span>
                </div>
              )}
            </div>
          )}

          {doc.status === "error" && doc.errorMessage && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
              <p className="text-xs text-red-500">{doc.errorMessage}</p>
              {progress?.phase === "error" && progress?.error && (
                <p className="text-xs text-red-500 mt-1">{progress.error}</p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-2 text-red-600 border-red-300 hover:bg-red-100"
                onClick={() => handleRetry(doc.id)}
                disabled={retryingDocId === doc.id}
              >
                {retryingDocId === doc.id ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Riprovando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Riprova
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="mb-4 sm:mb-6 md:mb-8">
            <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-2xl">
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
                      <p className="text-amber-100 text-xs sm:text-sm md:text-base lg:text-lg hidden sm:block">
                        Carica e gestisci documenti per arricchire le risposte AI
                      </p>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:flex items-center space-x-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                    <div className="text-3xl font-bold">{stats?.documents.total ?? 0}</div>
                    <div className="text-sm text-amber-100">Documenti</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center">
                    <div className="text-3xl font-bold">{stats?.documents.indexed ?? 0}</div>
                    <div className="text-sm text-amber-100">Indicizzati</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Card className="mb-6">
            <Collapsible open={isGoogleDriveOpen} onOpenChange={setIsGoogleDriveOpen}>
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
                        isGoogleDriveOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <GoogleDriveBrowser
                    apiPrefix="/api/consultant"
                    onImportSuccess={(count) => {
                      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/documents"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/stats"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/folders"] });
                    }}
                  />
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          <div className="flex gap-4">
            {!isMobile && (
              <div className="w-64 shrink-0">
                <Card>
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Folder className="w-4 h-4" />
                        Cartelle
                      </CardTitle>
                      <Button size="sm" variant="ghost" onClick={() => handleOpenFolderDialog()}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div
                      className={cn(
                        "px-3 py-2 rounded cursor-pointer flex items-center justify-between mb-1",
                        !selectedFolderId ? "bg-amber-100 dark:bg-amber-900/30" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                      onClick={() => setSelectedFolderId(null)}
                    >
                      <span className="flex items-center gap-2">
                        <Home className="w-4 h-4" />
                        Tutti i documenti
                      </span>
                      <Badge variant="secondary">{stats?.documents.total ?? 0}</Badge>
                    </div>

                    {folders.map(folder => (
                      <div
                        key={folder.id}
                        className={cn(
                          "px-3 py-2 rounded cursor-pointer flex items-center justify-between group mb-1",
                          selectedFolderId === folder.id ? "bg-amber-100 dark:bg-amber-900/30" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        )}
                        onClick={() => setSelectedFolderId(folder.id)}
                      >
                        <span className="flex items-center gap-2 flex-1 min-w-0">
                          <FolderOpen className="w-4 h-4 shrink-0" style={{ color: folder.color }} />
                          <span className="truncate">{folder.name}</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="shrink-0">{folder.documentCount}</Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenFolderDialog(folder);
                            }}
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="mt-4">
                  <div
                    {...getRootProps()}
                    className={`p-4 border-2 border-dashed rounded-xl text-center cursor-pointer transition-all ${
                      isDragActive
                        ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-amber-300"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragActive ? "text-amber-500" : "text-gray-400"}`} />
                    {isDragActive ? (
                      <p className="text-amber-600 font-medium text-sm">Rilascia qui...</p>
                    ) : (
                      <>
                        <p className="text-gray-600 dark:text-gray-400 font-medium text-sm">Carica file</p>
                        <p className="text-xs text-gray-400 mt-1">PDF, DOCX, CSV, ecc.</p>
                      </>
                    )}
                  </div>
                </Card>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5 text-amber-500" />
                        Documenti ({totalCount})
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={viewMode === "list" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setViewMode("list")}
                          className={viewMode === "list" ? "bg-amber-500 hover:bg-amber-600" : ""}
                        >
                          <List className="w-4 h-4" />
                        </Button>
                        <Button
                          variant={viewMode === "grid" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setViewMode("grid")}
                          className={viewMode === "grid" ? "bg-amber-500 hover:bg-amber-600" : ""}
                        >
                          <LayoutGrid className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="Cerca documenti..."
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-32 sm:w-36">
                          <Filter className="w-4 h-4 mr-2" />
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutte</SelectItem>
                          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-32 sm:w-36">
                          <SelectValue placeholder="Stato" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutti</SelectItem>
                          <SelectItem value="indexed">Indicizzato</SelectItem>
                          <SelectItem value="processing">In elaborazione</SelectItem>
                          <SelectItem value="error">Errore</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedIds.size > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                          {selectedIds.size} selezionati
                        </span>
                        <Button variant="outline" size="sm" onClick={selectAll}>
                          Seleziona tutti
                        </Button>
                        <Button variant="outline" size="sm" onClick={clearSelection}>
                          Deseleziona
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleBulkMove}>
                          <Move className="w-4 h-4 mr-1" />
                          Sposta
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                          <Trash2 className="w-4 h-4 mr-1" />
                          Elimina
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">Nessun documento trovato</p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                        Carica il tuo primo documento usando l'area di upload
                      </p>
                    </div>
                  ) : (
                    <div
                      ref={parentRef}
                      className="h-[calc(100vh-450px)] min-h-[400px] overflow-auto"
                    >
                      <div
                        style={{
                          height: `${virtualizer.getTotalSize()}px`,
                          width: "100%",
                          position: "relative",
                        }}
                      >
                        {viewMode === "grid" ? (
                          <div
                            className="grid gap-3"
                            style={{
                              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                            }}
                          >
                            {documents.map((doc) => (
                              <div key={doc.id}>
                                {renderDocumentCard(doc, selectedIds.has(doc.id))}
                              </div>
                            ))}
                          </div>
                        ) : (
                          virtualizer.getVirtualItems().map((virtualItem) => {
                            const doc = documents[virtualItem.index];
                            return (
                              <div
                                key={doc.id}
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  width: "100%",
                                  height: `${virtualItem.size}px`,
                                  transform: `translateY(${virtualItem.start}px)`,
                                }}
                              >
                                <div className="pr-2 pb-3">
                                  {renderDocumentCard(doc, selectedIds.has(doc.id))}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {isFetchingNextPage && (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                          <span className="ml-2 text-sm text-gray-500">Caricamento...</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {isMobile && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5 text-amber-500" />
                  Carica Documento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDragActive
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-amber-300"
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? "text-amber-500" : "text-gray-400"}`} />
                  {isDragActive ? (
                    <p className="text-amber-600 font-medium">Rilascia il file qui...</p>
                  ) : (
                    <>
                      <p className="text-gray-600 dark:text-gray-400 font-medium">Trascina un file qui</p>
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">oppure clicca per selezionare</p>
                      <p className="text-xs text-gray-400 mt-2">PDF, DOCX, TXT, MD, CSV, XLSX, PPTX, Audio (max 10MB)</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {uploadingFiles.length > 0 && (
        <Dialog open={uploadingFiles.length > 0} onOpenChange={() => setUploadingFiles([])}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Carica Documento</DialogTitle>
              <DialogDescription>Configura i dettagli del documento da caricare</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <FileText className="w-5 h-5 text-amber-500" />
                <span className="text-sm font-medium truncate flex-1">{uploadingFiles[0]?.name}</span>
                <span className="text-xs text-gray-500">{uploadingFiles[0] && formatFileSize(uploadingFiles[0].size)}</span>
              </div>

              <div>
                <Label htmlFor="upload-title">Titolo *</Label>
                <Input
                  id="upload-title"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Titolo del documento"
                />
              </div>
              <div>
                <Label htmlFor="upload-description">Descrizione</Label>
                <Textarea
                  id="upload-description"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrizione opzionale"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="upload-category">Categoria</Label>
                <Select
                  value={uploadForm.category}
                  onValueChange={(value: DocumentCategory) => setUploadForm((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger id="upload-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priorità: {uploadForm.priority}</Label>
                <Slider
                  value={[uploadForm.priority]}
                  onValueChange={([value]) => setUploadForm((prev) => ({ ...prev, priority: value }))}
                  min={1}
                  max={10}
                  step={1}
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadingFiles([])}>Annulla</Button>
              <Button onClick={handleUpload} disabled={uploadMutation.isPending} className="bg-amber-500 hover:bg-amber-600">
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
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Documento</DialogTitle>
            <DialogDescription>
              Modifica le informazioni del documento. Il file non può essere modificato.
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
                onValueChange={(value: DocumentCategory) => setEditForm((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger id="edit-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
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
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Annulla</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending} className="bg-amber-500 hover:bg-amber-600">
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

      <AlertDialog open={!!deletingDocumentId} onOpenChange={() => setDeletingDocumentId(null)}>
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

      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFolder ? "Modifica Cartella" : "Nuova Cartella"}</DialogTitle>
            <DialogDescription>
              {editingFolder ? "Modifica il nome e il colore della cartella" : "Crea una nuova cartella per organizzare i documenti"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="folder-name">Nome cartella</Label>
              <Input
                id="folder-name"
                value={folderForm.name}
                onChange={(e) => setFolderForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nome della cartella"
              />
            </div>
            <div>
              <Label htmlFor="folder-color">Colore</Label>
              <div className="flex gap-2 mt-2">
                {["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      folderForm.color === color ? "border-gray-900 dark:border-white scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setFolderForm((prev) => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            {editingFolder && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (editingFolder) {
                    deleteFolderMutation.mutate(editingFolder.id);
                  }
                }}
                disabled={deleteFolderMutation.isPending}
              >
                {deleteFolderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Elimina"}
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowFolderDialog(false)}>Annulla</Button>
              <Button
                onClick={handleSaveFolder}
                disabled={!folderForm.name.trim() || createFolderMutation.isPending || updateFolderMutation.isPending}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {(createFolderMutation.isPending || updateFolderMutation.isPending) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  editingFolder ? "Salva" : "Crea"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sposta Documenti</DialogTitle>
            <DialogDescription>
              Seleziona la cartella di destinazione per i {selectedIds.size} documenti selezionati
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <div
              className={cn(
                "px-3 py-2 rounded cursor-pointer flex items-center gap-2 border",
                movingToFolderId === null ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : "border-transparent hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
              onClick={() => setMovingToFolderId(null)}
            >
              <Home className="w-4 h-4" />
              <span>Root (nessuna cartella)</span>
            </div>
            {folders.map(folder => (
              <div
                key={folder.id}
                className={cn(
                  "px-3 py-2 rounded cursor-pointer flex items-center gap-2 border",
                  movingToFolderId === folder.id ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20" : "border-transparent hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
                onClick={() => setMovingToFolderId(folder.id)}
              >
                <FolderOpen className="w-4 h-4" style={{ color: folder.color }} />
                <span>{folder.name}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>Annulla</Button>
            <Button onClick={handleConfirmMove} disabled={bulkMoveMutation.isPending} className="bg-amber-500 hover:bg-amber-600">
              {bulkMoveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Move className="w-4 h-4 mr-2" />
                  Sposta
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione multipla</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare {selectedIds.size} documenti? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBulkDelete} className="bg-red-500 hover:bg-red-600">
              {bulkDeleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminazione...
                </>
              ) : (
                `Elimina ${selectedIds.size} documenti`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
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
                  <Badge className={CATEGORY_COLORS[previewDocument.category]}>
                    {CATEGORY_LABELS[previewDocument.category]}
                  </Badge>
                  <span className="text-sm text-gray-500">Priorità: {previewDocument.priority}/10</span>
                  {previewDocument.usageCount > 0 && (
                    <span className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
                      <BarChart3 className="w-4 h-4" />
                      Usato {previewDocument.usageCount} volte dall'AI
                    </span>
                  )}
                  {previewDocument.googleDriveFileId && (
                    <span className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
                      <Cloud className="w-4 h-4" />
                      Google Drive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="summary-switch" className="text-sm">Riassunto AI</Label>
                  <Switch
                    id="summary-switch"
                    checked={previewDocument.summaryEnabled}
                    onCheckedChange={(checked) => toggleSummaryMutation.mutate({ id: previewDocument.id, enabled: checked })}
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
                    <Button size="sm" variant="outline" onClick={handleAddTag} className="h-7" disabled={!tagInput.trim()}>
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
                  <p className="text-sm text-purple-600 dark:text-purple-400">{previewDocument.contentSummary}</p>
                </div>
              )}

              <div className="flex-1 min-h-0">
                {previewDocument.structuredData ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm flex items-center gap-2">
                        <Table2 className="w-4 h-4 text-amber-500" />
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
                              <span className="text-gray-500">Righe {startIdx + 1}-{endIdx} di {sheet.rows.length.toLocaleString()}</span>
                              <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => setTablePreviewPage(p => Math.max(0, p - 1))} disabled={tablePreviewPage === 0}>
                                  <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <span className="text-gray-600 dark:text-gray-400">Pagina {tablePreviewPage + 1} di {totalPages}</span>
                                <Button size="sm" variant="outline" onClick={() => setTablePreviewPage(p => Math.min(totalPages - 1, p + 1))} disabled={tablePreviewPage >= totalPages - 1}>
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
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Chiudi</Button>
            <Button onClick={() => setShowAskConfirmDialog(true)} className="bg-amber-500 hover:bg-amber-600">
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

      <ConsultantAIAssistant />
    </div>
  );
}
