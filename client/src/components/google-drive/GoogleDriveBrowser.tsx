import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Cloud,
  CloudOff,
  Folder,
  FolderOpen,
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileAudio,
  ChevronRight,
  ChevronDown,
  Home,
  Loader2,
  Upload,
  LogOut,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Clock,
  Star,
  Trash2,
  Users,
  HardDrive,
  Search,
  Grid3X3,
  List,
  MoreVertical,
  Plus,
  Monitor,
  AlertTriangle,
  Database,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface GoogleDriveBrowserProps {
  apiPrefix: '/api/consultant' | '/api/client';
  onImportSuccess?: (importedCount: number) => void;
}

interface DriveFolder {
  id: string;
  name: string;
  mimeType: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  iconLink?: string;
  owners?: { displayName: string; emailAddress: string }[];
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

type DriveSection = 'home' | 'my-drive' | 'computer' | 'shared-with-me' | 'recent' | 'starred' | 'spam' | 'trash' | 'storage' | 'synced';

const DRIVE_SECTIONS: { id: DriveSection; label: string; icon: React.ReactNode; expandable?: boolean }[] = [
  { id: 'home', label: 'Home page', icon: <Home className="w-5 h-5" /> },
  { id: 'my-drive', label: 'Il mio Drive', icon: <HardDrive className="w-5 h-5" />, expandable: true },
  { id: 'computer', label: 'Computer', icon: <Monitor className="w-5 h-5" />, expandable: true },
  { id: 'shared-with-me', label: 'Condivisi con me', icon: <Users className="w-5 h-5" /> },
  { id: 'recent', label: 'Recenti', icon: <Clock className="w-5 h-5" /> },
  { id: 'starred', label: 'Speciali', icon: <Star className="w-5 h-5" /> },
  { id: 'spam', label: 'Spam', icon: <AlertTriangle className="w-5 h-5" /> },
  { id: 'trash', label: 'Cestino', icon: <Trash2 className="w-5 h-5" /> },
  { id: 'storage', label: 'Archiviazione', icon: <Database className="w-5 h-5" /> },
];

const getFileIcon = (mimeType: string, size: "sm" | "md" | "lg" = "md") => {
  const sizeClass = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5";
  if (mimeType.includes("folder")) return <Folder className={`${sizeClass} text-gray-500`} />;
  if (mimeType.includes("pdf")) return <FileText className={`${sizeClass} text-red-500`} />;
  if (mimeType.includes("word") || mimeType.includes("document")) return <FileText className={`${sizeClass} text-blue-600`} />;
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("spreadsheet")) return <FileSpreadsheet className={`${sizeClass} text-green-600`} />;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return <FileText className={`${sizeClass} text-orange-500`} />;
  if (mimeType.includes("image")) return <FileImage className={`${sizeClass} text-purple-500`} />;
  if (mimeType.includes("video")) return <FileVideo className={`${sizeClass} text-pink-500`} />;
  if (mimeType.includes("audio")) return <FileAudio className={`${sizeClass} text-yellow-500`} />;
  if (mimeType.includes("text")) return <FileText className={`${sizeClass} text-gray-500`} />;
  return <File className={`${sizeClass} text-gray-400`} />;
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString('it-IT', { month: 'short' });
  return `${day} ${month}`;
};

const getOwnerInitial = (email?: string) => {
  if (!email) return "?";
  return email.charAt(0).toUpperCase();
};

const getOwnerColor = (email?: string) => {
  if (!email) return "bg-gray-400";
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-red-500", 
    "bg-yellow-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"
  ];
  const index = email.charCodeAt(0) % colors.length;
  return colors[index];
};

export default function GoogleDriveBrowser({ apiPrefix, onImportSuccess }: GoogleDriveBrowserProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentSection, setCurrentSection] = useState<DriveSection>('home');
  const [currentFolderId, setCurrentFolderId] = useState<string>("root");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: "root", name: "Home page" }]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [importedFileIds, setImportedFileIds] = useState<Set<string>>(new Set());
  const [isInSharedFolder, setIsInSharedFolder] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const handleSectionChange = (section: DriveSection) => {
    setCurrentSection(section);
    setCurrentFolderId("root");
    const sectionLabel = DRIVE_SECTIONS.find(s => s.id === section)?.label || "Il mio Drive";
    setBreadcrumbs([{ id: "root", name: sectionLabel }]);
    setSelectedFiles(new Set());
    setIsInSharedFolder(false);
  };

  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: [`${apiPrefix}/google-drive/status`],
    queryFn: async () => {
      const response = await fetch(`${apiPrefix}/google-drive/status`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Errore nel caricamento dello stato");
      return response.json();
    },
  });

  const { data: foldersData, isLoading: foldersLoading, refetch: refetchFolders } = useQuery({
    queryKey: [`${apiPrefix}/google-drive/folders`, currentFolderId, currentSection, isInSharedFolder],
    queryFn: async () => {
      if (currentSection !== 'my-drive' && currentSection !== 'home' && !isInSharedFolder) {
        return { success: true, data: [] };
      }
      const response = await fetch(`${apiPrefix}/google-drive/folders?parentId=${currentFolderId}`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Errore nel caricamento delle cartelle");
      return response.json();
    },
    enabled: statusData?.connected === true,
  });

  const { data: filesData, isLoading: filesLoading, refetch: refetchFiles } = useQuery({
    queryKey: [`${apiPrefix}/google-drive/files`, currentFolderId, currentSection, isInSharedFolder],
    queryFn: async () => {
      let endpoint = `${apiPrefix}/google-drive/files?parentId=${currentFolderId}`;
      
      if (isInSharedFolder) {
        endpoint = `${apiPrefix}/google-drive/files?parentId=${currentFolderId}`;
      } else {
        switch (currentSection) {
          case 'shared-with-me':
            endpoint = `${apiPrefix}/google-drive/shared-with-me`;
            break;
          case 'recent':
          case 'home':
            endpoint = `${apiPrefix}/google-drive/recent`;
            break;
          case 'starred':
            endpoint = `${apiPrefix}/google-drive/starred`;
            break;
          case 'trash':
            endpoint = `${apiPrefix}/google-drive/trash`;
            break;
          case 'synced':
            return { success: true, data: [] };
          default:
            endpoint = `${apiPrefix}/google-drive/files?parentId=${currentFolderId}`;
        }
      }
      
      const response = await fetch(endpoint, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Errore nel caricamento dei file");
      return response.json();
    },
    enabled: statusData?.connected === true,
  });

  // Query for synced documents from Knowledge Base
  const { data: syncedDocsData, isLoading: syncedDocsLoading } = useQuery({
    queryKey: [`${apiPrefix}/knowledge/documents/drive-synced`],
    queryFn: async () => {
      const response = await fetch(`${apiPrefix}/knowledge/documents?source=google_drive`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Errore nel caricamento dei documenti sincronizzati");
      return response.json();
    },
    enabled: statusData?.connected === true && currentSection === 'synced',
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${apiPrefix}/google-drive/connect`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Errore nella connessione");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.open(data.authUrl, "_blank", "width=600,height=700");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Errore connessione",
        description: error.message || "Impossibile connettersi a Google Drive",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${apiPrefix}/google-drive/disconnect`, {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Errore nella disconnessione");
      return response.json();
    },
    onSuccess: () => {
      setCurrentFolderId("root");
      setBreadcrumbs([{ id: "root", name: "Home page" }]);
      setSelectedFiles(new Set());
      queryClient.invalidateQueries({ queryKey: [`${apiPrefix}/google-drive/status`] });
      toast({
        title: "Disconnesso",
        description: "Disconnessione da Google Drive completata",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Errore disconnessione",
        description: error.message || "Impossibile disconnettersi da Google Drive",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (fileIds: string[]) => {
      const response = await fetch(`${apiPrefix}/google-drive/import`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        credentials: 'include',
        body: JSON.stringify({ fileIds }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nell'importazione");
      }
      return { ...await response.json(), importedFileIds: fileIds };
    },
    onSuccess: (data) => {
      const importedCount = data.imported || selectedFiles.size;
      setImportedFileIds(prev => {
        const newSet = new Set(prev);
        data.importedFileIds?.forEach((id: string) => newSet.add(id));
        return newSet;
      });
      setSelectedFiles(new Set());
      toast({
        title: "Importazione completata",
        description: `${importedCount} file importati con successo nella Knowledge Base`,
      });
      onImportSuccess?.(importedCount);
    },
    onError: (error: any) => {
      toast({
        title: "Errore importazione",
        description: error.message || "Impossibile importare i file selezionati",
        variant: "destructive",
      });
    },
  });

  const handleFolderClick = (folder: DriveFolder) => {
    if (currentSection !== 'my-drive' && currentSection !== 'home' && !isInSharedFolder) {
      setIsInSharedFolder(true);
    }
    setCurrentFolderId(folder.id);
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFiles(new Set());
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    if (index === 0 && currentSection !== 'my-drive' && currentSection !== 'home') {
      setIsInSharedFolder(false);
    }
    setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    setSelectedFiles(new Set());
  };

  const handleFileSelect = (fileId: string, checked: boolean) => {
    if (importedFileIds.has(fileId)) return;
    
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(fileId);
      } else {
        newSet.delete(fileId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allFiles: DriveFile[] = [...(foldersData?.data || []), ...(filesData?.data || [])];
    const selectableFiles = allFiles.filter(f => !importedFileIds.has(f.id));
    
    if (selectedFiles.size === selectableFiles.length && selectableFiles.length > 0) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(selectableFiles.map((f) => f.id)));
    }
  };

  const handleImport = () => {
    if (selectedFiles.size === 0) {
      toast({
        title: "Nessun file selezionato",
        description: "Seleziona almeno un file da importare",
        variant: "destructive",
      });
      return;
    }
    importMutation.mutate(Array.from(selectedFiles));
  };

  const handleRefresh = () => {
    refetchStatus();
    if (statusData?.connected) {
      refetchFolders();
      refetchFiles();
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "google-drive-connected") {
        refetchStatus();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [refetchStatus]);

  useEffect(() => {
    const checkImportStatus = async () => {
      const files: DriveFile[] = filesData?.data || [];
      if (files.length === 0) {
        setImportedFileIds(new Set());
        return;
      }
      
      try {
        const response = await fetch(`${apiPrefix}/google-drive/import-status`, {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          credentials: 'include',
          body: JSON.stringify({ fileIds: files.map(f => f.id) }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setImportedFileIds(new Set(data.importedFileIds || []));
        }
      } catch (error) {
        console.error("Error checking import status:", error);
      }
    };
    
    checkImportStatus();
  }, [filesData, apiPrefix]);

  const isConnected = statusData?.connected === true;
  const connectedEmail = statusData?.email;
  
  const rawFolders: DriveFolder[] = foldersData?.data || [];
  const rawFiles: DriveFile[] = filesData?.data || [];
  
  const isSpecialSection = ['shared-with-me', 'recent', 'starred', 'trash', 'home'].includes(currentSection);
  const isAtRootLevel = !isInSharedFolder && breadcrumbs.length === 1;
  
  const sharedFolders = isSpecialSection && isAtRootLevel
    ? rawFiles.filter(f => f.mimeType === 'application/vnd.google-apps.folder')
    : [];
  const folders: DriveFolder[] = isSpecialSection && isAtRootLevel ? sharedFolders : rawFolders;
  const files: DriveFile[] = isSpecialSection && isAtRootLevel
    ? rawFiles.filter(f => f.mimeType !== 'application/vnd.google-apps.folder')
    : rawFiles;
  
  const isLoadingContent = foldersLoading || filesLoading;

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-xl">
        <Loader2 className="w-8 h-8 animate-spin text-[#1a73e8]" />
        <span className="ml-3 text-gray-600 text-lg">Caricamento...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="p-4 bg-gray-100 rounded-full mb-4">
            <CloudOff className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-medium text-gray-800 mb-2">Google Drive non connesso</h3>
          <p className="text-gray-500 text-center mb-6 max-w-md">
            Connetti il tuo account Google Drive per sfogliare e importare i tuoi file nella Knowledge Base
          </p>
          <Button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="bg-[#1a73e8] hover:bg-[#1557b0] text-white px-6 py-3 text-base"
            size="lg"
          >
            {connectMutation.isPending ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="w-5 h-5 mr-2" />
            )}
            Connetti Google Drive
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ minHeight: '600px' }}>
      <div className="flex h-full">
        {/* Sidebar - sticky to stay visible while scrolling */}
        <div className="w-64 border-r border-gray-200 bg-white flex flex-col sticky top-0 max-h-screen overflow-y-auto self-start">
          {/* Drive Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <svg viewBox="0 0 87.3 78" className="w-10 h-10">
                <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066da"/>
                <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.55c-.8 1.4-1.2 2.95-1.2 4.5h27.5l16.15-28.05z" fill="#00ac47"/>
                <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H60.7L43.65 25l-16.2 28.05 16.15 28c1.75-1.05 3.15-2.55 4.05-4.35l25.9-44.9z" fill="#ea4335"/>
                <path d="M43.65 25l16.2 28.05H87.3c0-1.55-.4-3.1-1.2-4.5L60.7 5.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25z" fill="#00832d"/>
                <path d="M27.5 53.05L11.35 76.8c1.35.8 2.9 1.2 4.5 1.2h55.6c1.6 0 3.15-.45 4.5-1.2l-16.2-23.75H27.5z" fill="#2684fc"/>
                <path d="M43.65 25L27.5 53.05h32.2L43.65 25z" fill="#ffba00"/>
              </svg>
              <span className="text-xl font-normal text-gray-700">Drive</span>
            </div>
            
            <Button 
              className="w-full justify-start gap-3 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 shadow-sm rounded-full py-3 px-4"
              variant="outline"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Nuovo</span>
            </Button>
          </div>
          
          {/* Navigation */}
          <ScrollArea className="flex-1 py-2">
            <div className="space-y-0.5 px-2">
              {DRIVE_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleSectionChange(section.id)}
                  className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-full text-left transition-colors ${
                    currentSection === section.id
                      ? "bg-[#c2e7ff] text-[#001d35]"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className={currentSection === section.id ? "text-[#001d35]" : "text-gray-600"}>
                    {section.icon}
                  </span>
                  <span className="text-sm font-medium flex-1">{section.label}</span>
                  {section.expandable && (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              ))}
              
              {/* Synced section */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="px-4 mb-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Già sincronizzati</p>
                <button
                  onClick={() => handleSectionChange('synced' as DriveSection)}
                  className={`w-full flex items-center gap-4 px-4 py-2.5 rounded-full text-left transition-colors ${
                    currentSection === 'synced'
                      ? "bg-[#c2e7ff] text-[#001d35]"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className={currentSection === 'synced' ? "text-[#001d35]" : "text-gray-600"}>
                    <CheckCircle2 className="w-5 h-5" />
                  </span>
                  <span className="text-sm font-medium flex-1">Nella Knowledge Base</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                    {importedFileIds.size}
                  </Badge>
                </button>
              </div>
            </div>
          </ScrollArea>
          
          {/* Storage indicator */}
          <div className="p-4 border-t border-gray-100">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>2,56 GB di 2 TB di spazio utilizzato</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1">
                <div className="bg-[#1a73e8] h-1 rounded-full" style={{ width: '1.28%' }}></div>
              </div>
              <button className="text-[#1a73e8] text-sm font-medium hover:underline">
                Acquista altro spazio di archiviazione
              </button>
            </div>
            
            {/* Connection status */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-gray-500 truncate max-w-[140px]">{connectedEmail}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="h-7 px-2 text-gray-500 hover:text-gray-700"
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-[#f8fafd]">
          {/* Header with welcome text */}
          <div className="px-8 py-6 text-center border-b border-gray-100 bg-white">
            <h1 className="text-2xl text-gray-700 font-normal">Ti diamo il benvenuto in Drive</h1>
          </div>

          {/* Search Bar */}
          <div className="px-8 py-4 bg-white">
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Cerca in Drive"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 text-base bg-[#edf2fc] border-0 rounded-full focus:bg-white focus:ring-1 focus:ring-[#1a73e8] focus:shadow-md transition-all"
                />
              </div>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="px-8 py-3 flex items-center gap-2 flex-wrap bg-white border-b border-gray-100">
            {['Tipo', 'Persone', 'Data modifica', 'Posizione'].map((filter) => (
              <button
                key={filter}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm text-gray-700 transition-colors"
              >
                <Folder className="w-4 h-4 text-gray-500" />
                <span>{filter}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            ))}
            
            <div className="flex-1"></div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoadingContent}
              className="text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingContent ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto px-8 py-4">
            {/* Breadcrumbs when navigating */}
            {breadcrumbs.length > 1 && (
              <div className="flex items-center gap-1 text-sm mb-4 overflow-x-auto">
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.id} className="flex items-center shrink-0">
                    {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />}
                    <button
                      className="px-2 py-1 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                      onClick={() => handleBreadcrumbClick(index)}
                    >
                      {crumb.name}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Synced Documents Section */}
            {currentSection === 'synced' ? (
              syncedDocsLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-[#1a73e8]" />
                  <span className="ml-3 text-gray-500">Caricamento documenti sincronizzati...</span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-medium text-gray-800">Documenti sincronizzati con Knowledge Base</h2>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      {syncedDocsData?.data?.length || 0} documenti
                    </Badge>
                  </div>
                  
                  {(!syncedDocsData?.data || syncedDocsData.data.length === 0) ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                      <CheckCircle2 className="w-16 h-16 text-gray-300 mb-4" />
                      <p className="text-lg">Nessun documento sincronizzato</p>
                      <p className="text-sm text-gray-400 mt-1">Importa file da Google Drive per vederli qui</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg border border-gray-200">
                      <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        <div className="col-span-5">Nome</div>
                        <div className="col-span-3">Ultima sincronizzazione</div>
                        <div className="col-span-2">Sincronizzazioni</div>
                        <div className="col-span-2">Stato</div>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {syncedDocsData.data.map((doc: any) => (
                          <div key={doc.id} className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-gray-50">
                            <div className="col-span-5 flex items-center gap-3 min-w-0">
                              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                              {getFileIcon(doc.mimeType || 'application/pdf', "md")}
                              <span className="text-sm text-gray-800 truncate">{doc.title}</span>
                            </div>
                            <div className="col-span-3 text-sm text-gray-500">
                              {doc.lastDriveSyncAt ? formatDate(doc.lastDriveSyncAt) : formatDate(doc.createdAt)}
                            </div>
                            <div className="col-span-2 text-sm text-gray-600">
                              {doc.syncCount || 1}x
                            </div>
                            <div className="col-span-2">
                              <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
                                Sincronizzato
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : isLoadingContent ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#1a73e8]" />
                <span className="ml-3 text-gray-500">Caricamento...</span>
              </div>
            ) : (
              <>
                {/* Suggested Folders Section */}
                {folders.length > 0 && (
                  <div className="mb-6">
                    <button className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3 hover:text-gray-900">
                      <ChevronDown className="w-4 h-4" />
                      <span>Cartelle suggerite</span>
                    </button>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {folders.slice(0, 5).map((folder) => (
                        <div
                          key={folder.id}
                          onClick={() => handleFolderClick(folder)}
                          className="flex-shrink-0 w-56 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer transition-all group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <Folder className="w-6 h-6 text-gray-500" />
                              <div className="min-w-0">
                                <p className="font-medium text-gray-800 truncate text-sm">{folder.name}</p>
                                <p className="text-xs text-gray-500 mt-0.5">in Il mio Drive</p>
                              </div>
                            </div>
                            <button className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-100 rounded transition-opacity">
                              <MoreVertical className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Files Section */}
                {(files.length > 0 || folders.length > 0) && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <button className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900">
                        <ChevronDown className="w-4 h-4" />
                        <span>File suggeriti</span>
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewMode('list')}
                          className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-[#c2e7ff] text-[#001d35]' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                          <List className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-[#c2e7ff] text-[#001d35]' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                          <Grid3X3 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Table Header */}
                    <div className="bg-white rounded-t-lg border border-gray-200">
                      <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        <div className="col-span-5 flex items-center gap-3">
                          <div className="w-6"></div>
                          <span>Nome</span>
                        </div>
                        <div className="col-span-3">Motivo del suggerimento</div>
                        <div className="col-span-2">Proprietario</div>
                        <div className="col-span-2">Posizione</div>
                      </div>

                      {/* File Rows */}
                      <div className="divide-y divide-gray-100">
                        {[...folders, ...files].map((item) => {
                          const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
                          const file = item as DriveFile;
                          const isImported = importedFileIds.has(item.id);
                          const isSelected = selectedFiles.has(item.id);
                          const isHovered = hoveredRow === item.id;
                          const ownerEmail = file.owners?.[0]?.emailAddress || connectedEmail;
                          
                          return (
                            <div
                              key={item.id}
                              className={`grid grid-cols-12 gap-4 px-4 py-3 items-center transition-colors cursor-pointer ${
                                isSelected ? 'bg-[#e8f0fe]' : isHovered ? 'bg-gray-50' : ''
                              } ${isImported ? 'opacity-60' : ''}`}
                              onMouseEnter={() => setHoveredRow(item.id)}
                              onMouseLeave={() => setHoveredRow(null)}
                              onClick={() => isFolder ? handleFolderClick(item as DriveFolder) : null}
                            >
                              <div className="col-span-5 flex items-center gap-3 min-w-0">
                                <div className="w-6 flex items-center justify-center">
                                  {(isHovered || isSelected) && !isImported ? (
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        handleFileSelect(item.id, checked as boolean);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-5 h-5 rounded border-2 border-gray-400 data-[state=checked]:bg-[#1a73e8] data-[state=checked]:border-[#1a73e8]"
                                    />
                                  ) : isImported ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                  ) : null}
                                </div>
                                {getFileIcon(item.mimeType, "md")}
                                <span className={`text-sm truncate ${isImported ? 'text-gray-500' : 'text-gray-800'}`}>
                                  {item.name}
                                </span>
                                {isImported && (
                                  <Badge variant="secondary" className="shrink-0 bg-green-100 text-green-700 text-xs px-2 py-0.5">
                                    Importato
                                  </Badge>
                                )}
                              </div>
                              <div className="col-span-3 text-sm text-gray-500 truncate">
                                {file.modifiedTime ? `Aperto da te • ${formatDate(file.modifiedTime)}` : 'Lo hai aperto spesso'}
                              </div>
                              <div className="col-span-2 flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-full ${getOwnerColor(ownerEmail)} flex items-center justify-center text-white text-xs font-medium`}>
                                  {getOwnerInitial(ownerEmail)}
                                </div>
                                <span className="text-sm text-gray-600 truncate">me</span>
                              </div>
                              <div className="col-span-2 flex items-center gap-2 text-sm text-gray-500">
                                <Folder className="w-4 h-4 text-gray-400" />
                                <span className="truncate">Il mio Drive</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Show More Link */}
                    <div className="py-4">
                      <button className="text-[#1a73e8] text-sm font-medium hover:underline">
                        Mostra altro
                      </button>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {folders.length === 0 && files.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <Folder className="w-16 h-16 text-gray-300 mb-4" />
                    <p className="text-lg">Questa cartella è vuota</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Import Action Bar */}
          {selectedFiles.size > 0 && (
            <div className="px-8 py-4 bg-white border-t border-gray-200 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={handleSelectAll} className="border-gray-300">
                  {selectedFiles.size === [...folders, ...files].filter(f => !importedFileIds.has(f.id)).length 
                    ? "Deseleziona tutti" 
                    : "Seleziona tutti"
                  }
                </Button>
                <span className="text-sm text-gray-600">
                  {selectedFiles.size} file selezionati
                </span>
              </div>

              <Button
                onClick={handleImport}
                disabled={selectedFiles.size === 0 || importMutation.isPending}
                className="bg-[#1a73e8] hover:bg-[#1557b0] text-white px-6 py-2.5 rounded-full text-base font-medium shadow-md"
                size="lg"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Importazione...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Importa nella Knowledge Base ({selectedFiles.size})
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
