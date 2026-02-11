import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Files, Trash2 } from "lucide-react";
import { getToken } from "@/lib/auth";

interface FileSchema {
  filename: string;
  filePath: string;
  tableName: string;
  columns: string[];
  sampleValues: Record<string, any[]>;
  rowCount: number;
  delimiter: string;
  encoding: string;
}

interface MultiFileUploaderProps {
  onUploadComplete: (files: FileSchema[]) => void;
  onCancel?: () => void;
}

type FileStatus = "pending" | "uploading" | "done" | "error";

interface SelectedFile {
  id: string;
  file: File;
  status: FileStatus;
}

export function MultiFileUploader({ onUploadComplete, onCancel }: MultiFileUploaderProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const addFiles = useCallback((fileList: FileList) => {
    const newFiles: SelectedFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (ext !== ".csv") {
        toast({
          title: "Formato non supportato",
          description: `"${file.name}" non è un file CSV. Sono accettati solo file .csv`,
          variant: "destructive",
        });
        continue;
      }
      newFiles.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        status: "pending",
      });
    }

    setSelectedFiles((prev) => {
      const combined = [...prev, ...newFiles];
      if (combined.length > 10) {
        toast({
          title: "Limite raggiunto",
          description: "Puoi caricare al massimo 10 file alla volta",
          variant: "destructive",
        });
        return combined.slice(0, 10);
      }
      return combined;
    });
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setUploadProgress(0);
  };

  const handleUpload = async () => {
    if (selectedFiles.length < 2) {
      toast({
        title: "File insufficienti",
        description: "Seleziona almeno 2 file CSV per procedere",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setSelectedFiles((prev) => prev.map((f) => ({ ...f, status: "uploading" as FileStatus })));

    try {
      const formData = new FormData();
      selectedFiles.forEach((sf) => {
        formData.append("files", sf.file);
      });

      setUploadProgress(30);

      const token = getToken();
      const response = await fetch("/api/client-data/upload-multi", {
        method: "POST",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      setUploadProgress(70);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Errore durante l'upload" }));
        throw new Error(error.error || "Errore durante l'upload");
      }

      const data = await response.json();
      setUploadProgress(100);

      if (data.success) {
        setSelectedFiles((prev) => prev.map((f) => ({ ...f, status: "done" as FileStatus })));
        toast({
          title: "File caricati con successo",
          description: `${data.data.length} file analizzati correttamente`,
        });
        onUploadComplete(data.data);
      } else {
        throw new Error(data.error || "Errore durante l'upload");
      }
    } catch (error: any) {
      setSelectedFiles((prev) => prev.map((f) => ({ ...f, status: "error" as FileStatus })));
      toast({
        title: "Errore upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const statusBadge = (status: FileStatus) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">In attesa</Badge>;
      case "uploading":
        return <Badge variant="secondary">Elaborazione...</Badge>;
      case "done":
        return <CheckCircle className="h-5 w-5 text-emerald-600" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const pendingFiles = selectedFiles.filter((f) => f.status === "pending");
  const canUpload = pendingFiles.length >= 2 || (selectedFiles.length >= 2 && selectedFiles.every((f) => f.status === "pending"));

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Files className="h-5 w-5 text-emerald-600" />
          Carica più file CSV
        </CardTitle>
        <CardDescription>
          Trascina o seleziona più file CSV da caricare e analizzare insieme (min. 2, max. 10)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            isDragging
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
              : "border-slate-200 dark:border-slate-700 hover:border-emerald-400"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById("multi-file-input")?.click()}
        >
          <input
            id="multi-file-input"
            type="file"
            accept=".csv"
            multiple
            className="hidden"
            onChange={handleInputChange}
          />
          <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
          <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
            Trascina qui i tuoi file CSV
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            oppure clicca per selezionare più file
          </p>
          <div className="flex justify-center gap-2">
            <Badge variant="outline">.csv</Badge>
          </div>
        </div>

        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {selectedFiles.length} file selezionat{selectedFiles.length === 1 ? "o" : "i"}
              </p>
              {!isUploading && (
                <Button variant="ghost" size="sm" onClick={clearAll} className="text-red-500 hover:text-red-700">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Rimuovi tutti
                </Button>
              )}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedFiles.map((sf) => (
                <div
                  key={sf.id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileSpreadsheet className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700 dark:text-slate-300 truncate text-sm">
                        {sf.file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatFileSize(sf.file.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {statusBadge(sf.status)}
                    {!isUploading && sf.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeFile(sf.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isUploading && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-sm text-center text-slate-500">
              Caricamento e analisi dei file in corso...
            </p>
          </div>
        )}

        {selectedFiles.length < 2 && selectedFiles.length > 0 && !isUploading && (
          <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
            Seleziona almeno 2 file CSV per procedere
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={isUploading}>
              Annulla
            </Button>
          )}
          {selectedFiles.length >= 2 && selectedFiles.some((f) => f.status === "pending") && (
            <Button
              onClick={handleUpload}
              disabled={isUploading || !canUpload}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              Carica e Analizza
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
