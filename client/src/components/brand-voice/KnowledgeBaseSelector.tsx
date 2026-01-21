import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, AlertTriangle, Upload, Plus, CheckCircle } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface KnowledgeDocument {
  id: string;
  title: string;
  type: string;
  content: string;
  createdAt: string;
}

export interface KnowledgeBaseSelectorProps {
  selectedDocIds: string[];
  onSelectionChange: (docIds: string[]) => void;
  maxTokens?: number;
}

function estimateTokens(content: string): number {
  return Math.ceil((content?.length || 0) / 4);
}

function getTypeBadgeVariant(type: string): "default" | "secondary" | "outline" {
  switch (type?.toLowerCase()) {
    case "pdf":
      return "default";
    case "docx":
      return "secondary";
    default:
      return "outline";
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function KnowledgeBaseSelector({
  selectedDocIds,
  onSelectionChange,
  maxTokens = 50000,
}: KnowledgeBaseSelectorProps) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
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

  const uploadFile = async (file: File, currentSelectedIds: string[]) => {
    setIsUploading(true);
    setUploadProgress(`Caricamento ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^/.]+$/, ""));
      formData.append("description", "");
      formData.append("category", "general");
      formData.append("priority", "50");

      const authHeaders = getAuthHeaders();
      const headers: Record<string, string> = {};
      if (authHeaders.Authorization) {
        headers.Authorization = authHeaders.Authorization;
      }

      const response = await fetch("/api/consultant/knowledge/documents", {
        method: "POST",
        headers,
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore nel caricamento");
      }

      const newDoc = await response.json();
      
      toast({
        title: "Documento caricato",
        description: `${file.name} è stato aggiunto alla Knowledge Base`,
      });

      await fetchDocuments();

      if (newDoc.id) {
        onSelectionChange([...currentSelectedIds, newDoc.id]);
      }
    } catch (err: any) {
      toast({
        title: "Errore caricamento",
        description: err.message || "Impossibile caricare il file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadFile(acceptedFiles[0], selectedDocIds);
    }
  }, [selectedDocIds, onSelectionChange, fetchDocuments, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
      "text/csv": [".csv"],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    disabled: isUploading,
  });

  const totalSelectedTokens = useMemo(() => {
    return documents
      .filter((doc) => selectedDocIds.includes(doc.id))
      .reduce((sum, doc) => sum + estimateTokens(doc.content), 0);
  }, [documents, selectedDocIds]);

  const isOverLimit = totalSelectedTokens > maxTokens;

  const handleToggle = (docId: string) => {
    if (selectedDocIds.includes(docId)) {
      onSelectionChange(selectedDocIds.filter((id) => id !== docId));
    } else {
      onSelectionChange([...selectedDocIds, docId]);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documenti Knowledge Base
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">~{totalSelectedTokens.toLocaleString()} tokens</Badge>
            {isOverLimit && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Supera limite 50k
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors
            ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
            ${isUploading ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {uploadProgress}
            </div>
          ) : isDragActive ? (
            <div className="flex items-center justify-center gap-2 text-sm text-primary">
              <Upload className="h-4 w-4" />
              Rilascia il file qui
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Plus className="h-4 w-4" />
              Trascina un file o clicca per caricare (PDF, DOCX, TXT, MD, CSV)
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-6 text-destructive text-sm">{error}</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Nessun documento. Carica il tuo primo file qui sopra.
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
                    <Badge variant={getTypeBadgeVariant(doc.type)} className="text-xs uppercase">
                      {doc.type || "text"}
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

        {selectedDocIds.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-500" />
            {selectedDocIds.length} documento{selectedDocIds.length > 1 ? "i" : ""} selezionato{selectedDocIds.length > 1 ? "i" : ""}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default KnowledgeBaseSelector;
