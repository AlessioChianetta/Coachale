import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import {
  BookOpen,
  Upload,
  FileText,
  File,
  Trash2,
  Loader2,
  RefreshCw,
  Plus,
  X,
  Search,
  Brain,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface EmailAccountKnowledgeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
}

interface KnowledgeItem {
  id: string;
  accountId: string;
  title: string;
  content: string | null;
  type: string;
  fileName: string | null;
  filePath: string | null;
  mimeType: string | null;
  fileSize: number | null;
  isIndexed: boolean;
  createdAt: string;
  updatedAt: string;
}

export function EmailAccountKnowledge({
  open,
  onOpenChange,
  accountId,
  accountName,
}: EmailAccountKnowledgeProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddText, setShowAddText] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);

  const { data: knowledgeData, isLoading, refetch } = useQuery({
    queryKey: ["email-account-knowledge", accountId],
    queryFn: async () => {
      const response = await fetch(`/api/email-hub/accounts/${accountId}/knowledge`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Errore nel caricamento documenti");
      return response.json();
    },
    enabled: open && !!accountId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/email-hub/accounts/${accountId}/knowledge`, {
        method: "POST",
        headers: {
          ...Object.fromEntries(Object.entries(getAuthHeaders()).filter(([k]) => k !== "Content-Type")),
        },
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Errore durante il caricamento");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-account-knowledge", accountId] });
      toast({
        title: "Documento caricato",
        description: "Il documento è stato aggiunto alla Knowledge Base.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addTextMutation = useMutation({
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      const response = await fetch(`/api/email-hub/accounts/${accountId}/knowledge`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, content, type: "text" }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Errore durante l'aggiunta");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-account-knowledge", accountId] });
      setNewTitle("");
      setNewContent("");
      setShowAddText(false);
      toast({
        title: "Documento aggiunto",
        description: "Il testo è stato aggiunto alla Knowledge Base.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch(`/api/email-hub/accounts/${accountId}/knowledge/${itemId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Errore durante l'eliminazione");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-account-knowledge", accountId] });
      toast({
        title: "Documento eliminato",
        description: "Il documento è stato rimosso dalla Knowledge Base.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/email-hub/accounts/${accountId}/knowledge/sync`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Errore durante la sincronizzazione");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["email-account-knowledge", accountId] });
      toast({
        title: "Sincronizzazione completata",
        description: `${data.synced} documenti sincronizzati, ${data.failed} errori.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      setUploadingFiles((prev) => [...prev, file.name]);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^/.]+$/, ""));
      
      // Determine file type from extension
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      let fileType = 'txt';
      if (extension === 'pdf') fileType = 'pdf';
      else if (extension === 'docx' || extension === 'doc') fileType = 'docx';
      else if (extension === 'txt') fileType = 'txt';
      formData.append("type", fileType);
      
      try {
        await uploadMutation.mutateAsync(formData);
      } finally {
        setUploadingFiles((prev) => prev.filter((f) => f !== file.name));
      }
    }
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 5,
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return <FileText className="h-4 w-4 text-red-500" />;
      case "docx":
      case "doc":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "txt":
      case "text":
        return <File className="h-4 w-4 text-gray-500" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const items: KnowledgeItem[] = knowledgeData?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Knowledge Base - {accountName}
          </DialogTitle>
          <DialogDescription>
            Documenti utilizzati dall'AI per rispondere alle email di questo account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                <Brain className="h-3 w-3 mr-1" />
                {items.length} documenti
              </Badge>
              <Badge variant={items.filter(i => i.isIndexed).length === items.length ? "default" : "secondary"}>
                {items.filter(i => i.isIndexed).length} indicizzati
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending || items.length === 0}
              >
                {syncMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Sincronizza
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddText(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Aggiungi testo
              </Button>
            </div>
          </div>

          <Card
            {...getRootProps()}
            className={`border-2 border-dashed cursor-pointer transition-colors p-4 ${
              isDragActive
                ? "border-primary bg-primary/10"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center text-center py-4">
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium mb-1">
                {isDragActive ? "Rilascia i file qui..." : "Trascina i file qui"}
              </p>
              <p className="text-xs text-muted-foreground">
                Supportati: PDF, DOC, DOCX, TXT (max 10MB)
              </p>
            </div>
          </Card>

          {uploadingFiles.length > 0 && (
            <div className="space-y-2">
              {uploadingFiles.map((fileName) => (
                <div key={fileName} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Caricamento: {fileName}
                </div>
              ))}
            </div>
          )}

          <Separator />

          {showAddText && (
            <Card className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Aggiungi contenuto testuale</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddText(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Titolo</Label>
                <Input
                  id="title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="es. FAQ Servizi, Prezzi, Politiche..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Contenuto</Label>
                <Textarea
                  id="content"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Inserisci qui le informazioni che l'AI può utilizzare per rispondere..."
                  rows={5}
                />
              </div>
              <Button
                onClick={() => addTextMutation.mutate({ title: newTitle, content: newContent })}
                disabled={!newTitle.trim() || !newContent.trim() || addTextMutation.isPending}
              >
                {addTextMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                Aggiungi
              </Button>
            </Card>
          )}

          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mb-2 opacity-50" />
                <p className="text-sm">Nessun documento nella Knowledge Base</p>
                <p className="text-xs">Carica documenti o aggiungi testo per migliorare le risposte AI</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <Card key={item.id} className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getTypeIcon(item.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {item.type.toUpperCase()}
                            </Badge>
                            {item.fileSize && (
                              <span className="text-xs text-muted-foreground">
                                {formatFileSize(item.fileSize)}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(item.createdAt), "d MMM yyyy", { locale: it })}
                            </span>
                          </div>
                          {item.content && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {item.content.substring(0, 150)}...
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={item.isIndexed ? "default" : "secondary"} className="text-xs">
                          {item.isIndexed ? (
                            <>
                              <Search className="h-3 w-3 mr-1" />
                              Indicizzato
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Da sincronizzare
                            </>
                          )}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(item.id)}
                          disabled={deleteMutation.isPending}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
