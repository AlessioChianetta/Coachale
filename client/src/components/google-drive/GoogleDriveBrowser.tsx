import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Home,
  Loader2,
  Upload,
  LogOut,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Star,
  Trash2,
  Users,
  HardDrive,
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
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

type DriveSection = 'my-drive' | 'shared-with-me' | 'recent' | 'starred' | 'trash';

const DRIVE_SECTIONS: { id: DriveSection; label: string; icon: React.ReactNode }[] = [
  { id: 'my-drive', label: 'Il mio Drive', icon: <HardDrive className="w-4 h-4" /> },
  { id: 'shared-with-me', label: 'Condivisi con me', icon: <Users className="w-4 h-4" /> },
  { id: 'recent', label: 'Recenti', icon: <Clock className="w-4 h-4" /> },
  { id: 'starred', label: 'Speciali', icon: <Star className="w-4 h-4" /> },
  { id: 'trash', label: 'Cestino', icon: <Trash2 className="w-4 h-4" /> },
];

const getFileIcon = (mimeType: string) => {
  if (mimeType.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
  if (mimeType.includes("word") || mimeType.includes("document")) return <FileText className="w-5 h-5 text-blue-500" />;
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("spreadsheet")) return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return <FileText className="w-5 h-5 text-orange-500" />;
  if (mimeType.includes("image")) return <FileImage className="w-5 h-5 text-purple-500" />;
  if (mimeType.includes("video")) return <FileVideo className="w-5 h-5 text-pink-500" />;
  if (mimeType.includes("audio")) return <FileAudio className="w-5 h-5 text-yellow-500" />;
  if (mimeType.includes("text")) return <FileText className="w-5 h-5 text-gray-500" />;
  return <File className="w-5 h-5 text-gray-400" />;
};

const formatFileSize = (size?: string) => {
  if (!size) return "";
  const bytes = parseInt(size);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function GoogleDriveBrowser({ apiPrefix, onImportSuccess }: GoogleDriveBrowserProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentSection, setCurrentSection] = useState<DriveSection>('my-drive');
  const [currentFolderId, setCurrentFolderId] = useState<string>("root");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: "root", name: "La mia unità" }]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [importedFileIds, setImportedFileIds] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [isInSharedFolder, setIsInSharedFolder] = useState(false);

  // Handle section change
  const handleSectionChange = (section: DriveSection) => {
    setCurrentSection(section);
    setCurrentFolderId("root");
    setBreadcrumbs([{ id: "root", name: DRIVE_SECTIONS.find(s => s.id === section)?.label || "La mia unità" }]);
    setSelectedFiles(new Set());
    setPreviewFile(null);
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

  // Folders query - for my-drive section OR when navigating inside a shared folder
  const { data: foldersData, isLoading: foldersLoading, refetch: refetchFolders } = useQuery({
    queryKey: [`${apiPrefix}/google-drive/folders`, currentFolderId, currentSection, isInSharedFolder],
    queryFn: async () => {
      // Show folders if in my-drive OR navigating inside a shared folder
      if (currentSection !== 'my-drive' && !isInSharedFolder) {
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

  // Files query - different endpoint based on section (or standard if navigating inside shared folder)
  const { data: filesData, isLoading: filesLoading, refetch: refetchFiles } = useQuery({
    queryKey: [`${apiPrefix}/google-drive/files`, currentFolderId, currentSection, isInSharedFolder],
    queryFn: async () => {
      let endpoint = `${apiPrefix}/google-drive/files?parentId=${currentFolderId}`;
      
      // If navigating inside a shared folder, use standard files endpoint
      if (isInSharedFolder) {
        endpoint = `${apiPrefix}/google-drive/files?parentId=${currentFolderId}`;
      } else {
        switch (currentSection) {
          case 'shared-with-me':
            endpoint = `${apiPrefix}/google-drive/shared-with-me`;
            break;
          case 'recent':
            endpoint = `${apiPrefix}/google-drive/recent`;
            break;
          case 'starred':
            endpoint = `${apiPrefix}/google-drive/starred`;
            break;
          case 'trash':
            endpoint = `${apiPrefix}/google-drive/trash`;
            break;
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
      setBreadcrumbs([{ id: "root", name: "La mia unità" }]);
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
      // Add imported file IDs to the set
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
    // If in a special section (not my-drive), mark that we're navigating into a shared folder
    if (currentSection !== 'my-drive' && !isInSharedFolder) {
      setIsInSharedFolder(true);
    }
    setCurrentFolderId(folder.id);
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFiles(new Set());
    setPreviewFile(null);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    // If going back to root in a special section, exit shared folder mode
    if (index === 0 && currentSection !== 'my-drive') {
      setIsInSharedFolder(false);
    }
    setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    setSelectedFiles(new Set());
  };

  const handleFileSelect = (fileId: string, checked: boolean) => {
    // Don't allow selecting already imported files
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
    const files: DriveFile[] = filesData?.data || [];
    const selectableFiles = files.filter(f => !importedFileIds.has(f.id));
    const currentlySelected = Array.from(selectedFiles).filter(id => !importedFileIds.has(id));
    
    if (currentlySelected.length === selectableFiles.length && selectableFiles.length > 0) {
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

  // Check which files are already imported
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
  const folders: DriveFolder[] = foldersData?.data || [];
  const files: DriveFile[] = filesData?.data || [];
  const isLoadingContent = foldersLoading || filesLoading;

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Caricamento...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Cloud className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Connesso
                  </Badge>
                </div>
                {connectedEmail && (
                  <p className="text-sm text-muted-foreground mt-0.5">{connectedEmail}</p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <CloudOff className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <Badge variant="secondary">Non connesso</Badge>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Connetti per sfogliare i tuoi file
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoadingContent}
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingContent ? "animate-spin" : ""}`} />
            </Button>
          )}
          {isConnected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4 mr-2" />
              )}
              Disconnetti
            </Button>
          ) : (
            <Button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
            >
              {connectMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Connetti Google Drive
            </Button>
          )}
        </div>
      </div>

      {isConnected && (
        <>
          <Separator />

          <div className="flex gap-4">
            {/* Sidebar */}
            <div className="w-48 shrink-0 space-y-1">
              {DRIVE_SECTIONS.map((section) => (
                <Button
                  key={section.id}
                  variant={currentSection === section.id ? "secondary" : "ghost"}
                  size="sm"
                  className={`w-full justify-start gap-2 ${
                    currentSection === section.id 
                      ? "bg-primary/10 text-primary" 
                      : ""
                  }`}
                  onClick={() => handleSectionChange(section.id)}
                >
                  {section.icon}
                  {section.label}
                </Button>
              ))}
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Breadcrumbs - show for my-drive OR when navigating inside shared folders */}
              {(currentSection === 'my-drive' || isInSharedFolder || breadcrumbs.length > 1) && (
                <div className="flex items-center gap-1 text-sm overflow-x-auto pb-2">
                  {breadcrumbs.map((crumb, index) => (
                    <div key={crumb.id} className="flex items-center shrink-0">
                      {index > 0 && <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleBreadcrumbClick(index)}
                      >
                        {index === 0 ? (
                          <>
                            {DRIVE_SECTIONS.find(s => s.id === currentSection)?.icon}
                            <span className="ml-1">{crumb.name}</span>
                          </>
                        ) : crumb.name}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Section title for non-folder views (only at root level) */}
              {currentSection !== 'my-drive' && !isInSharedFolder && breadcrumbs.length === 1 && (
                <div className="flex items-center gap-2 pb-2">
                  {DRIVE_SECTIONS.find(s => s.id === currentSection)?.icon}
                  <span className="text-sm font-medium">
                    {DRIVE_SECTIONS.find(s => s.id === currentSection)?.label}
                  </span>
                </div>
              )}

              <ScrollArea className="h-[280px] border rounded-lg">
            {isLoadingContent ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Caricamento...</span>
              </div>
            ) : folders.length === 0 && files.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Folder className="w-12 h-12 text-gray-300 mb-3" />
                <p>Questa cartella è vuota</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={() => handleFolderClick(folder)}
                  >
                    <FolderOpen className="w-5 h-5 text-amber-500 shrink-0" />
                    <span className="text-sm font-medium truncate flex-1">{folder.name}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                ))}

                {files.length > 0 && folders.length > 0 && <Separator className="my-2" />}

                {files.map((file) => {
                  const isImported = importedFileIds.has(file.id);
                  return (
                    <div
                      key={file.id}
                      className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                        isImported 
                          ? "bg-green-50 dark:bg-green-900/20 opacity-75" 
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
                      <Checkbox
                        checked={isImported || selectedFiles.has(file.id)}
                        onCheckedChange={(checked) => handleFileSelect(file.id, checked as boolean)}
                        disabled={isImported}
                      />
                      {getFileIcon(file.mimeType)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium truncate ${isImported ? "text-muted-foreground" : ""}`}>
                            {file.name}
                          </p>
                          {isImported && (
                            <Badge variant="secondary" className="shrink-0 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Già importato
                            </Badge>
                          )}
                        </div>
                        {file.size && (
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
              </ScrollArea>

              {files.length > 0 && (() => {
                const selectableFiles = files.filter(f => !importedFileIds.has(f.id));
                const importedCount = files.length - selectableFiles.length;
                return (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectableFiles.length > 0 && (
                      <Button variant="outline" size="sm" onClick={handleSelectAll}>
                        {selectedFiles.size === selectableFiles.length ? "Deseleziona tutti" : "Seleziona tutti"}
                      </Button>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {selectedFiles.size} file selezionati
                      {importedCount > 0 && ` • ${importedCount} già importati`}
                    </span>
                  </div>

                  <Button
                    onClick={handleImport}
                    disabled={selectedFiles.size === 0 || importMutation.isPending}
                  >
                    {importMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importazione...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Importa selezionati ({selectedFiles.size})
                      </>
                    )}
                  </Button>
                </div>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
