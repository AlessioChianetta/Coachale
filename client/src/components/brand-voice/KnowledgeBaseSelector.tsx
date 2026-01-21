import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, 
  FileText, 
  AlertTriangle, 
  Upload, 
  CheckCircle2, 
  AlertCircle,
  Trash2,
  Library,
  FileUp
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface KnowledgeDocument {
  id: string;
  title: string;
  type: string;
  content: string;
  createdAt: string;
}

export interface TempFile {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  content: string;
  tokenEstimate: number;
  status: "uploading" | "processing" | "success" | "error";
  progress: number;
  error?: string;
}

export interface KnowledgeBaseSelectorProps {
  selectedDocIds: string[];
  onSelectionChange: (docIds: string[]) => void;
  tempFiles: TempFile[];
  onTempFilesChange: React.Dispatch<React.SetStateAction<TempFile[]>>;
  maxTokens?: number;
}

function estimateTokens(content: string): number {
  return Math.ceil((content?.length || 0) / 4);
}

function getTypeBadgeColor(type: string): string {
  switch (type?.toLowerCase()) {
    case "pdf":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "docx":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "txt":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "md":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    case "csv":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function KnowledgeBaseSelector({
  selectedDocIds,
  onSelectionChange,
  tempFiles,
  onTempFilesChange,
  maxTokens = 50000,
}: KnowledgeBaseSelectorProps) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showKbDocs, setShowKbDocs] = useState(false);
  const { toast } = useToast();

  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/consultant/knowledge/documents", {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Errore nel caricamento dei documenti");
      }
      const result = await response.json();
      const docs = Array.isArray(result) ? result : (result.data || []);
      setDocuments(docs.map((doc: any) => ({
        id: doc.id,
        title: doc.title || doc.displayName || "Documento",
        type: doc.fileType || doc.type || "text",
        content: doc.extractedContent || doc.content || doc.summary || "",
        createdAt: doc.createdAt,
      })));
    } catch (err: any) {
      setError(err.message || "Errore sconosciuto");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const uploadFile = async (file: File) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newTempFile: TempFile = {
      id: tempId,
      title: file.name.replace(/\.[^/.]+$/, ""),
      fileName: file.name,
      fileType: file.name.split(".").pop()?.toLowerCase() || "txt",
      fileSize: file.size,
      content: "",
      tokenEstimate: 0,
      status: "uploading",
      progress: 30,
    };

    // Usa functional update per evitare stale state con upload multipli
    onTempFilesChange(prev => [...prev, newTempFile]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const authHeaders = getAuthHeaders();
      const headers: Record<string, string> = {};
      if (authHeaders.Authorization) {
        headers.Authorization = authHeaders.Authorization;
      }

      // Aggiorna stato a "processing"
      onTempFilesChange(prev => prev.map(f => 
        f.id === tempId ? { ...f, status: "processing" as const, progress: 60 } : f
      ));

      const response = await fetch("/api/content/extract-text", {
        method: "POST",
        headers,
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nell'estrazione");
      }

      const result = await response.json();
      
      onTempFilesChange(prev => prev.map(f => 
        f.id === tempId 
          ? { 
              ...f, 
              status: "success" as const, 
              progress: 100,
              content: result.data.content,
              tokenEstimate: result.data.tokenEstimate,
              title: result.data.title,
              fileType: result.data.fileType,
            } 
          : f
      ));

      toast({
        title: "File caricato",
        description: `${file.name} pronto per la generazione`,
      });

    } catch (err: any) {
      onTempFilesChange(prev => prev.map(f => 
        f.id === tempId 
          ? { ...f, status: "error" as const, error: err.message } 
          : f
      ));
      
      toast({
        title: "Errore caricamento",
        description: err.message || "Impossibile caricare il file",
        variant: "destructive",
      });
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => uploadFile(file));
  }, [tempFiles, onTempFilesChange, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
      "text/plain": [".txt"],
    },
    maxFiles: 10,
    multiple: true,
  });

  const removeTempFile = (id: string) => {
    onTempFilesChange(tempFiles.filter(f => f.id !== id));
  };

  const totalTempTokens = useMemo(() => {
    return tempFiles
      .filter(f => f.status === "success")
      .reduce((sum, f) => sum + f.tokenEstimate, 0);
  }, [tempFiles]);

  const totalKbTokens = useMemo(() => {
    return documents
      .filter((doc) => selectedDocIds.includes(doc.id))
      .reduce((sum, doc) => sum + estimateTokens(doc.content), 0);
  }, [documents, selectedDocIds]);

  const totalTokens = totalTempTokens + totalKbTokens;
  const isOverLimit = totalTokens > maxTokens;

  const handleToggle = (docId: string) => {
    if (selectedDocIds.includes(docId)) {
      onSelectionChange(selectedDocIds.filter((id) => id !== docId));
    } else {
      onSelectionChange([...selectedDocIds, docId]);
    }
  };

  const successfulTempFiles = tempFiles.filter(f => f.status === "success");
  const hasContent = successfulTempFiles.length > 0 || selectedDocIds.length > 0;

  return (
    <Card className="border-2 border-orange-500/20 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-orange-500/5 to-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-base">Knowledge Base</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">~{totalTokens.toLocaleString()} tokens</Badge>
            {isOverLimit && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Supera limite 50k
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Documenti e informazioni aggiuntive per l'AI
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div
          {...getRootProps()}
          className={`relative p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
            isDragActive
              ? "border-primary bg-primary/10 scale-[1.02]"
              : "border-primary/30 bg-gradient-to-br from-primary/5 to-orange-500/5 hover:border-primary/50 hover:bg-primary/10"
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="p-4 rounded-full bg-primary/10">
              <FileUp className="h-8 w-8 text-primary" />
            </div>
            {isDragActive ? (
              <div>
                <p className="text-lg font-semibold text-primary">
                  Rilascia i file qui...
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-semibold">
                  🎯 Upload Veloce
                </p>
                <p className="text-sm text-muted-foreground">
                  Trascina i tuoi documenti qui o clicca per selezionarli
                </p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    PDF
                  </Badge>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    DOCX
                  </Badge>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    TXT
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Fino a 10 file alla volta • Titolo automatico • Solo per questa generazione
                </p>
              </div>
            )}
          </div>
        </div>

        {tempFiles.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              File caricati per questa generazione:
            </p>
            {tempFiles.map((file) => (
              <div
                key={file.id}
                className={`p-3 rounded-lg border ${
                  file.status === "success" 
                    ? "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800"
                    : file.status === "error"
                    ? "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800"
                    : "bg-primary/5 border-primary/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {file.status === "success" && (
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      )}
                      {file.status === "error" && (
                        <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                      )}
                      {(file.status === "uploading" || file.status === "processing") && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                      )}
                      <span className="font-medium text-sm truncate">{file.title}</span>
                      <Badge variant="secondary" className={`text-xs ${getTypeBadgeColor(file.fileType)}`}>
                        {file.fileType.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>📎 {file.fileName}</span>
                      <span>• {formatFileSize(file.fileSize)}</span>
                      {file.status === "success" && (
                        <span>• ~{file.tokenEstimate.toLocaleString()} tokens</span>
                      )}
                    </div>
                    {file.error && (
                      <p className="text-xs text-destructive mt-1">{file.error}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTempFile(file.id)}
                    className="text-muted-foreground hover:text-destructive flex-shrink-0 h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {file.status !== "success" && file.status !== "error" && (
                  <Progress value={file.progress} className="h-1 mt-2" />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowKbDocs(!showKbDocs)}
            className="w-full border-primary/30 hover:border-primary/50 hover:bg-primary/5"
          >
            <Library className="h-4 w-4 mr-2" />
            {showKbDocs ? "Nascondi" : "📥 Importa da"} Knowledge Base
            {selectedDocIds.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedDocIds.length} selezionato/i
              </Badge>
            )}
          </Button>
        </div>

        {showKbDocs && (
          <div className="space-y-2 pt-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-6 text-destructive text-sm">{error}</div>
            ) : documents.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Nessun documento nella Knowledge Base
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-1 pr-4">
                  {documents.map((doc) => {
                    const tokens = estimateTokens(doc.content);
                    const isSelected = selectedDocIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        className={`
                          flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors
                          ${isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/50"}
                        `}
                        onClick={() => handleToggle(doc.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggle(doc.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.title}</p>
                        </div>
                        <Badge variant="secondary" className={`text-xs ${getTypeBadgeColor(doc.type)}`}>
                          {doc.type.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          ~{tokens.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {hasContent && (
          <div className="flex items-center gap-2 pt-2 border-t text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            {successfulTempFiles.length > 0 && (
              <span>{successfulTempFiles.length} file temp</span>
            )}
            {successfulTempFiles.length > 0 && selectedDocIds.length > 0 && (
              <span>+</span>
            )}
            {selectedDocIds.length > 0 && (
              <span>{selectedDocIds.length} da KB</span>
            )}
            <span className="text-xs">= ~{totalTokens.toLocaleString()} tokens totali</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default KnowledgeBaseSelector;
