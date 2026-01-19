import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Users } from "lucide-react";
import { getToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

interface SheetInfo {
  name: string;
  rowCount: number;
  columns: { name: string; sampleValues: string[] }[];
  sampleRows: Record<string, any>[];
}

interface UploadResult {
  filePath: string;
  originalFilename: string;
  fileSize: number;
  format: string;
  sheets: SheetInfo[];
  distributedSample: {
    totalRowCount: number;
    sampledFromStart: number;
    sampledFromMiddle: number;
    sampledFromEnd: number;
  } | null;
  columnProfiles: Record<string, any> | null;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface DatasetUploaderProps {
  onUploadComplete: (result: UploadResult, clientId?: string) => void;
  onCancel?: () => void;
}

export function DatasetUploader({ onUploadComplete, onCancel }: DatasetUploaderProps) {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("/api/clients"),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const token = getToken();
      const response = await fetch("/api/client-data/upload", {
        method: "POST",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Errore durante l'upload" }));
        throw new Error(error.error || "Errore durante l'upload");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "File caricato con successo",
          description: `${data.data.originalFilename} - ${data.data.sheets.length} fogli trovati`,
        });
        onUploadComplete(data.data, selectedClientId && selectedClientId !== "__none__" ? selectedClientId : undefined);
      } else {
        throw new Error(data.error || "Errore durante l'upload");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Errore upload",
        description: error.message,
        variant: "destructive",
      });
      setSelectedFile(null);
      setUploadProgress(0);
    },
  });

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

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleFileSelect = (file: File) => {
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

    if (!validExtensions.includes(ext)) {
      toast({
        title: "Formato non supportato",
        description: "Carica un file Excel (.xlsx, .xls) o CSV (.csv)",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setUploadProgress(0);
    uploadMutation.mutate(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadProgress(0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          Carica Dataset
        </CardTitle>
        <CardDescription>
          Carica un file Excel o CSV per analizzare i dati del tuo cliente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="client-select" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Associa a un cliente (opzionale)
          </Label>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger id="client-select">
              <SelectValue placeholder="Seleziona un cliente..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nessun cliente (solo per me)</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.firstName} {client.lastName} ({client.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            Se associ il dataset a un cliente, anche lui potra vederlo e interrogarlo.
          </p>
        </div>

        {!selectedFile ? (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                : "border-slate-200 dark:border-slate-700 hover:border-emerald-400"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleInputChange}
            />
            <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
            <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
              Trascina qui il tuo file
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              oppure clicca per selezionare
            </p>
            <div className="flex justify-center gap-2">
              <Badge variant="outline">.xlsx</Badge>
              <Badge variant="outline">.xls</Badge>
              <Badge variant="outline">.csv</Badge>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-300">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {uploadMutation.isPending && (
                  <Badge variant="secondary">Elaborazione...</Badge>
                )}
                {uploadMutation.isSuccess && (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                )}
                {uploadMutation.isError && (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveFile}
                  disabled={uploadMutation.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {uploadMutation.isPending && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-sm text-center text-slate-500">
                  Analisi del file in corso...
                </p>
              </div>
            )}
          </div>
        )}

        {onCancel && (
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={onCancel}>
              Annulla
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
