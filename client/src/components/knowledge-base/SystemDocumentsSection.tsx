import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Edit3,
  Trash2,
  FileText,
  Sparkles,
  MessageCircle,
  Bot,
  Users,
  ChevronDown,
  Loader2,
  Search,
  StickyNote,
  Building2,
  X,
  Cloud,
  RefreshCw,
  Clock,
  History,
  CheckCircle2,
  XCircle,
  Timer,
  AlertTriangle,
  LayoutGrid,
  List,
  Upload,
  PenLine,
  FileUp,
  FolderOpen,
  ChevronRight,
  Home,
  HardDrive,
  Star,
  Share2,
  Lock,
  Globe,
  UserRound,
  HardHat,
  Eye,
  Copy,
  Check,
  CalendarDays,
  Hash,
  Zap,
  Share,
  ArrowRightLeft,
  Database,
  AlertCircle,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { AI_ROLE_PROFILES } from "@/components/autonomy/constants";

interface KbDocSummary {
  id: string;
  title: string;
  status: string;
  fileType?: string;
  source: 'kb';
  agentIds: string[];
  googleDriveFileId?: string;
  fileSize?: number;
  createdAt?: string;
}

const AUTONOMOUS_AGENTS = [
  { id: "alessia", name: "Alessia" },
  { id: "millie", name: "Millie" },
  { id: "echo", name: "Echo" },
  { id: "nova", name: "Nova" },
  { id: "stella", name: "Stella" },
  { id: "iris", name: "Iris" },
  { id: "marco", name: "Marco" },
  { id: "personalizza", name: "Personalizza" },
];

interface WhatsAppAgent {
  id: string;
  agent_name: string;
  agent_type: string;
  is_active: boolean;
}

interface SystemDocument {
  id: string;
  title: string;
  content: string;
  description: string | null;
  is_active: boolean;
  target_client_assistant: boolean;
  target_client_mode: 'all' | 'consultant_only' | 'clients_only' | 'employees_only' | 'specific_clients' | 'specific_departments' | 'specific_employees';
  target_client_ids: string[];
  target_department_ids: string[];
  target_autonomous_agents: Record<string, boolean>;
  target_whatsapp_agents: Record<string, boolean>;
  injection_mode: "system_prompt" | "file_search";
  file_search_stores?: Array<{
    storeName: string;
    storeOwnerType: string;
    storeOwnerId: string;
    documentStatus: string;
  }>;
  priority: number;
  google_drive_file_id: string | null;
  last_drive_sync_at: string | null;
  sync_count: number | null;
  pending_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isEmployee: boolean;
  departmentId: string | null;
}

interface Department {
  id: string;
  name: string;
  color: string;
  employee_count: number;
}

type TargetClientMode = 'all' | 'consultant_only' | 'clients_only' | 'employees_only' | 'specific_clients' | 'specific_departments' | 'specific_employees';

interface DocumentForm {
  title: string;
  content: string;
  description: string;
  target_client_assistant: boolean;
  target_client_mode: TargetClientMode;
  target_client_ids: string[];
  target_department_ids: string[];
  target_autonomous_agents: Record<string, boolean>;
  target_whatsapp_agents: Record<string, boolean>;
  injection_mode: "system_prompt" | "file_search";
  priority: number;
}

const emptyForm = (): DocumentForm => ({
  title: "",
  content: "",
  description: "",
  target_client_assistant: false,
  target_client_mode: 'all',
  target_client_ids: [],
  target_department_ids: [],
  target_autonomous_agents: Object.fromEntries(AUTONOMOUS_AGENTS.map(a => [a.id, false])),
  target_whatsapp_agents: {},
  injection_mode: "system_prompt",
  priority: 5,
});

interface ContentEntry {
  id: string;
  title: string;
  content: string;
  description: string;
  sourceType: 'manual' | 'drive' | 'upload';
  sourceFileName?: string;
  driveFileId?: string;
}

type PickerDriveSection = 'home' | 'my-drive' | 'shared-with-me' | 'recent' | 'starred';

const PICKER_DRIVE_SECTIONS: { id: PickerDriveSection; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Home page', icon: <Home className="w-4 h-4" /> },
  { id: 'my-drive', label: 'Il mio Drive', icon: <HardDrive className="w-4 h-4" /> },
  { id: 'shared-with-me', label: 'Condivisi con me', icon: <Share2 className="w-4 h-4" /> },
  { id: 'recent', label: 'Recenti', icon: <Clock className="w-4 h-4" /> },
  { id: 'starred', label: 'Speciali', icon: <Star className="w-4 h-4" /> },
];

function DriveFilePicker({ onTextExtracted, onMultipleExtracted, existingDocuments }: { 
  onTextExtracted: (text: string, fileName: string, fileId?: string) => void;
  onMultipleExtracted?: (files: Array<{text: string; fileName: string; fileId: string}>) => void;
  existingDocuments?: SystemDocument[];
}) {
  const [currentSection, setCurrentSection] = useState<PickerDriveSection>('home');
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [breadcrumbs, setBreadcrumbs] = useState<{id: string; name: string}[]>([{ id: 'root', name: 'Home page' }]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Map<string, { id: string; name: string }>>(new Map());
  const [isInSharedFolder, setIsInSharedFolder] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();

  const alreadyImportedMap = useMemo(() => {
    const map = new Map<string, { source: string; title: string; content: string }>();
    if (existingDocuments) {
      existingDocuments.forEach(doc => {
        if (doc.google_drive_file_id) {
          map.set(doc.google_drive_file_id, { source: 'system', title: doc.title, content: doc.content });
        }
      });
    }
    return map;
  }, [existingDocuments]);

  const { data: driveStatus, isLoading: driveStatusLoading } = useQuery({
    queryKey: ['/api/consultant/google-drive/status-picker'],
    queryFn: async () => {
      const res = await fetch('/api/consultant/google-drive/status', { headers: getAuthHeaders(), credentials: 'include' });
      if (!res.ok) return { connected: false };
      return res.json();
    },
  });

  const isSpecialSection = ['shared-with-me', 'recent', 'starred', 'home'].includes(currentSection);
  const isAtRootLevel = !isInSharedFolder && breadcrumbs.length === 1;

  const { data: foldersData, isLoading: foldersLoading } = useQuery({
    queryKey: ['/api/consultant/google-drive/folders-picker', currentFolderId, currentSection, isInSharedFolder],
    queryFn: async () => {
      if (isSpecialSection && !isInSharedFolder) {
        return { success: true, data: [] };
      }
      const res = await fetch(`/api/consultant/google-drive/folders?parentId=${currentFolderId}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch folders');
      return res.json();
    },
    enabled: driveStatus?.connected === true,
  });

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ['/api/consultant/google-drive/files-picker', currentFolderId, currentSection, isInSharedFolder],
    queryFn: async () => {
      let endpoint = `/api/consultant/google-drive/files?parentId=${currentFolderId}`;

      if (isInSharedFolder) {
        endpoint = `/api/consultant/google-drive/files?parentId=${currentFolderId}`;
      } else {
        switch (currentSection) {
          case 'shared-with-me':
            endpoint = `/api/consultant/google-drive/shared-with-me`;
            break;
          case 'recent':
          case 'home':
            endpoint = `/api/consultant/google-drive/recent`;
            break;
          case 'starred':
            endpoint = `/api/consultant/google-drive/starred`;
            break;
          default:
            endpoint = `/api/consultant/google-drive/files?parentId=${currentFolderId}`;
        }
      }

      const res = await fetch(endpoint, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch files');
      return res.json();
    },
    enabled: driveStatus?.connected === true,
  });

  const { data: kbDocsData } = useQuery({
    queryKey: ['/api/consultant/knowledge/documents-drive-ids'],
    queryFn: async () => {
      const res = await fetch('/api/consultant/knowledge/documents?source=google_drive', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: driveStatus?.connected === true,
    staleTime: 60000,
  });

  const fullImportedMap = useMemo(() => {
    const map = new Map(alreadyImportedMap);
    const kbDocs: any[] = kbDocsData?.data || [];
    kbDocs.forEach((doc: any) => {
      if (doc.googleDriveFileId && !map.has(doc.googleDriveFileId)) {
        map.set(doc.googleDriveFileId, { source: 'knowledge', title: doc.title, content: doc.content || '' });
      }
    });
    return map;
  }, [alreadyImportedMap, kbDocsData]);

  const rawFolders: any[] = foldersData?.data || [];
  const rawFiles: any[] = filesData?.data || [];

  const sharedFolders = isSpecialSection && isAtRootLevel
    ? rawFiles.filter((f: any) => f.mimeType === 'application/vnd.google-apps.folder')
    : [];
  const folders = isSpecialSection && isAtRootLevel ? sharedFolders : rawFolders;
  const files = isSpecialSection && isAtRootLevel
    ? rawFiles.filter((f: any) => f.mimeType !== 'application/vnd.google-apps.folder')
    : rawFiles;

  const isLoading = foldersLoading || filesLoading;

  const filteredFolders = useMemo(() =>
    searchQuery
      ? folders.filter((f: any) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : folders,
    [folders, searchQuery]
  );
  const filteredFiles = useMemo(() =>
    searchQuery
      ? files.filter((f: any) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : files,
    [files, searchQuery]
  );

  const handleSectionChange = (section: PickerDriveSection) => {
    setCurrentSection(section);
    setCurrentFolderId('root');
    const sectionLabel = PICKER_DRIVE_SECTIONS.find(s => s.id === section)?.label || 'Home page';
    setBreadcrumbs([{ id: 'root', name: sectionLabel }]);
    setSelectedFiles(new Map());
    setIsInSharedFolder(false);
    setSearchQuery('');
  };

  const navigateToFolder = (folder: { id: string; name: string }) => {
    if (isSpecialSection && !isInSharedFolder) {
      setIsInSharedFolder(true);
    }
    setCurrentFolderId(folder.id);
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFiles(new Map());
    setSearchQuery('');
  };

  const navigateToBreadcrumb = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    if (index === 0 && isSpecialSection) {
      setIsInSharedFolder(false);
    }
    setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    setSelectedFiles(new Map());
    setSearchQuery('');
  };

  const handleFileCheck = (file: { id: string; name: string }, checked: boolean) => {
    setSelectedFiles(prev => {
      const newMap = new Map(prev);
      if (checked) {
        newMap.set(file.id, { id: file.id, name: file.name });
      } else {
        newMap.delete(file.id);
      }
      return newMap;
    });
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length && filteredFiles.length > 0) {
      setSelectedFiles(new Map());
    } else {
      const newMap = new Map<string, { id: string; name: string }>();
      filteredFiles.forEach((f: any) => newMap.set(f.id, { id: f.id, name: f.name }));
      setSelectedFiles(newMap);
    }
  };

  const handleReuseExisting = (driveFileId: string, fileName: string) => {
    const existing = fullImportedMap.get(driveFileId);
    if (existing && existing.content) {
      onTextExtracted(existing.content, fileName, driveFileId);
      toast({ title: "Contenuto riutilizzato", description: `Contenuto di "${existing.title}" riutilizzato senza re-importazione` });
    } else {
      handleFileCheck({ id: driveFileId, name: fileName }, true);
      toast({ title: "Contenuto non disponibile", description: "Il file verrà re-importato da Google Drive", variant: "default" });
    }
  };

  const handleImport = async () => {
    if (selectedFiles.size === 0) return;
    setIsImporting(true);
    const filesList = Array.from(selectedFiles.values());
    setImportProgress({ current: 0, total: filesList.length });
    const filesResult: Array<{text: string; fileName: string; fileId: string}> = [];
    let errorCount = 0;

    for (let i = 0; i < filesList.length; i++) {
      setImportProgress({ current: i + 1, total: filesList.length });
      try {
        const res = await fetch('/api/consultant/knowledge/system-documents/import-drive-text', {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ fileId: filesList[i].id, fileName: filesList[i].name }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Import failed');
        }
        const result = await res.json();
        if (result.data?.text) {
          filesResult.push({ text: result.data.text, fileName: filesList[i].name, fileId: filesList[i].id });
        }
      } catch (err: any) {
        errorCount++;
        toast({ title: `Errore: ${filesList[i].name}`, description: err.message, variant: "destructive" });
      }
    }

    setIsImporting(false);
    setImportProgress({ current: 0, total: 0 });

    if (filesResult.length > 0) {
      if (onMultipleExtracted) {
        onMultipleExtracted(filesResult);
      } else {
        const concatenated = filesResult.map(f => f.text).join('\n\n---\n\n');
        const fileName = filesResult.length === 1 ? filesResult[0].fileName : `${filesResult.length} file importati`;
        const fileId = filesResult.length === 1 ? filesResult[0].fileId : undefined;
        onTextExtracted(concatenated, fileName, fileId);
      }
      setSelectedFiles(new Map());
    } else if (errorCount > 0) {
      toast({ title: "Importazione fallita", description: "Nessun testo estratto dai file selezionati", variant: "destructive" });
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("folder")) return <FolderOpen className="h-4 w-4 text-amber-500" />;
    if (mimeType.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
    if (mimeType.includes("word") || mimeType.includes("document")) return <FileText className="h-4 w-4 text-blue-600" />;
    if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("spreadsheet")) return <FileText className="h-4 w-4 text-green-600" />;
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return <FileText className="h-4 w-4 text-orange-500" />;
    if (mimeType.includes("image")) return <FileText className="h-4 w-4 text-purple-500" />;
    if (mimeType.includes("text")) return <FileText className="h-4 w-4 text-gray-500" />;
    return <FileText className="h-4 w-4 text-gray-400" />;
  };

  const formatFileSize = (size?: string) => {
    if (!size) return '';
    const bytes = parseInt(size, 10);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (driveStatusLoading) {
    return (
      <div className="border rounded-xl p-6 bg-slate-50/50 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto" />
        <p className="text-xs text-muted-foreground mt-2">Connessione a Google Drive...</p>
      </div>
    );
  }

  if (driveStatus && !driveStatus.connected) {
    return (
      <div className="border rounded-xl p-6 bg-slate-50/50 text-center space-y-3">
        <Cloud className="h-8 w-8 text-slate-400 mx-auto" />
        <div>
          <p className="text-sm font-medium text-slate-700">Google Drive non connesso</p>
          <p className="text-xs text-muted-foreground mt-1">Connetti Google Drive dalla sezione Knowledge Base per importare file</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-xl bg-white overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b flex items-center gap-2">
        <Cloud className="h-4 w-4 text-blue-500" />
        <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto flex-1">
          {breadcrumbs.map((bc, idx) => (
            <span key={`${bc.id}-${idx}`} className="flex items-center gap-1 shrink-0">
              {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-400" />}
              <button
                type="button"
                onClick={() => navigateToBreadcrumb(idx)}
                className={`hover:text-indigo-600 transition-colors ${idx === breadcrumbs.length - 1 ? 'font-medium text-slate-700' : ''}`}
              >
                {bc.name}
              </button>
            </span>
          ))}
        </div>
        {driveStatus?.email && (
          <span className="text-[10px] text-muted-foreground shrink-0">{driveStatus.email}</span>
        )}
      </div>

      <div className="flex max-h-[420px]">
        <div className="w-48 border-r bg-slate-50/50 shrink-0">
          <ScrollArea className="h-full">
            <div className="py-1">
              {PICKER_DRIVE_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => handleSectionChange(section.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                    currentSection === section.id
                      ? 'bg-indigo-50 text-indigo-700 font-medium border-r-2 border-indigo-500'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className={currentSection === section.id ? 'text-indigo-500' : 'text-slate-400'}>
                    {section.icon}
                  </span>
                  <span className="truncate">{section.label}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-3 py-2 border-b flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cerca in Drive..."
                className="pl-8 h-8 text-xs"
              />
            </div>
            {filteredFiles.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="text-[11px] h-7 px-2 shrink-0"
              >
                {selectedFiles.size === filteredFiles.length && filteredFiles.length > 0 ? 'Deseleziona tutti' : 'Seleziona tutti'}
              </Button>
            )}
          </div>

          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <span className="ml-2 text-xs text-muted-foreground">Caricamento file...</span>
              </div>
            ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FolderOpen className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-muted-foreground">Cartella vuota</p>
                <p className="text-xs text-muted-foreground mt-0.5">Nessun file o cartella in questa posizione</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredFolders.map((folder: any) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => navigateToFolder(folder)}
                    className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-blue-50 transition-colors group"
                  >
                    <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-xs truncate flex-1 group-hover:text-blue-700">{folder.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-500 shrink-0" />
                  </button>
                ))}
                {filteredFiles.map((file: any) => {
                  const imported = fullImportedMap.get(file.id);
                  const isImportedFile = !!imported;
                  return (
                    <div
                      key={file.id}
                      className={`flex items-center gap-2.5 px-3 py-2 transition-colors ${
                        selectedFiles.has(file.id) ? 'bg-indigo-50/60' : isImportedFile ? 'bg-green-50/20 hover:bg-green-50/40' : 'hover:bg-slate-50'
                      }`}
                    >
                      <Checkbox
                        checked={selectedFiles.has(file.id)}
                        onCheckedChange={(checked) => handleFileCheck(file, !!checked)}
                        className="shrink-0"
                        disabled={isImporting}
                      />
                      {getFileIcon(file.mimeType)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs truncate">{file.name}</span>
                          {isImportedFile && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0 bg-green-50 text-green-700 border-green-300">
                              {imported.source === 'system' ? 'Doc. Sistema' : 'Knowledge Base'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {file.modifiedTime && (
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(file.modifiedTime).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                          {file.size && (
                            <span className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
                          )}
                        </div>
                      </div>
                      {isImportedFile && imported.content && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReuseExisting(file.id, file.name)}
                          className="text-[10px] h-6 px-2 text-green-700 hover:text-green-800 hover:bg-green-100 shrink-0"
                        >
                          Riusa
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {(selectedFiles.size > 0 || isImporting) && (
            <div className="border-t bg-slate-50 px-3 py-2 space-y-1.5">
              {isImporting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500 shrink-0" />
                  <span className="text-xs text-indigo-700 font-medium">
                    Importazione {importProgress.current}/{importProgress.total}...
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-500 shrink-0">{selectedFiles.size} file selezionati:</span>
                    {Array.from(selectedFiles.values()).slice(0, 3).map(f => (
                      <Badge key={f.id} variant="secondary" className="text-[10px] h-5 max-w-[120px] truncate">
                        {f.name}
                      </Badge>
                    ))}
                    {selectedFiles.size > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{selectedFiles.size - 3} altri</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleImport}
                    className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Importa {selectedFiles.size} file
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SystemDocumentsSection() {
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<SystemDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<DocumentForm>(emptyForm());
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [activeTab, setActiveTab] = useState<string>('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ ai_consultant: true, ai_clients: true, ai_employees: true, whatsapp: true, autonomous: true, unassigned: true });
  const [transferDoc, setTransferDoc] = useState<SystemDocument | null>(null);
  const [transferTargets, setTransferTargets] = useState<Record<string, boolean>>({});
  const [wizardStep, setWizardStep] = useState(1);
  const [contentSource, setContentSource] = useState<'manual' | 'drive' | 'upload'>('manual');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedFileName, setExtractedFileName] = useState<string | null>(null);
  const [extractedDriveFileId, setExtractedDriveFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contentEntries, setContentEntries] = useState<ContentEntry[]>([]);
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [batchSaving, setBatchSaving] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [previewDoc, setPreviewDoc] = useState<{ type: 'system'; doc: SystemDocument } | { type: 'kb'; doc: KbDocSummary; content?: string; loading?: boolean } | null>(null);
  const [copiedContent, setCopiedContent] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: response, isLoading } = useQuery({
    queryKey: ["/api/consultant/knowledge/system-documents"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/knowledge/system-documents", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch system documents");
      return res.json();
    },
  });

  const { data: whatsappResponse } = useQuery({
    queryKey: ["/api/consultant/knowledge/whatsapp-agents"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/knowledge/whatsapp-agents", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch WhatsApp agents");
      return res.json();
    },
  });

  const { data: clientsResponse } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const { data: departmentsResponse } = useQuery({
    queryKey: ["/api/departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch departments");
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: kbDocumentsResponse } = useQuery({
    queryKey: ["/api/consultant/knowledge/documents-for-system-view"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/knowledge/documents?limit=200", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return { data: [] };
      return res.json();
    },
    staleTime: 30000,
  });

  const { data: agentAssignmentsResponse } = useQuery({
    queryKey: ["/api/consultant/knowledge/agent-assignments/by-document"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/knowledge/agent-assignments/by-document", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return { data: {} };
      return res.json();
    },
    staleTime: 30000,
  });

  const documents: SystemDocument[] = response?.data || [];
  const whatsappAgents: WhatsAppAgent[] = whatsappResponse?.data || [];
  const allClients: ClientUser[] = Array.isArray(clientsResponse) ? clientsResponse : (clientsResponse?.data || []);
  const departments: Department[] = departmentsResponse?.data || [];
  const nonEmployeeClients = allClients.filter(c => !c.isEmployee);
  const employeeClients = allClients.filter(c => c.isEmployee);

  const kbDocuments: any[] = kbDocumentsResponse?.data || [];
  const agentAssignmentsByDoc: Record<string, string[]> = agentAssignmentsResponse?.data || {};

  const kbDocsForGroups = useMemo(() => {
    return kbDocuments
      .filter((doc: any) => doc.status === 'indexed' && !doc.description?.startsWith('[SYSTEM_DOC:'))
      .map((doc: any): KbDocSummary => ({
        id: doc.id,
        title: doc.title,
        status: doc.status,
        fileType: doc.fileType,
        source: 'kb' as const,
        agentIds: agentAssignmentsByDoc[doc.id] || [],
        googleDriveFileId: doc.googleDriveFileId,
        fileSize: doc.fileSize,
        createdAt: doc.createdAt,
      }));
  }, [kbDocuments, agentAssignmentsByDoc]);

  const createMutation = useMutation({
    mutationFn: async (data: DocumentForm) => {
      const res = await fetch("/api/consultant/knowledge/system-documents", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nella creazione");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/system-documents"] });
      closeForm();
      toast({ title: "Documento creato", description: "Il documento di sistema è stato creato con successo" });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DocumentForm }) => {
      const res = await fetch(`/api/consultant/knowledge/system-documents/${id}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nell'aggiornamento");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/system-documents"] });
      closeForm();
      toast({ title: "Documento aggiornato", description: "Le modifiche sono state salvate" });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/consultant/knowledge/system-documents/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nell'eliminazione");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/system-documents"] });
      setDeletingId(null);
      toast({ title: "Documento eliminato", description: "Il documento è stato eliminato" });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/consultant/knowledge/system-documents/${id}/toggle`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel toggle");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/system-documents"] });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const [syncingDocId, setSyncingDocId] = useState<string | null>(null);

  const manualSyncMutation = useMutation({
    mutationFn: async (id: string) => {
      setSyncingDocId(id);
      const res = await fetch(`/api/consultant/knowledge/system-documents/${id}/sync`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Sync fallita");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/system-documents"] });
      toast({ title: "Sincronizzato", description: "Documento aggiornato da Google Drive" });
      setSyncingDocId(null);
    },
    onError: (err: any) => {
      toast({ title: "Errore sync", description: err.message, variant: "destructive" });
      setSyncingDocId(null);
    },
  });

  const [historyDocId, setHistoryDocId] = useState<string | null>(null);
  const [historyDocTitle, setHistoryDocTitle] = useState("");

  const { data: syncHistoryResponse, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["/api/consultant/knowledge/system-documents/sync-history", historyDocId],
    queryFn: async () => {
      const res = await fetch(`/api/consultant/knowledge/system-documents/${historyDocId}/sync-history`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch sync history");
      return res.json();
    },
    enabled: !!historyDocId,
  });

  const syncHistory: any[] = syncHistoryResponse?.data || [];

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return dateStr; }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingDoc(null);
    setForm(emptyForm());
    setAgentsOpen(false);
    setWizardStep(1);
    setContentSource('manual');
    setExtractedFileName(null);
    setExtractedDriveFileId(null);
    setContentEntries([]);
    setManualTitle('');
    setManualContent('');
    setManualDescription('');
    setEditingEntryId(null);
  };

  const openCreate = () => {
    setEditingDoc(null);
    const newForm = emptyForm();
    if (whatsappAgents.length > 0) {
      newForm.target_whatsapp_agents = Object.fromEntries(whatsappAgents.map(a => [a.id, false]));
    }
    setForm(newForm);
    setShowForm(true);
    setWizardStep(1);
    setContentSource('manual');
    setExtractedFileName(null);
    setContentEntries([]);
    setManualTitle('');
    setManualContent('');
    setManualDescription('');
    setEditingEntryId(null);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const openEdit = (doc: SystemDocument) => {
    setEditingDoc(doc);
    const waAgents = whatsappAgents.length > 0
      ? { ...Object.fromEntries(whatsappAgents.map(a => [a.id, false])), ...(doc.target_whatsapp_agents || {}) }
      : (doc.target_whatsapp_agents || {});
    setForm({
      title: doc.title,
      content: doc.content,
      description: doc.description || "",
      target_client_assistant: doc.target_client_assistant,
      target_client_mode: doc.target_client_mode || 'all',
      target_client_ids: doc.target_client_ids || [],
      target_department_ids: doc.target_department_ids || [],
      target_autonomous_agents: { ...Object.fromEntries(AUTONOMOUS_AGENTS.map(a => [a.id, false])), ...doc.target_autonomous_agents },
      target_whatsapp_agents: waAgents,
      injection_mode: doc.injection_mode || "system_prompt",
      priority: doc.priority,
    });
    setShowForm(true);
    setWizardStep(1);
  };

  const addContentEntry = (content: string, title: string, sourceType: 'manual' | 'drive' | 'upload', sourceFileName?: string, description?: string, driveFileId?: string) => {
    const cleanTitle = title.replace(/\.[^/.]+$/, '');
    setContentEntries(prev => [...prev, {
      id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: cleanTitle,
      content,
      description: description || '',
      sourceType,
      sourceFileName,
      driveFileId,
    }]);
  };

  const handleSubmit = async () => {
    if (editingDoc) {
      if (!form.title.trim() || !form.content.trim()) {
        toast({ title: "Campi obbligatori", description: "Titolo e contenuto sono obbligatori", variant: "destructive" });
        return;
      }
    } else {
      if (contentEntries.length === 0) {
        toast({ title: "Nessun contenuto", description: "Aggiungi almeno un documento", variant: "destructive" });
        return;
      }
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmedSubmit = async () => {
    setShowConfirmDialog(false);
    if (editingDoc) {
      updateMutation.mutate({ id: editingDoc.id, data: form });
    } else {
      setBatchSaving(true);
      let successCount = 0;
      let errorCount = 0;
      for (const entry of contentEntries) {
        try {
          const docData: DocumentForm & { google_drive_file_id?: string } = {
            ...form,
            title: entry.title || 'Documento senza titolo',
            content: entry.content,
            description: entry.description,
          };
          if (entry.driveFileId) {
            docData.google_drive_file_id = entry.driveFileId;
          }
          const res = await fetch("/api/consultant/knowledge/system-documents", {
            method: "POST",
            headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify(docData),
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Errore nella creazione");
          }
          successCount++;
        } catch (err: any) {
          errorCount++;
          console.error(`Error creating doc "${entry.title}":`, err);
        }
      }
      setBatchSaving(false);
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/system-documents"] });
      closeForm();
      if (errorCount === 0) {
        toast({ title: "Documenti creati", description: `${successCount} documento${successCount !== 1 ? 'i' : ''} creato${successCount !== 1 ? 'i' : ''} con successo` });
      } else {
        toast({ title: "Creazione parziale", description: `${successCount} creati, ${errorCount} errori`, variant: "destructive" });
      }
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/consultant/knowledge/system-documents/extract-text', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Errore nell\'estrazione');
      }
      const result = await res.json();
      if (editingDoc) {
        setForm(f => ({ ...f, content: result.data.text, title: f.title || file.name.replace(/\.[^/.]+$/, '') }));
        setExtractedFileName(file.name);
        setContentSource('manual');
      } else {
        addContentEntry(result.data.text, file.name, 'upload', file.name);
      }
      toast({ title: "Contenuto importato", description: `${result.data.characters.toLocaleString()} caratteri estratti da "${file.name}"` });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || batchSaving;

  const getTargetBadges = (doc: SystemDocument) => {
    const badges: { label: string; icon: React.ReactNode; colorClass: string }[] = [];

    badges.push({
      label: doc.injection_mode === "file_search" ? "File Search" : "System Prompt",
      icon: doc.injection_mode === "file_search" ? <Search className="h-3 w-3" /> : <StickyNote className="h-3 w-3" />,
      colorClass: doc.injection_mode === "file_search" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-slate-100 text-slate-800 border-slate-200",
    });

    if (doc.target_client_assistant) {
      const mode = doc.target_client_mode || 'all';
      if (mode === 'consultant_only') {
        badges.push({ label: 'Solo per me', icon: <Lock className="h-3 w-3" />, colorClass: "bg-amber-100 text-amber-800 border-amber-200" });
      } else if (mode === 'all') {
        badges.push({ label: 'Tutti', icon: <Globe className="h-3 w-3" />, colorClass: "bg-indigo-100 text-indigo-800 border-indigo-200" });
      } else if (mode === 'clients_only' || mode === 'specific_clients') {
        const modeLabel = getTargetModeLabel(doc);
        badges.push({ label: `Clienti — ${modeLabel}`, icon: <UserRound className="h-3 w-3" />, colorClass: "bg-blue-100 text-blue-800 border-blue-200" });
      } else if (mode === 'employees_only' || mode === 'specific_departments' || mode === 'specific_employees') {
        const modeLabel = getTargetModeLabel(doc);
        badges.push({ label: `Dipendenti — ${modeLabel}`, icon: <HardHat className="h-3 w-3" />, colorClass: "bg-emerald-100 text-emerald-800 border-emerald-200" });
      }
    }

    const activeWhatsapp = Object.entries(doc.target_whatsapp_agents || {})
      .filter(([, v]) => v)
      .map(([k]) => k);
    activeWhatsapp.forEach(agentId => {
      const agent = whatsappAgents.find(a => a.id === agentId);
      badges.push({
        label: agent?.agent_name || agentId.slice(0, 8),
        icon: <MessageCircle className="h-3 w-3" />,
        colorClass: "bg-green-100 text-green-800 border-green-200",
      });
    });

    const activeAgents = Object.entries(doc.target_autonomous_agents || {})
      .filter(([, v]) => v)
      .map(([k]) => k);
    activeAgents.forEach(agentId => {
      const agent = AUTONOMOUS_AGENTS.find(a => a.id === agentId);
      if (agent) {
        badges.push({ label: agent.name, icon: <Bot className="h-3 w-3" />, colorClass: "bg-purple-100 text-purple-800 border-purple-200" });
      }
    });
    return badges;
  };

  const sortedDocuments = [...documents].sort((a, b) => b.priority - a.priority);

  const hasWhatsappTargets = (doc: SystemDocument) =>
    Object.values(doc.target_whatsapp_agents || {}).some(Boolean);

  const hasAutonomousTargets = (doc: SystemDocument) =>
    Object.values(doc.target_autonomous_agents || {}).some(Boolean);

  const isUnassigned = (doc: SystemDocument) =>
    !doc.target_client_assistant && !hasWhatsappTargets(doc) && !hasAutonomousTargets(doc);

  const getDocGroups = (doc: SystemDocument) => {
    const groups: string[] = [];
    if (doc.target_client_assistant) {
      const mode = doc.target_client_mode || 'all';
      if (mode === 'consultant_only') {
        groups.push('ai_consultant_only');
      } else if (mode === 'all') {
        groups.push('ai_consultant');
      } else if (mode === 'clients_only' || mode === 'specific_clients') {
        groups.push('ai_clients');
      } else if (mode === 'employees_only' || mode === 'specific_departments' || mode === 'specific_employees') {
        groups.push('ai_employees');
      } else {
        groups.push('ai_consultant');
      }
    }
    if (hasWhatsappTargets(doc)) groups.push('whatsapp');
    if (hasAutonomousTargets(doc)) groups.push('autonomous');
    if (groups.length === 0) groups.push('unassigned');
    return groups;
  };

  const groupLabelMap: Record<string, string> = {
    ai_consultant_only: 'Solo per me (privato)',
    ai_consultant: 'AI per Tutti (Clienti + Dipendenti)',
    ai_clients: 'AI per Clienti',
    ai_employees: 'AI per Dipendenti',
    whatsapp: 'Dipendenti WhatsApp',
    autonomous: 'Agenti Autonomi',
    unassigned: 'Non assegnati',
  };

  const aiDocs = sortedDocuments.filter(d => d.target_client_assistant);
  const aiDocsConsultantOnly = aiDocs.filter(d => {
    const mode = d.target_client_mode || 'all';
    return mode === 'consultant_only';
  });
  const aiDocsConsultant = aiDocs.filter(d => {
    const mode = d.target_client_mode || 'all';
    return mode === 'all';
  });
  const aiDocsClients = aiDocs.filter(d => {
    const mode = d.target_client_mode || 'all';
    return mode === 'clients_only' || mode === 'specific_clients';
  });
  const aiDocsEmployees = aiDocs.filter(d => {
    const mode = d.target_client_mode || 'all';
    return mode === 'employees_only' || mode === 'specific_departments' || mode === 'specific_employees';
  });
  const whatsappDocs = sortedDocuments.filter(d => hasWhatsappTargets(d));
  const autonomousDocs = sortedDocuments.filter(d => hasAutonomousTargets(d));
  const unassignedDocs = sortedDocuments.filter(d => isUnassigned(d));

  const kbDocsConsultantOnly = kbDocsForGroups;
  const kbDocsAutonomous = kbDocsForGroups.filter(d => d.agentIds.length > 0);

  const effectiveActiveTab = useMemo(() => {
    if (activeTab) return activeTab;
    const tabCounts = [
      { key: 'ai_consultant_only', count: aiDocsConsultantOnly.length + kbDocsConsultantOnly.length },
      { key: 'ai_consultant', count: aiDocsConsultant.length },
      { key: 'ai_clients', count: aiDocsClients.length },
      { key: 'ai_employees', count: aiDocsEmployees.length },
      { key: 'whatsapp', count: whatsappDocs.length },
      { key: 'autonomous', count: autonomousDocs.length + kbDocsAutonomous.length },
      { key: 'unassigned', count: unassignedDocs.length },
    ];
    const firstNonEmpty = tabCounts.find(t => t.count > 0);
    return firstNonEmpty?.key || 'ai_consultant_only';
  }, [activeTab, aiDocsConsultantOnly.length, kbDocsConsultantOnly.length, aiDocsConsultant.length, aiDocsClients.length, aiDocsEmployees.length, whatsappDocs.length, autonomousDocs.length, kbDocsAutonomous.length, unassignedDocs.length]);

  const getDepartmentNames = (deptIds: string[]) => {
    return deptIds.map(id => {
      const dept = departments.find(d => d.id === id);
      return dept?.name || id.slice(0, 8);
    });
  };

  const getClientNames = (clientIds: string[], fromList: ClientUser[]) => {
    return clientIds.map(id => {
      const client = fromList.find(c => c.id === id);
      return client ? `${client.firstName} ${client.lastName}` : id.slice(0, 8);
    });
  };

  const getTargetModeLabel = (doc: SystemDocument) => {
    const mode = doc.target_client_mode || 'all';
    if (mode === 'consultant_only') return 'Solo per me';
    if (mode === 'all') return 'Tutti';
    if (mode === 'clients_only') return 'Tutti i clienti';
    if (mode === 'employees_only') return 'Tutti i dipendenti';
    if (mode === 'specific_clients') {
      const names = getClientNames(doc.target_client_ids || [], nonEmployeeClients);
      return names.length > 0 ? names.join(', ') : 'Clienti specifici';
    }
    if (mode === 'specific_departments') {
      const names = getDepartmentNames(doc.target_department_ids || []);
      return names.length > 0 ? names.join(', ') : 'Reparti';
    }
    if (mode === 'specific_employees') {
      const names = getClientNames(doc.target_client_ids || [], employeeClients);
      return names.length > 0 ? names.join(', ') : 'Dipendenti specifici';
    }
    return mode;
  };

  const getWhatsappAgentNames = (doc: SystemDocument) => {
    return Object.entries(doc.target_whatsapp_agents || {})
      .filter(([, v]) => v)
      .map(([k]) => {
        const agent = whatsappAgents.find(a => a.id === k);
        return agent?.agent_name || k.slice(0, 8);
      });
  };

  const getAutonomousAgentNames = (doc: SystemDocument) => {
    return Object.entries(doc.target_autonomous_agents || {})
      .filter(([, v]) => v)
      .map(([k]) => {
        const agent = AUTONOMOUS_AGENTS.find(a => a.id === k);
        return agent?.name || k;
      });
  };

  const openPreviewSysDoc = (doc: SystemDocument) => {
    setPreviewDoc({ type: 'system', doc });
    setCopiedContent(false);
  };

  const openPreviewKbDoc = async (kbDoc: KbDocSummary) => {
    setPreviewDoc({ type: 'kb', doc: kbDoc, loading: true });
    setCopiedContent(false);
    try {
      const res = await fetch(`/api/consultant/knowledge/documents/${kbDoc.id}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      const content = result.data?.content || result.content || '';
      setPreviewDoc({ type: 'kb', doc: kbDoc, content, loading: false });
    } catch {
      setPreviewDoc({ type: 'kb', doc: kbDoc, content: 'Impossibile caricare il contenuto del documento.', loading: false });
    }
  };

  const handleCopyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedContent(true);
    setTimeout(() => setCopiedContent(false), 2000);
  };

  const openTransferDialog = (doc: SystemDocument) => {
    const currentGroups = getDocGroups(doc);
    const targets: Record<string, boolean> = {};
    ['ai_consultant_only', 'ai_consultant', 'ai_clients', 'ai_employees', 'whatsapp', 'autonomous'].forEach(g => {
      targets[g] = currentGroups.includes(g);
    });
    setTransferTargets(targets);
    setTransferDoc(doc);
  };

  const transferMutation = useMutation({
    mutationFn: async ({ doc, targets }: { doc: SystemDocument; targets: Record<string, boolean> }) => {
      const updatedData: any = {
        title: doc.title,
        content: doc.content,
        description: doc.description || '',
        injection_mode: doc.injection_mode || 'system_prompt',
        priority: doc.priority || 0,
        is_active: doc.is_active,
        target_client_assistant: false,
        target_client_mode: doc.target_client_mode || 'all',
        target_client_ids: doc.target_client_ids || [],
        target_department_ids: doc.target_department_ids || [],
        target_whatsapp_agents: doc.target_whatsapp_agents || {},
        target_autonomous_agents: doc.target_autonomous_agents || {},
      };

      const hasAiTarget = targets.ai_consultant_only || targets.ai_consultant || targets.ai_clients || targets.ai_employees;
      if (hasAiTarget) {
        updatedData.target_client_assistant = true;
        if (targets.ai_consultant_only) {
          updatedData.target_client_mode = 'consultant_only';
        } else if (targets.ai_consultant) {
          updatedData.target_client_mode = 'all';
        } else if (targets.ai_clients) {
          const currentMode = doc.target_client_mode;
          updatedData.target_client_mode = currentMode === 'specific_clients' ? 'specific_clients' : 'clients_only';
          updatedData.target_client_ids = doc.target_client_ids || [];
        } else if (targets.ai_employees) {
          const currentMode = doc.target_client_mode;
          if (currentMode === 'specific_employees' || currentMode === 'specific_departments') {
            updatedData.target_client_mode = currentMode;
          } else {
            updatedData.target_client_mode = 'employees_only';
          }
          updatedData.target_client_ids = doc.target_client_ids || [];
          updatedData.target_department_ids = doc.target_department_ids || [];
        }
      } else {
        updatedData.target_client_assistant = false;
        updatedData.target_client_mode = 'all';
      }

      if (!targets.whatsapp) {
        updatedData.target_whatsapp_agents = {};
      }

      if (!targets.autonomous) {
        updatedData.target_autonomous_agents = {};
      }

      if (targets.whatsapp && !Object.values(doc.target_whatsapp_agents || {}).some(v => v)) {
        toast({ title: "Attenzione", description: "Per aggiungere il documento a WhatsApp, prima modifica il documento e seleziona gli agenti WhatsApp specifici.", variant: "destructive" });
        throw new Error("Seleziona prima gli agenti WhatsApp dal modulo di modifica");
      }

      if (targets.autonomous && !Object.values(doc.target_autonomous_agents || {}).some(v => v)) {
        toast({ title: "Attenzione", description: "Per aggiungere il documento agli Agenti Autonomi, prima modifica il documento e seleziona gli agenti specifici.", variant: "destructive" });
        throw new Error("Seleziona prima gli agenti autonomi dal modulo di modifica");
      }

      const res = await fetch(`/api/consultant/knowledge/system-documents/${doc.id}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel trasferimento");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/system-documents"] });
      setTransferDoc(null);
      toast({ title: "Destinazioni aggiornate", description: "Il documento è stato spostato nelle sezioni selezionate." });
    },
    onError: (error: Error) => {
      if (!error.message.includes('Seleziona prima')) {
        toast({ title: "Errore", description: error.message, variant: "destructive" });
      }
    },
  });

  const [deletionDoc, setDeletionDoc] = useState<SystemDocument | null>(null);
  const [deletionTargets, setDeletionTargets] = useState<Record<string, boolean>>({});

  const openDeletionDialog = (doc: SystemDocument) => {
    const currentGroups = getDocGroups(doc);
    if (currentGroups.length <= 1) {
      setDeletingId(doc.id);
      return;
    }
    const targets: Record<string, boolean> = {};
    currentGroups.forEach(g => { targets[g] = true; });
    setDeletionTargets(targets);
    setDeletionDoc(doc);
  };

  const handleSelectiveDeletion = () => {
    if (!deletionDoc) return;
    const currentGroups = getDocGroups(deletionDoc);
    const groupsToKeep = Object.entries(deletionTargets).filter(([, v]) => !v).map(([k]) => k);
    const allRemoved = groupsToKeep.length === 0;

    if (allRemoved) {
      setDeletionDoc(null);
      setDeletingId(deletionDoc.id);
      return;
    }

    const updatedTargets: Record<string, boolean> = {};
    groupsToKeep.forEach(g => { updatedTargets[g] = true; });
    transferMutation.mutate({ doc: deletionDoc, targets: updatedTargets });
    setDeletionDoc(null);
  };

  const renderDocumentCard = (doc: SystemDocument, currentGroup?: string) => {
    const badges = getTargetBadges(doc);
    const isGoogleDriveDoc = !!doc.google_drive_file_id;
    const docGroups = getDocGroups(doc);
    const otherGroups = currentGroup ? docGroups.filter(g => g !== currentGroup) : [];

    return (
      <div
        key={`${doc.id}-${currentGroup || 'flat'}`}
        className={`border rounded-lg p-4 transition-colors ${
          doc.is_active
            ? "bg-card hover:bg-accent/30"
            : "bg-muted/30 opacity-70"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium truncate">{doc.title}</h4>
              <Badge variant={doc.is_active ? "default" : "secondary"} className="text-xs shrink-0">
                {doc.is_active ? "Attivo" : "Inattivo"}
              </Badge>
              <Badge variant="outline" className="text-xs shrink-0">
                Priorità {doc.priority}
              </Badge>
              {isGoogleDriveDoc && (
                <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                  <Cloud className="w-3 h-3" />
                  Google Drive
                </span>
              )}
            </div>
            {doc.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{doc.description}</p>
            )}

            {isGoogleDriveDoc && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {doc.sync_count != null && doc.sync_count > 0 && (
                  <span className="flex items-center gap-1 text-xs text-blue-600">
                    <RefreshCw className="w-3 h-3" />
                    {doc.sync_count} sincronizzazioni
                  </span>
                )}
                {doc.last_drive_sync_at && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    Ultimo sync: {formatDate(doc.last_drive_sync_at)}
                  </span>
                )}
                {doc.pending_sync_at && (
                  <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                    <Clock className="w-3 h-3" />
                    Sync programmato: {formatDate(doc.pending_sync_at)}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => manualSyncMutation.mutate(doc.id)}
                  disabled={syncingDocId === doc.id}
                >
                  <RefreshCw className={`w-3 h-3 mr-1 ${syncingDocId === doc.id ? 'animate-spin' : ''}`} />
                  {syncingDocId === doc.id ? 'Sincronizzando...' : 'Sincronizza ora'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  onClick={() => { setHistoryDocId(doc.id); setHistoryDocTitle(doc.title); }}
                >
                  <History className="w-3 h-3 mr-1" />
                  Cronologia
                </Button>
              </div>
            )}

            {badges.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {badges.map((b, i) => (
                  <Badge key={i} variant="outline" className={`text-xs gap-1 py-0.5 ${b.colorClass}`}>
                    {b.icon}
                    {b.label}
                  </Badge>
                ))}
              </div>
            )}

            {doc.injection_mode === 'file_search' && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {doc.file_search_stores && doc.file_search_stores.length > 0 ? (
                  doc.file_search_stores.map((store, idx) => (
                    <span key={idx} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Database className="h-2.5 w-2.5" />
                      {store.storeName || store.storeOwnerId}
                      {store.documentStatus === 'indexed' ? (
                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                      ) : (
                        <Clock className="h-2.5 w-2.5 text-amber-500" />
                      )}
                    </span>
                  ))
                ) : (
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                    <AlertCircle className="h-2.5 w-2.5" />
                    Non sincronizzato in nessuno store
                  </span>
                )}
              </div>
            )}

            {otherGroups.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5 italic">
                Appare anche in: {otherGroups.map(g => groupLabelMap[g]).join(', ')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50" onClick={() => openPreviewSysDoc(doc)} title="Visualizza">
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-teal-500 hover:text-teal-700 hover:bg-teal-50" onClick={() => openTransferDialog(doc)} title="Trasferisci/Condividi">
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
            <Switch
              checked={doc.is_active}
              onCheckedChange={() => toggleMutation.mutate(doc.id)}
              aria-label="Attiva/disattiva documento"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(doc)}>
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDeletionDialog(doc)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderKbDocumentCard = (kbDoc: KbDocSummary, currentGroup?: string) => {
    const agentNames = kbDoc.agentIds.map(id => {
      const agent = AUTONOMOUS_AGENTS.find(a => a.id === id);
      return agent?.name || id;
    });
    const isGoogleDriveDoc = !!kbDoc.googleDriveFileId;
    const otherGroups: string[] = [];
    if (currentGroup === 'ai_consultant_only' && kbDoc.agentIds.length > 0) otherGroups.push('autonomous');
    if (currentGroup === 'autonomous') otherGroups.push('ai_consultant_only');

    return (
      <div
        key={`kb-${kbDoc.id}-${currentGroup || 'flat'}`}
        className="border rounded-lg p-4 transition-colors bg-amber-50/30 hover:bg-amber-50/50 border-amber-200"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium truncate">{kbDoc.title}</h4>
              <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-300 shrink-0">
                Knowledge Base
              </Badge>
              {kbDoc.fileType && (
                <span className="text-[10px] text-slate-500 uppercase">{kbDoc.fileType}</span>
              )}
              {isGoogleDriveDoc && (
                <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                  <Cloud className="w-3 h-3" />
                  Google Drive
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] text-cyan-600 bg-cyan-50 px-1.5 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                AI Consulente
              </span>
              {agentNames.map(name => (
                <span key={name} className="flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
                  <Bot className="w-3 h-3" />
                  {name}
                </span>
              ))}
            </div>
            {otherGroups.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5 italic">
                Appare anche in: {otherGroups.map(g => groupLabelMap[g]).join(', ')}
              </p>
            )}
          </div>
          <div className="shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50" onClick={() => openPreviewKbDoc(kbDoc)} title="Visualizza">
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const emptyGroupHints: Record<string, string> = {
    ai_consultant: 'Aggiungi istruzioni generali per guidare il comportamento del tuo AI Assistant',
    ai_clients: 'Crea documenti personalizzati visibili solo ai tuoi clienti nell\'AI Assistant',
    ai_employees: 'Configura istruzioni specifiche per reparti o dipendenti',
    whatsapp: 'Collega documenti ai tuoi dipendenti WhatsApp per risposte automatiche',
    autonomous: 'Assegna documenti agli agenti autonomi per arricchire il loro contesto',
    unassigned: 'I documenti senza destinatario non saranno visibili a nessun canale AI',
  };

  const renderAutonomousGroupedSection = (
    sysDocs: SystemDocument[],
    kbDocs: KbDocSummary[],
  ) => {
    const totalCount = sysDocs.length + kbDocs.length;
    const isEmpty = totalCount === 0;
    const isOpen = openGroups['autonomous'] ?? !isEmpty;
    const colorClasses = { border: 'border-purple-300', bg: 'bg-purple-50/30', headerBg: 'bg-purple-50/50', badge: 'bg-purple-100 text-purple-700 border-purple-200', iconBg: 'bg-purple-100', text: 'text-purple-800' };

    const agentDocMap = new Map<string, { sysDocs: SystemDocument[]; kbDocs: KbDocSummary[] }>();
    AUTONOMOUS_AGENTS.forEach(agent => {
      agentDocMap.set(agent.id, { sysDocs: [], kbDocs: [] });
    });
    sysDocs.forEach(doc => {
      Object.entries(doc.target_autonomous_agents || {}).filter(([, v]) => v).forEach(([agentId]) => {
        const entry = agentDocMap.get(agentId);
        if (entry) entry.sysDocs.push(doc);
      });
    });
    kbDocs.forEach(kbDoc => {
      kbDoc.agentIds.forEach(agentId => {
        const entry = agentDocMap.get(agentId);
        if (entry) entry.kbDocs.push(kbDoc);
      });
    });

    const agentsWithDocs = AUTONOMOUS_AGENTS.filter(agent => {
      const entry = agentDocMap.get(agent.id);
      return entry && (entry.sysDocs.length > 0 || entry.kbDocs.length > 0);
    });

    return (
      <div key="autonomous">
          {isEmpty ? (
            <div className="py-8 flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Bot className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-xs text-slate-400 text-center max-w-[280px]">
                {emptyGroupHints['autonomous'] || 'Nessun documento assegnato agli agenti autonomi'}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 mt-1"
                onClick={openCreate}
              >
                <Plus className="h-3 w-3 mr-1" />
                Aggiungi documento
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {agentsWithDocs.map(agent => {
                const profile = AI_ROLE_PROFILES[agent.id];
                const entry = agentDocMap.get(agent.id)!;
                const agentTotal = entry.sysDocs.length + entry.kbDocs.length;
                const agentOpen = openGroups[`autonomous_${agent.id}`] ?? true;

                return (
                  <Collapsible
                    key={`autonomous_${agent.id}`}
                    open={agentOpen}
                    onOpenChange={(open) => setOpenGroups(prev => ({ ...prev, [`autonomous_${agent.id}`]: open }))}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-purple-200 bg-purple-50/40 hover:bg-purple-50/70 cursor-pointer transition-all">
                        {profile?.avatar ? (
                          <img
                            src={profile.avatar}
                            alt={agent.name}
                            className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-300 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-purple-200 flex items-center justify-center ring-2 ring-purple-300 shrink-0">
                            <Bot className="h-4 w-4 text-purple-700" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-purple-900">{agent.name}</span>
                            {profile?.role && (
                              <span className="text-[10px] text-purple-500 font-medium">{profile.role}</span>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-purple-100 text-purple-700 border-purple-200 shrink-0">
                          {agentTotal}
                        </Badge>
                        <ChevronDown className={`h-3.5 w-3.5 text-purple-400 transition-transform ${agentOpen ? "rotate-180" : ""}`} />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 mt-1.5 ml-5 border-l-2 border-purple-100 pl-3">
                        {entry.sysDocs.map(doc => (
                          <div key={doc.id}>
                            {renderDocumentCard(doc, 'autonomous')}
                          </div>
                        ))}
                        {entry.kbDocs.length > 0 && (
                          <>
                            {entry.sysDocs.length > 0 && (
                              <div className="flex items-center gap-2 pt-1">
                                <div className="h-px flex-1 bg-amber-200" />
                                <span className="text-[10px] text-amber-500 font-medium whitespace-nowrap">Dalla Knowledge Base</span>
                                <div className="h-px flex-1 bg-amber-200" />
                              </div>
                            )}
                            {entry.kbDocs.map(kbDoc => (
                              <div key={`kb-${kbDoc.id}`}>
                                {renderKbDocumentCard(kbDoc, 'autonomous')}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
      </div>
    );
  };

  const renderGroupSection = (
    groupKey: string,
    label: string,
    icon: React.ReactNode,
    docs: SystemDocument[],
    colorClasses: { border: string; bg: string; headerBg: string; badge: string; iconBg: string; text: string },
    subInfoFn?: (doc: SystemDocument) => string | null,
    kbDocs?: KbDocSummary[],
  ) => {
    const totalCount = docs.length + (kbDocs?.length || 0);
    const isEmpty = totalCount === 0;
    const isOpen = openGroups[groupKey] ?? !isEmpty;

    return (
      <Collapsible
        key={groupKey}
        open={isOpen}
        onOpenChange={(open) => setOpenGroups(prev => ({ ...prev, [groupKey]: open }))}
      >
        <CollapsibleTrigger asChild>
          <div className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-all ${
            isEmpty
              ? 'border-dashed border-slate-200 bg-slate-50/30 hover:bg-slate-50/60'
              : `border-2 ${colorClasses.border} ${colorClasses.headerBg} hover:shadow-sm`
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${isEmpty ? 'bg-slate-100/80' : colorClasses.iconBg}`}>
                {isEmpty ? <span className="opacity-40">{icon}</span> : icon}
              </div>
              <span className={`text-sm font-semibold ${isEmpty ? 'text-slate-400' : colorClasses.text}`}>{label}</span>
              {isEmpty ? (
                <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">—</span>
              ) : (
                <Badge variant="outline" className={`text-xs ${colorClasses.badge}`}>
                  {totalCount}
                </Badge>
              )}
            </div>
            <ChevronDown className={`h-4 w-4 transition-transform ${isEmpty ? 'text-slate-300' : 'text-muted-foreground'} ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {isEmpty ? (
            <div className="py-5 flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <span className="opacity-30">{icon}</span>
              </div>
              <p className="text-xs text-slate-400 text-center max-w-[280px]">
                {emptyGroupHints[groupKey] || 'Nessun documento in questo gruppo'}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 mt-1"
                onClick={openCreate}
              >
                <Plus className="h-3 w-3 mr-1" />
                Aggiungi documento
              </Button>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              {docs.map(doc => {
                const subInfo = subInfoFn?.(doc);
                return (
                  <div key={doc.id}>
                    {subInfo && (
                      <div className="mb-1 ml-2">
                        <span className={`text-xs font-medium ${colorClasses.text}`}>{subInfo}</span>
                      </div>
                    )}
                    {renderDocumentCard(doc, groupKey)}
                  </div>
                );
              })}
              {kbDocs && kbDocs.length > 0 && (
                <>
                  {docs.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <div className="h-px flex-1 bg-amber-200" />
                      <span className="text-[10px] text-amber-500 font-medium whitespace-nowrap">Dalla Knowledge Base</span>
                      <div className="h-px flex-1 bg-amber-200" />
                    </div>
                  )}
                  {kbDocs.map(kbDoc => (
                    <div key={`kb-${kbDoc.id}`}>
                      {renderKbDocumentCard(kbDoc, groupKey)}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const wizardSteps = [
    { num: 1, label: 'Informazioni Base', icon: <FileText className="h-4 w-4" /> },
    { num: 2, label: 'Configurazione', icon: <StickyNote className="h-4 w-4" /> },
    { num: 3, label: 'Destinatari', icon: <Users className="h-4 w-4" /> },
  ];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-indigo-500" />
              Documenti di Sistema
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Istruzioni personalizzate per l'AI — scegli se iniettarle nel System Prompt o nel File Search
            </p>
          </div>
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nuovo Documento
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedDocuments.length === 0 && kbDocsForGroups.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <FileText className="h-8 w-8 text-indigo-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-1.5">Nessun documento di sistema</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
                I documenti di sistema iniettano istruzioni personalizzate nel tuo AI Assistant, nei dipendenti WhatsApp e negli agenti autonomi.
              </p>
              <div className="flex flex-wrap justify-center gap-3 mb-6 max-w-lg mx-auto">
                {[
                  { icon: <Sparkles className="h-3.5 w-3.5 text-indigo-500" />, text: 'System Prompt', desc: 'Sempre in memoria' },
                  { icon: <Search className="h-3.5 w-3.5 text-amber-500" />, text: 'File Search', desc: 'Solo quando rilevante' },
                  { icon: <Cloud className="h-3.5 w-3.5 text-blue-500" />, text: 'Google Drive', desc: 'Sync automatico' },
                ].map(f => (
                  <div key={f.text} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-[11px]">
                    {f.icon}
                    <span className="font-medium text-slate-600">{f.text}</span>
                    <span className="text-slate-400">· {f.desc}</span>
                  </div>
                ))}
              </div>
              <Button onClick={openCreate} size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="h-4 w-4" />
                Crea il primo documento
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`flex items-center gap-1.5 text-sm font-medium pb-1 transition-colors ${
                    viewMode === 'grouped'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Per destinatario
                </button>
                <button
                  onClick={() => setViewMode('flat')}
                  className={`flex items-center gap-1.5 text-sm font-medium pb-1 transition-colors ${
                    viewMode === 'flat'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  Lista
                </button>
              </div>

              {viewMode === 'flat' ? (
                <div className="space-y-3">
                  {sortedDocuments.map(doc => renderDocumentCard(doc))}
                </div>
              ) : (
                <div>
                  {(() => {
                    const tabDefs = [
                      { key: 'ai_consultant_only', label: 'Solo per me', icon: <Lock className="h-3.5 w-3.5" />, count: aiDocsConsultantOnly.length + kbDocsConsultantOnly.length, color: 'amber' },
                      { key: 'ai_consultant', label: 'AI per Tutti', icon: <Globe className="h-3.5 w-3.5" />, count: aiDocsConsultant.length, color: 'indigo' },
                      { key: 'ai_clients', label: 'Clienti', icon: <UserRound className="h-3.5 w-3.5" />, count: aiDocsClients.length, color: 'blue' },
                      { key: 'ai_employees', label: 'Dipendenti', icon: <HardHat className="h-3.5 w-3.5" />, count: aiDocsEmployees.length, color: 'emerald' },
                      { key: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="h-3.5 w-3.5" />, count: whatsappDocs.length, color: 'green' },
                      { key: 'autonomous', label: 'Agenti', icon: <Bot className="h-3.5 w-3.5" />, count: autonomousDocs.length + kbDocsAutonomous.length, color: 'purple' },
                      { key: 'unassigned', label: 'Non assegnati', icon: <AlertTriangle className="h-3.5 w-3.5" />, count: unassignedDocs.length, color: 'orange' },
                    ];
                    const colorMap: Record<string, { active: string; inactive: string; ring: string }> = {
                      amber: { active: 'bg-amber-100 text-amber-800 border-amber-300', inactive: 'text-amber-600 hover:bg-amber-50', ring: 'ring-amber-200' },
                      indigo: { active: 'bg-indigo-100 text-indigo-800 border-indigo-300', inactive: 'text-indigo-600 hover:bg-indigo-50', ring: 'ring-indigo-200' },
                      blue: { active: 'bg-blue-100 text-blue-800 border-blue-300', inactive: 'text-blue-600 hover:bg-blue-50', ring: 'ring-blue-200' },
                      emerald: { active: 'bg-emerald-100 text-emerald-800 border-emerald-300', inactive: 'text-emerald-600 hover:bg-emerald-50', ring: 'ring-emerald-200' },
                      green: { active: 'bg-green-100 text-green-800 border-green-300', inactive: 'text-green-600 hover:bg-green-50', ring: 'ring-green-200' },
                      purple: { active: 'bg-purple-100 text-purple-800 border-purple-300', inactive: 'text-purple-600 hover:bg-purple-50', ring: 'ring-purple-200' },
                      orange: { active: 'bg-orange-100 text-orange-800 border-orange-300', inactive: 'text-orange-600 hover:bg-orange-50', ring: 'ring-orange-200' },
                    };
                    return (
                      <>
                        <div className="flex items-center gap-1 overflow-x-auto pb-3 mb-3 border-b border-slate-200 scrollbar-hide">
                          {tabDefs.map(tab => {
                            const isActive = effectiveActiveTab === tab.key;
                            const colors = colorMap[tab.color];
                            return (
                              <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap shrink-0 ${
                                  isActive
                                    ? `${colors.active} border shadow-sm`
                                    : `${colors.inactive} border-transparent`
                                }`}
                              >
                                {tab.icon}
                                {tab.label}
                                {tab.count > 0 && (
                                  <span className={`ml-0.5 text-[10px] font-bold ${isActive ? '' : 'opacity-70'}`}>
                                    {tab.count}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          <span className="text-[10px] text-slate-400 ml-auto shrink-0 pl-2">
                            {sortedDocuments.length + kbDocsForGroups.length} totali
                          </span>
                        </div>

                        <div className="space-y-2">
                          {effectiveActiveTab === 'ai_consultant_only' && (
                            <>
                              {aiDocsConsultantOnly.length === 0 && kbDocsConsultantOnly.length === 0 ? (
                                <div className="py-8 flex flex-col items-center gap-2">
                                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center"><Lock className="h-4 w-4 text-amber-600" /></div>
                                  <p className="text-xs text-slate-400 text-center max-w-[280px]">Documenti visibili solo a te nel tuo AI Assistant personale</p>
                                  <Button variant="ghost" size="sm" className="text-xs h-7 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 mt-1" onClick={openCreate}>
                                    <Plus className="h-3 w-3 mr-1" />Aggiungi documento
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  {aiDocsConsultantOnly.map(doc => renderDocumentCard(doc, 'ai_consultant_only'))}
                                  {kbDocsConsultantOnly.length > 0 && (
                                    <>
                                      {aiDocsConsultantOnly.length > 0 && (
                                        <div className="flex items-center gap-2 pt-1">
                                          <div className="h-px flex-1 bg-amber-200" />
                                          <span className="text-[10px] text-amber-500 font-medium whitespace-nowrap">Dalla Knowledge Base</span>
                                          <div className="h-px flex-1 bg-amber-200" />
                                        </div>
                                      )}
                                      {kbDocsConsultantOnly.map(kbDoc => renderKbDocumentCard(kbDoc, 'ai_consultant_only'))}
                                    </>
                                  )}
                                </>
                              )}
                            </>
                          )}

                          {effectiveActiveTab === 'ai_consultant' && (
                            <>
                              {aiDocsConsultant.length === 0 ? (
                                <div className="py-8 flex flex-col items-center gap-2">
                                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center"><Globe className="h-4 w-4 text-indigo-600" /></div>
                                  <p className="text-xs text-slate-400 text-center max-w-[280px]">Istruzioni generali visibili a tutti i clienti e dipendenti</p>
                                  <Button variant="ghost" size="sm" className="text-xs h-7 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 mt-1" onClick={openCreate}>
                                    <Plus className="h-3 w-3 mr-1" />Aggiungi documento
                                  </Button>
                                </div>
                              ) : (
                                aiDocsConsultant.map(doc => renderDocumentCard(doc, 'ai_consultant'))
                              )}
                            </>
                          )}

                          {effectiveActiveTab === 'ai_clients' && (
                            <>
                              {aiDocsClients.length === 0 ? (
                                <div className="py-8 flex flex-col items-center gap-2">
                                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><UserRound className="h-4 w-4 text-blue-600" /></div>
                                  <p className="text-xs text-slate-400 text-center max-w-[280px]">Documenti personalizzati visibili solo ai clienti</p>
                                  <Button variant="ghost" size="sm" className="text-xs h-7 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 mt-1" onClick={openCreate}>
                                    <Plus className="h-3 w-3 mr-1" />Aggiungi documento
                                  </Button>
                                </div>
                              ) : (
                                aiDocsClients.map(doc => renderDocumentCard(doc, 'ai_clients'))
                              )}
                            </>
                          )}

                          {effectiveActiveTab === 'ai_employees' && (
                            <>
                              {aiDocsEmployees.length === 0 ? (
                                <div className="py-8 flex flex-col items-center gap-2">
                                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center"><HardHat className="h-4 w-4 text-emerald-600" /></div>
                                  <p className="text-xs text-slate-400 text-center max-w-[280px]">Istruzioni specifiche per reparti o dipendenti</p>
                                  <Button variant="ghost" size="sm" className="text-xs h-7 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 mt-1" onClick={openCreate}>
                                    <Plus className="h-3 w-3 mr-1" />Aggiungi documento
                                  </Button>
                                </div>
                              ) : (
                                aiDocsEmployees.map(doc => renderDocumentCard(doc, 'ai_employees'))
                              )}
                            </>
                          )}

                          {effectiveActiveTab === 'whatsapp' && (
                            <>
                              {whatsappDocs.length === 0 ? (
                                <div className="py-8 flex flex-col items-center gap-2">
                                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"><MessageCircle className="h-4 w-4 text-green-600" /></div>
                                  <p className="text-xs text-slate-400 text-center max-w-[280px]">Documenti collegati ai dipendenti WhatsApp</p>
                                  <Button variant="ghost" size="sm" className="text-xs h-7 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 mt-1" onClick={openCreate}>
                                    <Plus className="h-3 w-3 mr-1" />Aggiungi documento
                                  </Button>
                                </div>
                              ) : (
                                whatsappDocs.map(doc => renderDocumentCard(doc, 'whatsapp'))
                              )}
                            </>
                          )}

                          {effectiveActiveTab === 'autonomous' && renderAutonomousGroupedSection(autonomousDocs, kbDocsAutonomous)}

                          {effectiveActiveTab === 'unassigned' && (
                            <>
                              {unassignedDocs.length === 0 ? (
                                <div className="py-8 flex flex-col items-center gap-2">
                                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-orange-600" /></div>
                                  <p className="text-xs text-slate-400 text-center max-w-[280px]">Nessun documento non assegnato</p>
                                </div>
                              ) : (
                                unassignedDocs.map(doc => renderDocumentCard(doc, 'unassigned'))
                              )}
                            </>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <Card ref={formRef} className="border-indigo-200 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-500" />
              {editingDoc ? "Modifica Documento di Sistema" : "Nuovo Documento di Sistema"}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeForm} disabled={isSaving}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-0 mb-6">
              {wizardSteps.map((step, idx) => (
                <div key={step.num} className="flex items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                        wizardStep > step.num
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : wizardStep === step.num
                          ? 'border-indigo-600 text-indigo-600 animate-pulse'
                          : 'border-gray-300 text-gray-400'
                      }`}
                    >
                      {wizardStep > step.num ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        step.icon
                      )}
                    </div>
                    <span className={`text-xs font-medium whitespace-nowrap ${
                      wizardStep >= step.num ? 'text-indigo-700' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < wizardSteps.length - 1 && (
                    <div className={`w-16 h-0.5 mx-2 mt-[-18px] ${
                      wizardStep > step.num ? 'bg-indigo-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>

            {wizardStep === 1 && (
              <div className="space-y-5">
                {editingDoc ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sys-doc-title">Titolo *</Label>
                        <Input
                          id="sys-doc-title"
                          value={form.title}
                          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                          placeholder="Es: Istruzioni generali per l'AI"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sys-doc-desc">Descrizione (nota interna)</Label>
                        <Input
                          id="sys-doc-desc"
                          value={form.description}
                          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                          placeholder="Nota interna per identificare questo documento"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="sys-doc-content">Contenuto *</Label>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{form.content.length} caratteri</span>
                          <span className="text-xs text-muted-foreground">~{Math.round(form.content.length / 4).toLocaleString()} token</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        {([
                          { id: 'manual' as const, label: 'Scrivi', icon: <PenLine className="h-3.5 w-3.5" /> },
                          { id: 'drive' as const, label: 'Google Drive', icon: <Cloud className="h-3.5 w-3.5" /> },
                          { id: 'upload' as const, label: 'Carica File', icon: <Upload className="h-3.5 w-3.5" /> },
                        ]).map(tab => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setContentSource(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              contentSource === tab.id
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                            }`}
                          >
                            {tab.icon}
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {contentSource === 'manual' && (
                        <>
                          {extractedFileName && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-700">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span>Contenuto importato da: <strong>{extractedFileName}</strong></span>
                              <button type="button" onClick={() => setExtractedFileName(null)} className="ml-auto text-indigo-400 hover:text-indigo-600">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          <Textarea
                            id="sys-doc-content"
                            value={form.content}
                            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                            placeholder="Testo che verrà iniettato nel prompt di sistema dell'AI..."
                            rows={8}
                            className="resize-y min-h-[150px] font-mono text-sm"
                          />
                        </>
                      )}

                      {contentSource === 'drive' && (
                        <DriveFilePicker
                          existingDocuments={documents}
                          onTextExtracted={(text, fileName, fileId) => {
                            setForm(f => ({ ...f, content: text, title: f.title || fileName.replace(/\.[^/.]+$/, '') }));
                            setExtractedFileName(fileName);
                            setExtractedDriveFileId(fileId || null);
                            setContentSource('manual');
                            toast({ title: "Contenuto importato", description: `${text.length.toLocaleString()} caratteri estratti da "${fileName}"` });
                          }}
                        />
                      )}

                      {contentSource === 'upload' && (
                        <div className="space-y-3">
                          <div
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                              isExtracting ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30'
                            }`}
                            onClick={() => !isExtracting && fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const file = e.dataTransfer.files[0];
                              if (file) handleFileUpload(file);
                            }}
                          >
                            {isExtracting ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                                <p className="text-sm font-medium text-indigo-700">Estrazione testo in corso...</p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2">
                                <FileUp className="h-8 w-8 text-slate-400" />
                                <p className="text-sm font-medium text-slate-600">Trascina un file qui o clicca per selezionare</p>
                                <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, MD, RTF, ODT, CSV, XLSX, PPTX</p>
                              </div>
                            )}
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            accept=".pdf,.docx,.doc,.txt,.md,.rtf,.odt,.csv,.xlsx,.xls,.pptx,.ppt"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(file);
                              e.target.value = '';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-3">
                        {([
                          { id: 'manual' as const, label: 'Scrivi', icon: <PenLine className="h-3.5 w-3.5" /> },
                          { id: 'drive' as const, label: 'Google Drive', icon: <Cloud className="h-3.5 w-3.5" /> },
                          { id: 'upload' as const, label: 'Carica File', icon: <Upload className="h-3.5 w-3.5" /> },
                        ]).map(tab => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setContentSource(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              contentSource === tab.id
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                            }`}
                          >
                            {tab.icon}
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {contentSource === 'manual' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="manual-entry-title" className="text-xs">Titolo *</Label>
                              <Input
                                id="manual-entry-title"
                                value={manualTitle}
                                onChange={e => setManualTitle(e.target.value)}
                                placeholder="Es: Istruzioni generali per l'AI"
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="manual-entry-desc" className="text-xs">Descrizione (opzionale)</Label>
                              <Input
                                id="manual-entry-desc"
                                value={manualDescription}
                                onChange={e => setManualDescription(e.target.value)}
                                placeholder="Nota interna"
                                className="h-9"
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="manual-entry-content" className="text-xs">Contenuto *</Label>
                              {manualContent.length > 0 && (
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground">{manualContent.length} caratteri</span>
                                  <span className="text-xs text-muted-foreground">~{Math.round(manualContent.length / 4).toLocaleString()} token</span>
                                </div>
                              )}
                            </div>
                            <Textarea
                              id="manual-entry-content"
                              value={manualContent}
                              onChange={e => setManualContent(e.target.value)}
                              placeholder="Testo che verrà iniettato nel prompt di sistema dell'AI..."
                              rows={6}
                              className="resize-y min-h-[120px] font-mono text-sm"
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!manualTitle.trim() || !manualContent.trim()}
                            onClick={() => {
                              addContentEntry(manualContent, manualTitle, 'manual', undefined, manualDescription);
                              setManualTitle('');
                              setManualContent('');
                              setManualDescription('');
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Aggiungi
                          </Button>
                        </div>
                      )}

                      {contentSource === 'drive' && (
                        <DriveFilePicker
                          existingDocuments={documents}
                          onTextExtracted={(text, fileName, fileId) => {
                            addContentEntry(text, fileName, 'drive', fileName, undefined, fileId);
                          }}
                          onMultipleExtracted={(files) => {
                            files.forEach(f => {
                              addContentEntry(f.text, f.fileName, 'drive', f.fileName, undefined, f.fileId);
                            });
                            setContentSource('manual');
                            toast({ title: "File importati", description: `${files.length} documenti aggiunti alla lista` });
                          }}
                        />
                      )}

                      {contentSource === 'upload' && (
                        <div className="space-y-3">
                          <div
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                              isExtracting ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30'
                            }`}
                            onClick={() => !isExtracting && fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const droppedFiles = Array.from(e.dataTransfer.files);
                              droppedFiles.forEach(file => handleFileUpload(file));
                            }}
                          >
                            {isExtracting ? (
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                                <p className="text-sm font-medium text-indigo-700">Estrazione testo in corso...</p>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2">
                                <FileUp className="h-8 w-8 text-slate-400" />
                                <p className="text-sm font-medium text-slate-600">Trascina file qui o clicca per selezionare</p>
                                <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, MD, RTF, ODT, CSV, XLSX, PPTX — selezione multipla supportata</p>
                              </div>
                            )}
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            multiple
                            accept=".pdf,.docx,.doc,.txt,.md,.rtf,.odt,.csv,.xlsx,.xls,.pptx,.ppt"
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files) {
                                Array.from(files).forEach(file => handleFileUpload(file));
                              }
                              e.target.value = '';
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {contentEntries.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold flex items-center gap-2">
                            <FileText className="h-4 w-4 text-indigo-600" />
                            {contentEntries.length} {contentEntries.length === 1 ? 'documento' : 'documenti'} da creare
                          </Label>
                          {contentEntries.length > 1 && (
                            <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-700 h-7"
                              onClick={() => setContentEntries([])}>
                              Rimuovi tutti
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                          {contentEntries.map((entry, idx) => (
                            <div key={entry.id} className={`rounded-lg border bg-white transition-colors ${editingEntryId === entry.id ? 'border-indigo-400 shadow-sm' : 'hover:border-indigo-300'}`}>
                              <div className="flex items-center gap-2 px-3 py-2 group">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0">
                                  {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <input
                                    type="text"
                                    value={entry.title}
                                    onChange={(e) => setContentEntries(prev => prev.map(en => en.id === entry.id ? { ...en, title: e.target.value } : en))}
                                    className="text-sm font-medium w-full bg-transparent border-none outline-none focus:ring-0 p-0"
                                    placeholder="Titolo documento"
                                  />
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{entry.content.length.toLocaleString()} caratteri</span>
                                    <span>~{Math.round(entry.content.length / 4).toLocaleString()} token</span>
                                    {entry.sourceFileName && (
                                      <span className="flex items-center gap-1">
                                        {entry.sourceType === 'drive' ? <Cloud className="h-3 w-3" /> : entry.sourceType === 'upload' ? <Upload className="h-3 w-3" /> : <PenLine className="h-3 w-3" />}
                                        {entry.sourceFileName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 hover:text-indigo-600 shrink-0"
                                  onClick={() => setEditingEntryId(editingEntryId === entry.id ? null : entry.id)}
                                  title="Modifica contenuto">
                                  <PenLine className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 shrink-0"
                                  onClick={() => { setContentEntries(prev => prev.filter(en => en.id !== entry.id)); if (editingEntryId === entry.id) setEditingEntryId(null); }}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              {editingEntryId === entry.id && (
                                <div className="px-3 pb-3 pt-1 border-t border-indigo-100 space-y-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Descrizione (opzionale)</Label>
                                    <Input
                                      value={entry.description}
                                      onChange={(e) => setContentEntries(prev => prev.map(en => en.id === entry.id ? { ...en, description: e.target.value } : en))}
                                      placeholder="Nota interna"
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Contenuto</Label>
                                    <Textarea
                                      value={entry.content}
                                      onChange={(e) => setContentEntries(prev => prev.map(en => en.id === entry.id ? { ...en, content: e.target.value } : en))}
                                      rows={6}
                                      className="resize-y min-h-[100px] font-mono text-xs"
                                    />
                                  </div>
                                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingEntryId(null)}>
                                    Chiudi editor
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <Separator />

                <div className="flex items-center justify-between gap-3">
                  <Button variant="outline" onClick={closeForm} disabled={isSaving}>
                    Annulla
                  </Button>
                  <Button
                    onClick={() => setWizardStep(2)}
                    disabled={editingDoc ? (!form.title.trim() || !form.content.trim()) : contentEntries.length === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Avanti
                  </Button>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-5">
                {!editingDoc && contentEntries.length > 0 && (
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-2.5 text-sm text-indigo-700 flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0" />
                    Le seguenti impostazioni verranno applicate a tutti i {contentEntries.length} documenti
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Priorità: {form.priority}</Label>
                    <Slider
                      value={[form.priority]}
                      onValueChange={([v]) => setForm(f => ({ ...f, priority: v }))}
                      min={1}
                      max={10}
                      step={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      1 = bassa, 10 = alta
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Modalità di Iniezione</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, injection_mode: 'system_prompt' }))}
                        className={`text-left p-4 rounded-xl border-2 transition-all ${
                          form.injection_mode === 'system_prompt'
                            ? 'border-slate-500 bg-slate-50 dark:bg-slate-900/50 shadow-sm'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <StickyNote className="h-5 w-5 text-slate-600" />
                          <span className="font-semibold text-sm">System Prompt</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Sempre in memoria ad ogni chiamata AI. Ideale per <strong>brevi istruzioni</strong>, regole di comportamento e linee guida.
                        </p>
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                          <AlertTriangle className="h-3 w-3" />
                          Consuma token ad ogni richiesta
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, injection_mode: 'file_search' }))}
                        className={`text-left p-4 rounded-xl border-2 transition-all ${
                          form.injection_mode === 'file_search'
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 shadow-sm'
                            : 'border-slate-200 hover:border-amber-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Search className="h-5 w-5 text-amber-600" />
                          <span className="font-semibold text-sm">File Search</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Cercato solo quando rilevante. Ideale per <strong>documentazione lunga</strong>, manuali, procedure e riferimenti.
                        </p>
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Efficiente — usa token solo se necessario
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {form.injection_mode === 'system_prompt' && form.content.length > 5000 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="text-xs text-amber-800 dark:text-amber-200">
                      <p className="font-medium">Contenuto lungo per System Prompt (~{Math.round(form.content.length / 4).toLocaleString()} token)</p>
                      <p className="mt-0.5 text-amber-600 dark:text-amber-300">
                        Questi token verranno consumati ad ogni chiamata AI. Per documentazione lunga, considera la modalità <strong>File Search</strong> che usa i token solo quando il contenuto è rilevante.
                      </p>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between gap-3">
                  <Button variant="outline" onClick={() => setWizardStep(1)}>
                    Indietro
                  </Button>
                  <Button
                    onClick={() => setWizardStep(3)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Avanti
                  </Button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-5">
                {!editingDoc && contentEntries.length > 0 && (
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-2.5 text-sm text-indigo-700 flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0" />
                    I destinatari selezionati verranno applicati a tutti i {contentEntries.length} documenti
                  </div>
                )}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-600" />
                    <Label className="text-base font-semibold text-slate-800">Chi riceve questo documento?</Label>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2">Seleziona almeno un destinatario tra AI Assistant, WhatsApp o Agenti Autonomi</p>

                  {!form.target_client_assistant && Object.values(form.target_whatsapp_agents).every(v => !v) && Object.values(form.target_autonomous_agents).every(v => !v) && (
                    <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 p-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                      <p className="text-xs text-amber-700 font-medium">Nessun destinatario selezionato — il documento non sarà visibile a nessuno finché non attivi almeno un canale</p>
                    </div>
                  )}

                  <div className={`rounded-xl border-2 overflow-hidden transition-colors ${form.target_client_assistant ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Sparkles className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">AI Assistant</p>
                          <p className="text-xs text-muted-foreground">Inietta nel chatbot AI — scegli chi potrà vederlo</p>
                        </div>
                      </div>
                      <Switch
                        checked={form.target_client_assistant}
                        onCheckedChange={v => setForm(f => ({ ...f, target_client_assistant: v }))}
                      />
                    </div>

                    {form.target_client_assistant && (
                      <div className="p-4 space-y-3 border-t border-blue-200 bg-white/50">
                        <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Chi deve vedere questo documento?</Label>

                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, target_client_mode: 'consultant_only' as TargetClientMode, target_client_ids: [], target_department_ids: [] }))}
                          className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                            form.target_client_mode === 'consultant_only'
                              ? 'border-amber-400 bg-amber-50 shadow-sm ring-1 ring-amber-200'
                              : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/30'
                          }`}
                        >
                          <div className={`p-2 rounded-lg shrink-0 ${form.target_client_mode === 'consultant_only' ? 'bg-amber-200' : 'bg-slate-100'}`}>
                            <Lock className={`h-4 w-4 ${form.target_client_mode === 'consultant_only' ? 'text-amber-700' : 'text-slate-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${form.target_client_mode === 'consultant_only' ? 'text-amber-800' : 'text-slate-700'}`}>Solo per me</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Visibile solo nel tuo AI Assistant personale. Nessun cliente o dipendente lo vedrà — come un documento nella tua Knowledge Base privata.</p>
                          </div>
                          {form.target_client_mode === 'consultant_only' && (
                            <div className="shrink-0 mt-0.5"><CheckCircle2 className="h-5 w-5 text-amber-600" /></div>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, target_client_mode: 'all' as TargetClientMode, target_client_ids: [], target_department_ids: [] }))}
                          className={`w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                            form.target_client_mode === 'all'
                              ? 'border-indigo-400 bg-indigo-50 shadow-sm ring-1 ring-indigo-200'
                              : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                          }`}
                        >
                          <div className={`p-2 rounded-lg shrink-0 ${form.target_client_mode === 'all' ? 'bg-indigo-200' : 'bg-slate-100'}`}>
                            <Globe className={`h-4 w-4 ${form.target_client_mode === 'all' ? 'text-indigo-700' : 'text-slate-500'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${form.target_client_mode === 'all' ? 'text-indigo-800' : 'text-slate-700'}`}>Tutti</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Ogni persona che usa il chatbot AI vedrà questo documento — clienti e dipendenti.</p>
                          </div>
                          {form.target_client_mode === 'all' && (
                            <div className="shrink-0 mt-0.5"><CheckCircle2 className="h-5 w-5 text-indigo-600" /></div>
                          )}
                        </button>

                        <div className={`rounded-xl border-2 overflow-hidden transition-all ${
                          ['clients_only', 'specific_clients'].includes(form.target_client_mode)
                            ? 'border-blue-400 bg-blue-50/30 shadow-sm ring-1 ring-blue-200'
                            : 'border-slate-200 hover:border-blue-300'
                        }`}>
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, target_client_mode: 'clients_only' as TargetClientMode, target_client_ids: [], target_department_ids: [] }))}
                            className="w-full flex items-start gap-3 p-3.5 text-left"
                          >
                            <div className={`p-2 rounded-lg shrink-0 ${['clients_only', 'specific_clients'].includes(form.target_client_mode) ? 'bg-blue-200' : 'bg-slate-100'}`}>
                              <UserRound className={`h-4 w-4 ${['clients_only', 'specific_clients'].includes(form.target_client_mode) ? 'text-blue-700' : 'text-slate-500'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${['clients_only', 'specific_clients'].includes(form.target_client_mode) ? 'text-blue-800' : 'text-slate-700'}`}>Clienti</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Solo i clienti vedranno questo documento nel chatbot AI. I dipendenti non lo vedranno.</p>
                            </div>
                            {['clients_only', 'specific_clients'].includes(form.target_client_mode) && (
                              <div className="shrink-0 mt-0.5"><CheckCircle2 className="h-5 w-5 text-blue-600" /></div>
                            )}
                          </button>
                          {['clients_only', 'specific_clients'].includes(form.target_client_mode) && (
                            <div className="px-4 pb-3 pt-1 border-t border-blue-200 space-y-2.5">
                              <div className="flex gap-2">
                                <button type="button" onClick={() => setForm(f => ({ ...f, target_client_mode: 'clients_only' as TargetClientMode, target_client_ids: [] }))}
                                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${form.target_client_mode === 'clients_only' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                                  Tutti i clienti
                                </button>
                                <button type="button" onClick={() => setForm(f => ({ ...f, target_client_mode: 'specific_clients' as TargetClientMode, target_client_ids: [] }))}
                                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${form.target_client_mode === 'specific_clients' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                                  Scegli clienti
                                </button>
                              </div>
                              {form.target_client_mode === 'specific_clients' && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium text-slate-600">
                                    {form.target_client_ids.length} clienti selezionati
                                  </Label>
                                  <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border bg-white p-2">
                                    {nonEmployeeClients.length === 0 ? (
                                      <p className="text-xs text-muted-foreground py-2 text-center">Nessun cliente trovato</p>
                                    ) : nonEmployeeClients.map(client => (
                                      <label key={client.id} className="flex items-center gap-2 rounded-md p-2 cursor-pointer hover:bg-blue-50 transition-colors">
                                        <Checkbox
                                          checked={form.target_client_ids.includes(client.id)}
                                          onCheckedChange={(checked) =>
                                            setForm(f => ({
                                              ...f,
                                              target_client_ids: checked
                                                ? [...f.target_client_ids, client.id]
                                                : f.target_client_ids.filter(id => id !== client.id),
                                            }))
                                          }
                                        />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm truncate">{client.firstName} {client.lastName}</p>
                                          <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className={`rounded-xl border-2 overflow-hidden transition-all ${
                          ['employees_only', 'specific_departments', 'specific_employees'].includes(form.target_client_mode)
                            ? 'border-emerald-400 bg-emerald-50/30 shadow-sm ring-1 ring-emerald-200'
                            : 'border-slate-200 hover:border-emerald-300'
                        }`}>
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, target_client_mode: 'employees_only' as TargetClientMode, target_client_ids: [], target_department_ids: [] }))}
                            className="w-full flex items-start gap-3 p-3.5 text-left"
                          >
                            <div className={`p-2 rounded-lg shrink-0 ${['employees_only', 'specific_departments', 'specific_employees'].includes(form.target_client_mode) ? 'bg-emerald-200' : 'bg-slate-100'}`}>
                              <HardHat className={`h-4 w-4 ${['employees_only', 'specific_departments', 'specific_employees'].includes(form.target_client_mode) ? 'text-emerald-700' : 'text-slate-500'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${['employees_only', 'specific_departments', 'specific_employees'].includes(form.target_client_mode) ? 'text-emerald-800' : 'text-slate-700'}`}>Dipendenti</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Solo i dipendenti vedranno questo documento. I clienti non lo vedranno.</p>
                            </div>
                            {['employees_only', 'specific_departments', 'specific_employees'].includes(form.target_client_mode) && (
                              <div className="shrink-0 mt-0.5"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
                            )}
                          </button>
                          {['employees_only', 'specific_departments', 'specific_employees'].includes(form.target_client_mode) && (
                            <div className="px-4 pb-3 pt-1 border-t border-emerald-200 space-y-2.5">
                              <div className="flex gap-2">
                                <button type="button" onClick={() => setForm(f => ({ ...f, target_client_mode: 'employees_only' as TargetClientMode, target_client_ids: [], target_department_ids: [] }))}
                                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${form.target_client_mode === 'employees_only' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                                  Tutti i dipendenti
                                </button>
                                <button type="button" onClick={() => setForm(f => ({ ...f, target_client_mode: 'specific_departments' as TargetClientMode, target_client_ids: [], target_department_ids: [] }))}
                                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${form.target_client_mode === 'specific_departments' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                                  Per reparto
                                </button>
                                <button type="button" onClick={() => setForm(f => ({ ...f, target_client_mode: 'specific_employees' as TargetClientMode, target_client_ids: [], target_department_ids: [] }))}
                                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all ${form.target_client_mode === 'specific_employees' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'}`}>
                                  Scegli dipendenti
                                </button>
                              </div>

                              {form.target_client_mode === 'specific_departments' && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium text-slate-600">
                                    {form.target_department_ids.length} reparti selezionati
                                  </Label>
                                  <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border bg-white p-2">
                                    {departments.length === 0 ? (
                                      <p className="text-xs text-muted-foreground py-2 text-center">Nessun reparto trovato — crea i reparti dalla pagina Gestione Clienti</p>
                                    ) : departments.map(dept => (
                                      <label key={dept.id} className="flex items-center gap-2 rounded-md p-2 cursor-pointer hover:bg-emerald-50 transition-colors">
                                        <Checkbox
                                          checked={form.target_department_ids.includes(dept.id)}
                                          onCheckedChange={(checked) =>
                                            setForm(f => ({
                                              ...f,
                                              target_department_ids: checked
                                                ? [...f.target_department_ids, dept.id]
                                                : f.target_department_ids.filter(id => id !== dept.id),
                                            }))
                                          }
                                        />
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: dept.color || '#6b7280' }} />
                                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                          <span className="text-sm truncate">{dept.name}</span>
                                          <Badge variant="outline" className="text-xs shrink-0 ml-auto">{dept.employee_count} dip.</Badge>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {form.target_client_mode === 'specific_employees' && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-medium text-slate-600">
                                    {form.target_client_ids.length} dipendenti selezionati
                                  </Label>
                                  <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border bg-white p-2">
                                    {employeeClients.length === 0 ? (
                                      <p className="text-xs text-muted-foreground py-2 text-center">Nessun dipendente trovato</p>
                                    ) : (() => {
                                      const grouped = new Map<string, ClientUser[]>();
                                      employeeClients.forEach(emp => {
                                        const deptId = emp.departmentId || '_none';
                                        if (!grouped.has(deptId)) grouped.set(deptId, []);
                                        grouped.get(deptId)!.push(emp);
                                      });
                                      return Array.from(grouped.entries()).map(([deptId, emps]) => {
                                        const dept = departments.find(d => d.id === deptId);
                                        return (
                                          <div key={deptId}>
                                            {grouped.size > 1 && (
                                              <div className="flex items-center gap-1.5 px-1 py-1.5 border-b border-slate-100">
                                                {dept && <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dept.color || '#6b7280' }} />}
                                                <span className="text-xs font-semibold text-slate-500">{dept?.name || 'Senza reparto'}</span>
                                              </div>
                                            )}
                                            {emps.map(emp => (
                                              <label key={emp.id} className="flex items-center gap-2 rounded-md p-2 cursor-pointer hover:bg-emerald-50 transition-colors">
                                                <Checkbox
                                                  checked={form.target_client_ids.includes(emp.id)}
                                                  onCheckedChange={(checked) =>
                                                    setForm(f => ({
                                                      ...f,
                                                      target_client_ids: checked
                                                        ? [...f.target_client_ids, emp.id]
                                                        : f.target_client_ids.filter(id => id !== emp.id),
                                                    }))
                                                  }
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-sm truncate">{emp.firstName} {emp.lastName}</p>
                                                  <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                                                </div>
                                              </label>
                                            ))}
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {whatsappAgents.length > 0 && (
                    <div className={`rounded-xl border-2 overflow-hidden transition-colors ${Object.values(form.target_whatsapp_agents).some(Boolean) ? 'border-green-400 bg-green-50/30' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50/50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <MessageCircle className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">Dipendenti WhatsApp</p>
                            <p className="text-xs text-muted-foreground">
                              {Object.values(form.target_whatsapp_agents).filter(Boolean).length} di {whatsappAgents.length} selezionati
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 border-t border-green-100 bg-white/50 grid grid-cols-1 gap-2">
                        {whatsappAgents.map(agent => (
                          <label
                            key={agent.id}
                            className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${!!form.target_whatsapp_agents[agent.id] ? 'bg-green-50 border-green-300' : 'hover:bg-green-50/50'}`}
                          >
                            <Checkbox
                              checked={!!form.target_whatsapp_agents[agent.id]}
                              onCheckedChange={(checked) =>
                                setForm(f => ({
                                  ...f,
                                  target_whatsapp_agents: {
                                    ...f.target_whatsapp_agents,
                                    [agent.id]: !!checked,
                                  },
                                }))
                              }
                            />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <MessageCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                              <span className="text-sm font-medium truncate">{agent.agent_name || "Agente senza nome"}</span>
                              <Badge variant="outline" className="text-xs shrink-0 ml-auto">
                                {agent.agent_type || "general"}
                              </Badge>
                              {!agent.is_active && (
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  Inattivo
                                </Badge>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <Collapsible open={agentsOpen} onOpenChange={setAgentsOpen}>
                    <CollapsibleTrigger asChild>
                      <div className={`flex items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition-colors ${Object.values(form.target_autonomous_agents).some(Boolean) ? 'border-purple-400 bg-purple-50/30' : 'border-slate-200 hover:bg-accent/50'}`}>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <Bot className="h-4 w-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">Agenti Autonomi</p>
                            <p className="text-xs text-muted-foreground">
                              {Object.values(form.target_autonomous_agents).filter(Boolean).length} di {AUTONOMOUS_AGENTS.length} selezionati
                            </p>
                          </div>
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform ${agentsOpen ? "rotate-180" : ""}`} />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-2 gap-2 mt-2 px-1">
                        {AUTONOMOUS_AGENTS.map(agent => (
                          <label
                            key={agent.id}
                            className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${!!form.target_autonomous_agents[agent.id] ? 'bg-purple-50 border-purple-300' : 'hover:bg-purple-50/50'}`}
                          >
                            <Checkbox
                              checked={!!form.target_autonomous_agents[agent.id]}
                              onCheckedChange={(checked) =>
                                setForm(f => ({
                                  ...f,
                                  target_autonomous_agents: {
                                    ...f.target_autonomous_agents,
                                    [agent.id]: !!checked,
                                  },
                                }))
                              }
                            />
                            <span className="text-sm font-medium">{agent.name}</span>
                          </label>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-3">
                  <Button variant="outline" onClick={() => setWizardStep(2)}>
                    Indietro
                  </Button>
                  <Button onClick={handleSubmit} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {editingDoc ? "Salva Modifiche" : contentEntries.length > 1 ? `Crea ${contentEntries.length} Documenti` : "Crea Documento"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione è irreversibile. Il documento verrà rimosso permanentemente e non sarà più iniettato nei prompt AI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!transferDoc} onOpenChange={(open) => { if (!open) setTransferDoc(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-4 w-4 text-teal-600" />
              Trasferisci documento
            </DialogTitle>
          </DialogHeader>
          {transferDoc && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 border">
                <p className="text-sm font-medium truncate">{transferDoc.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Seleziona le sezioni in cui vuoi che appaia questo documento</p>
              </div>
              <div className="space-y-2">
                {[
                  { key: 'ai_consultant_only', label: 'Solo per me (privato)', icon: <Lock className="h-4 w-4 text-amber-600" />, desc: 'Visibile solo nel tuo AI Assistant', checkedClass: 'bg-amber-50/50 border-amber-200', exclusive: true },
                  { key: 'ai_consultant', label: 'AI per Tutti', icon: <Globe className="h-4 w-4 text-indigo-600" />, desc: 'Clienti e dipendenti', checkedClass: 'bg-indigo-50/50 border-indigo-200', exclusive: true },
                  { key: 'ai_clients', label: 'AI per Clienti', icon: <UserRound className="h-4 w-4 text-blue-600" />, desc: 'Solo clienti selezionati', checkedClass: 'bg-blue-50/50 border-blue-200', exclusive: true },
                  { key: 'ai_employees', label: 'AI per Dipendenti', icon: <HardHat className="h-4 w-4 text-emerald-600" />, desc: 'Solo dipendenti/reparti', checkedClass: 'bg-emerald-50/50 border-emerald-200', exclusive: true },
                  { key: 'whatsapp', label: 'Dipendenti WhatsApp', icon: <MessageCircle className="h-4 w-4 text-green-600" />, desc: 'Agenti WhatsApp', checkedClass: 'bg-green-50/50 border-green-200', exclusive: false },
                  { key: 'autonomous', label: 'Agenti Autonomi', icon: <Bot className="h-4 w-4 text-purple-600" />, desc: 'Agenti AI autonomi', checkedClass: 'bg-purple-50/50 border-purple-200', exclusive: false },
                ].map(item => {
                  const isChecked = transferTargets[item.key] || false;
                  return (
                    <label key={item.key} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isChecked ? item.checkedClass : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const newTargets = { ...transferTargets };
                          if (item.exclusive) {
                            ['ai_consultant_only', 'ai_consultant', 'ai_clients', 'ai_employees'].forEach(k => {
                              newTargets[k] = false;
                            });
                          }
                          newTargets[item.key] = e.target.checked;
                          setTransferTargets(newTargets);
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {item.icon}
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setTransferDoc(null)}>Annulla</Button>
                <Button
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 text-white"
                  disabled={transferMutation.isPending || !Object.values(transferTargets).some(v => v)}
                  onClick={() => transferDoc && transferMutation.mutate({ doc: transferDoc, targets: transferTargets })}
                >
                  {transferMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  Conferma
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletionDoc} onOpenChange={(open) => { if (!open) setDeletionDoc(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-destructive">
              <Trash2 className="h-4 w-4" />
              Rimuovi da sezioni
            </DialogTitle>
          </DialogHeader>
          {deletionDoc && (
            <div className="space-y-4">
              <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                <p className="text-sm font-medium truncate">{deletionDoc.title}</p>
                <p className="text-xs text-red-600 mt-0.5">Questo documento appare in più sezioni. Seleziona da quali rimuoverlo.</p>
              </div>
              <div className="space-y-2">
                {Object.entries(deletionTargets).map(([key, checked]) => (
                  <label key={key} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${checked ? 'bg-red-50/50 border-red-200' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setDeletionTargets(prev => ({ ...prev, [key]: e.target.checked }))}
                      className="rounded border-slate-300 text-red-600 focus:ring-red-500 h-4 w-4"
                    />
                    <span className="text-sm font-medium">{groupLabelMap[key] || key}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => { setDeletionDoc(null); setDeletingId(deletionDoc.id); }}>
                  Elimina completamente
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDeletionDoc(null)}>Annulla</Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={transferMutation.isPending || !Object.values(deletionTargets).some(v => v)}
                    onClick={handleSelectiveDeletion}
                  >
                    {transferMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Rimuovi selezionati
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyDocId} onOpenChange={(open) => { if (!open) setHistoryDocId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-blue-500" />
              Cronologia Sync
            </DialogTitle>
            <p className="text-sm text-muted-foreground truncate">{historyDocTitle}</p>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : syncHistory.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nessuna sincronizzazione registrata
              </div>
            ) : (
              <div className="space-y-2">
                {syncHistory.map((entry: any, i: number) => (
                  <div key={entry.id || i} className={`rounded-lg border p-3 text-sm ${
                    entry.status === 'failed' ? 'border-red-200 bg-red-50/50' :
                    entry.status === 'pending' ? 'border-orange-200 bg-orange-50/50' :
                    'border-green-200 bg-green-50/50'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {entry.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                        {entry.status === 'failed' && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                        {entry.status === 'pending' && <Timer className="h-4 w-4 text-orange-600 shrink-0" />}
                        <span className="font-medium capitalize">
                          {entry.sync_type === 'manual' ? 'Manuale' :
                           entry.sync_type === 'webhook' ? 'Automatica' :
                           entry.sync_type === 'scheduled' ? 'Programmata' :
                           entry.sync_type === 'initial' ? 'Iniziale' : entry.sync_type}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {entry.started_at ? formatDate(entry.started_at) : '-'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {entry.characters_extracted != null && (
                        <span>{entry.characters_extracted.toLocaleString()} caratteri</span>
                      )}
                      {entry.estimated_tokens != null && (
                        <span>~{entry.estimated_tokens.toLocaleString()} token</span>
                      )}
                      {entry.duration_ms != null && (
                        <span>Durata: {formatDuration(entry.duration_ms)}</span>
                      )}
                      {entry.new_version != null && (
                        <span>Versione #{entry.new_version}</span>
                      )}
                    </div>
                    {entry.status === 'failed' && entry.error_message && (
                      <p className="mt-1.5 text-xs text-red-600 line-clamp-2">{entry.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-0">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${previewDoc?.type === 'kb' ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                <FileText className={`h-5 w-5 ${previewDoc?.type === 'kb' ? 'text-amber-600' : 'text-indigo-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-semibold leading-tight">
                  {previewDoc?.type === 'system' ? previewDoc.doc.title : previewDoc?.type === 'kb' ? previewDoc.doc.title : ''}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {previewDoc?.type === 'system' && (
                    <>
                      <Badge variant={previewDoc.doc.is_active ? "default" : "secondary"} className="text-[10px] h-5">
                        {previewDoc.doc.is_active ? "Attivo" : "Inattivo"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] h-5">
                        <Zap className="h-3 w-3 mr-0.5" />
                        Priorità {previewDoc.doc.priority}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] h-5 ${previewDoc.doc.injection_mode === 'system_prompt' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {previewDoc.doc.injection_mode === 'system_prompt' ? 'System Prompt' : 'File Search'}
                      </Badge>
                      {previewDoc.doc.google_drive_file_id && (
                        <span className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                          <Cloud className="w-3 h-3" />
                          Google Drive
                        </span>
                      )}
                    </>
                  )}
                  {previewDoc?.type === 'kb' && (
                    <>
                      <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-300">
                        Knowledge Base
                      </Badge>
                      {previewDoc.doc.fileType && (
                        <span className="text-[10px] text-slate-500 uppercase font-medium">{previewDoc.doc.fileType}</span>
                      )}
                      {previewDoc.doc.googleDriveFileId && (
                        <span className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                          <Cloud className="w-3 h-3" />
                          Google Drive
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </DialogHeader>

          <Separator className="my-3" />

          {previewDoc?.type === 'system' && (
            <div className="space-y-3 mb-3">
              {previewDoc.doc.description && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                  <StickyNote className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-600">{previewDoc.doc.description}</p>
                </div>
              )}
              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {previewDoc.doc.content.length.toLocaleString()} caratteri
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  ~{Math.round(previewDoc.doc.content.length / 4).toLocaleString()} token
                </span>
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(previewDoc.doc.created_at)}
                </span>
              </div>
              {(() => {
                const badges = getTargetBadges(previewDoc.doc);
                return badges.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {badges.map((b, i) => (
                      <Badge key={i} variant="outline" className={`text-[10px] gap-1 py-0.5 ${b.colorClass}`}>
                        {b.icon}
                        {b.label}
                      </Badge>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>
          )}

          {previewDoc?.type === 'kb' && (
            <div className="space-y-3 mb-3">
              <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                {previewDoc.doc.fileSize && (
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {(previewDoc.doc.fileSize / 1024).toFixed(1)} KB
                  </span>
                )}
                {previewDoc.doc.createdAt && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {formatDate(previewDoc.doc.createdAt)}
                  </span>
                )}
              </div>
              {previewDoc.doc.agentIds.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Bot className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                  {previewDoc.doc.agentIds.map(id => {
                    const agent = AUTONOMOUS_AGENTS.find(a => a.id === id);
                    return (
                      <Badge key={id} variant="outline" className="text-[10px] gap-1 py-0.5 bg-purple-50 text-purple-700 border-purple-200">
                        <Bot className="h-3 w-3" />
                        {agent?.name || id}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contenuto</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 text-slate-500 hover:text-slate-700"
              onClick={() => {
                const content = previewDoc?.type === 'system'
                  ? previewDoc.doc.content
                  : previewDoc?.type === 'kb'
                  ? previewDoc.content || ''
                  : '';
                handleCopyContent(content);
              }}
              disabled={previewDoc?.type === 'kb' && previewDoc.loading}
            >
              {copiedContent ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedContent ? 'Copiato!' : 'Copia'}
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border bg-slate-50/70 p-4" style={{ maxHeight: '50vh' }}>
              {previewDoc?.type === 'system' ? (
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono leading-relaxed break-words">
                  {previewDoc.doc.content}
                </pre>
              ) : previewDoc?.type === 'kb' && previewDoc.loading ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                  <span className="text-sm text-slate-500">Caricamento contenuto...</span>
                </div>
              ) : previewDoc?.type === 'kb' ? (
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-mono leading-relaxed break-words">
                  {previewDoc.content || 'Nessun contenuto disponibile'}
                </pre>
              ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-lg p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-lg font-semibold">
              {editingDoc
                ? 'Riepilogo Documento'
                : contentEntries.length === 1
                  ? 'Riepilogo Documento'
                  : `Riepilogo ${contentEntries.length} Documenti`}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] px-6 pb-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Documenti</p>
                {editingDoc ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Edit3 className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span className="truncate">Modifica documento: <span className="font-medium">{form.title}</span></span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-slate-700">{contentEntries.length} {contentEntries.length === 1 ? 'documento' : 'documenti'} da creare</p>
                    {contentEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-2 text-xs text-slate-600 pl-1">
                        <FileText className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate">{entry.title || 'Senza titolo'}</span>
                        <span className="text-slate-400 shrink-0">~{Math.round(entry.content.length / 4).toLocaleString()} token</span>
                      </div>
                    ))}
                  </div>
                )}
                {editingDoc && (
                  <p className="text-xs text-slate-500">~{Math.round(form.content.length / 4).toLocaleString()} token stimati ({form.content.length.toLocaleString()} caratteri)</p>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Modalità di consegna</p>
                {form.injection_mode === 'system_prompt' ? (
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200 shrink-0">
                      <StickyNote className="h-3 w-3 mr-1" />
                      System Prompt
                    </Badge>
                    <span className="text-xs text-slate-600">Iniettato direttamente nel prompt AI ad ogni chiamata</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 shrink-0">
                      <Search className="h-3 w-3 mr-1" />
                      File Search
                    </Badge>
                    <span className="text-xs text-slate-600">Indicizzato e recuperato solo quando rilevante (RAG)</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Destinatari</p>
                <div className="space-y-2">
                  {form.target_client_assistant && (() => {
                    const mode = form.target_client_mode;
                    const modeMap: Record<string, { icon: React.ReactNode; label: string }> = {
                      consultant_only: { icon: <Lock className="h-4 w-4 text-slate-500" />, label: 'Solo per me' },
                      all: { icon: <Globe className="h-4 w-4 text-blue-500" />, label: 'Tutti (clienti e dipendenti)' },
                      clients_only: { icon: <UserRound className="h-4 w-4 text-blue-500" />, label: 'Tutti i clienti' },
                      specific_clients: { icon: <UserRound className="h-4 w-4 text-blue-500" />, label: `${form.target_client_ids.length} clienti selezionati` },
                      employees_only: { icon: <HardHat className="h-4 w-4 text-orange-500" />, label: 'Tutti i dipendenti' },
                      specific_departments: { icon: <Building2 className="h-4 w-4 text-purple-500" />, label: `${form.target_department_ids.length} reparti selezionati` },
                      specific_employees: { icon: <HardHat className="h-4 w-4 text-orange-500" />, label: `${form.target_client_ids.length} dipendenti selezionati` },
                    };
                    const info = modeMap[mode] || modeMap.all;
                    return (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
                          <span className="font-medium">AI Assistant</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 pl-6">
                          {info.icon}
                          <span>{info.label}</span>
                        </div>
                        {form.injection_mode === 'file_search' && mode === 'consultant_only' && (
                          <div className="flex items-center gap-2 text-xs text-slate-500 pl-6">
                            <Database className="h-3 w-3 text-green-500" />
                            <span>Store: Knowledge Base Consulente</span>
                          </div>
                        )}
                        {form.injection_mode === 'file_search' && (mode === 'all' || mode === 'clients_only' || mode === 'employees_only') && (
                          <div className="flex items-center gap-2 text-xs text-slate-500 pl-6">
                            <Database className="h-3 w-3 text-green-500" />
                            <span>Store: {mode === 'all' ? 'Store Privato di ogni cliente e dipendente' : mode === 'clients_only' ? 'Store Privato di ogni cliente' : 'Store Privato di ogni dipendente'}</span>
                          </div>
                        )}
                        {mode === 'specific_clients' && form.target_client_ids.length > 0 && (
                          <div className="pl-8 space-y-0.5">
                            {form.target_client_ids.map(cid => {
                              const client = nonEmployeeClients.find(c => c.id === cid) || employeeClients.find(c => c.id === cid);
                              return client ? (
                                <div key={cid} className="space-y-0.5">
                                  <p className="text-[11px] text-slate-500">• {client.firstName} {client.lastName}</p>
                                  {form.injection_mode === 'file_search' && (
                                    <p className="text-[11px] text-slate-400 pl-2 flex items-center gap-1">
                                      <Database className="h-2.5 w-2.5 text-green-400" />
                                      Store Privato: {client.firstName} {client.lastName}
                                    </p>
                                  )}
                                </div>
                              ) : null;
                            })}
                          </div>
                        )}
                        {mode === 'specific_departments' && form.target_department_ids.length > 0 && (
                          <div className="pl-8 space-y-0.5">
                            {form.target_department_ids.map(did => {
                              const dept = departments.find(d => d.id === did);
                              return dept ? (
                                <div key={did} className="space-y-0.5">
                                  <p className="text-[11px] text-slate-500">• {dept.name}</p>
                                  {form.injection_mode === 'file_search' && (
                                    <p className="text-[11px] text-slate-400 pl-2 flex items-center gap-1">
                                      <Database className="h-2.5 w-2.5 text-green-400" />
                                      Store Reparto: {dept.name}
                                    </p>
                                  )}
                                </div>
                              ) : null;
                            })}
                          </div>
                        )}
                        {mode === 'specific_employees' && form.target_client_ids.length > 0 && (
                          <div className="pl-8 space-y-0.5">
                            {form.target_client_ids.map(cid => {
                              const emp = employeeClients.find(c => c.id === cid);
                              return emp ? (
                                <div key={cid} className="space-y-0.5">
                                  <p className="text-[11px] text-slate-500">• {emp.firstName} {emp.lastName}</p>
                                  {form.injection_mode === 'file_search' && (
                                    <p className="text-[11px] text-slate-400 pl-2 flex items-center gap-1">
                                      <Database className="h-2.5 w-2.5 text-green-400" />
                                      Store Privato: {emp.firstName} {emp.lastName}
                                    </p>
                                  )}
                                </div>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {Object.entries(form.target_whatsapp_agents).filter(([, v]) => v).map(([agentId]) => {
                    const agent = whatsappAgents.find(a => a.id === agentId);
                    return agent ? (
                      <div key={agentId} className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <MessageCircle className="h-4 w-4 text-green-500 shrink-0" />
                          <span>{agent.agent_name}</span>
                        </div>
                        {form.injection_mode === 'file_search' && (
                          <div className="flex items-center gap-2 text-xs text-slate-500 pl-6">
                            <Database className="h-3 w-3 text-green-500" />
                            <span>Store WhatsApp Agent: {agent.agent_name}</span>
                          </div>
                        )}
                      </div>
                    ) : null;
                  })}

                  {Object.entries(form.target_autonomous_agents).filter(([, v]) => v).map(([agentId]) => {
                    const agent = AUTONOMOUS_AGENTS.find(a => a.id === agentId);
                    return agent ? (
                      <div key={agentId} className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Bot className="h-4 w-4 text-purple-500 shrink-0" />
                          <span>{agent.name}</span>
                        </div>
                        {form.injection_mode === 'file_search' && (
                          <div className="flex items-center gap-2 text-xs text-slate-500 pl-6">
                            <Database className="h-3 w-3 text-green-500" />
                            <span>Store Agente Autonomo: {agent.name}</span>
                          </div>
                        )}
                      </div>
                    ) : null;
                  })}

                  {!form.target_client_assistant &&
                    Object.values(form.target_whatsapp_agents).every(v => !v) &&
                    Object.values(form.target_autonomous_agents).every(v => !v) && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Nessun destinatario selezionato</span>
                    </div>
                  )}
                </div>
              </div>

              {form.injection_mode === 'file_search' && (() => {
                const stores: string[] = [];
                if (form.target_client_assistant) {
                  const mode = form.target_client_mode;
                  if (mode === 'consultant_only') {
                    stores.push('Knowledge Base Consulente');
                  } else if (mode === 'all') {
                    stores.push(`Store Privato di ${nonEmployeeClients.length + employeeClients.length} clienti/dipendenti`);
                  } else if (mode === 'clients_only') {
                    stores.push(`Store Privato di ${nonEmployeeClients.length} clienti`);
                  } else if (mode === 'specific_clients') {
                    form.target_client_ids.forEach(cid => {
                      const client = nonEmployeeClients.find(c => c.id === cid) || employeeClients.find(c => c.id === cid);
                      if (client) stores.push(`Store Privato: ${client.firstName} ${client.lastName}`);
                    });
                  } else if (mode === 'employees_only') {
                    stores.push(`Store Privato di ${employeeClients.length} dipendenti`);
                  } else if (mode === 'specific_departments') {
                    form.target_department_ids.forEach(did => {
                      const dept = departments.find(d => d.id === did);
                      if (dept) stores.push(`Store Reparto: ${dept.name}`);
                    });
                  } else if (mode === 'specific_employees') {
                    form.target_client_ids.forEach(cid => {
                      const emp = employeeClients.find(c => c.id === cid);
                      if (emp) stores.push(`Store Privato: ${emp.firstName} ${emp.lastName}`);
                    });
                  }
                }
                Object.entries(form.target_whatsapp_agents).filter(([, v]) => v).forEach(([agentId]) => {
                  const agent = whatsappAgents.find(a => a.id === agentId);
                  if (agent) stores.push(`Store WhatsApp Agent: ${agent.agent_name}`);
                });
                Object.entries(form.target_autonomous_agents).filter(([, v]) => v).forEach(([agentId]) => {
                  const agent = AUTONOMOUS_AGENTS.find(a => a.id === agentId);
                  if (agent) stores.push(`Store Agente Autonomo: ${agent.name}`);
                });
                return (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">📦 Store destinazione File Search</p>
                      {stores.length > 0 ? (
                        <div className="space-y-1">
                          {stores.map((store, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                              <Database className="h-3.5 w-3.5 text-green-500 shrink-0" />
                              <span>{store}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-red-600">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>Nessun destinatario — il documento non verrà sincronizzato in nessuno store</span>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {(() => {
                const warnings: React.ReactNode[] = [];
                if (!form.target_client_assistant &&
                    Object.values(form.target_whatsapp_agents).every(v => !v) &&
                    Object.values(form.target_autonomous_agents).every(v => !v)) {
                  warnings.push(
                    <div key="no-targets" className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>Nessun destinatario selezionato. Il documento verrà creato ma non sarà visibile a nessun agente.</span>
                    </div>
                  );
                }
                if (warnings.length === 0) return null;
                return (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Note</p>
                      {warnings}
                    </div>
                  </>
                );
              })()}

              <Separator />

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                  Modifica
                </Button>
                <Button
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={handleConfirmedSubmit}
                >
                  {editingDoc ? 'Conferma e Salva' : 'Conferma e Crea'}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
