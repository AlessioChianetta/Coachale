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
  const [currentFolderId, setCurrentFolderId] = useState<string>("root");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: "root", name: "La mia unità" }]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

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
    queryKey: [`${apiPrefix}/google-drive/folders`, currentFolderId],
    queryFn: async () => {
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
    queryKey: [`${apiPrefix}/google-drive/files`, currentFolderId],
    queryFn: async () => {
      const response = await fetch(`${apiPrefix}/google-drive/files?parentId=${currentFolderId}`, {
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
      return response.json();
    },
    onSuccess: (data) => {
      const importedCount = data.imported || selectedFiles.size;
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
    setCurrentFolderId(folder.id);
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFiles(new Set());
  };

  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolderId(newBreadcrumbs[newBreadcrumbs.length - 1].id);
    setSelectedFiles(new Set());
  };

  const handleFileSelect = (fileId: string, checked: boolean) => {
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
    const files: DriveFile[] = filesData?.files || [];
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map((f) => f.id)));
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

  const isConnected = statusData?.connected === true;
  const connectedEmail = statusData?.email;
  const folders: DriveFolder[] = foldersData?.folders || [];
  const files: DriveFile[] = filesData?.files || [];
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
                  {index === 0 ? <Home className="w-4 h-4 mr-1" /> : null}
                  {crumb.name}
                </Button>
              </div>
            ))}
          </div>

          <ScrollArea className="h-[300px] border rounded-lg">
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

                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Checkbox
                      checked={selectedFiles.has(file.id)}
                      onCheckedChange={(checked) => handleFileSelect(file.id, checked as boolean)}
                    />
                    {getFileIcon(file.mimeType)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      {file.size && (
                        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {files.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedFiles.size === files.length ? "Deseleziona tutti" : "Seleziona tutti"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedFiles.size} file selezionati
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
          )}
        </>
      )}
    </div>
  );
}
