import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import {
  Download,
  Loader2,
  Pause,
  Play,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  FolderOpen,
  Mail,
  Copy,
} from "lucide-react";

type ImportStatus = "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";

interface ImportProgress {
  jobId: string;
  status: ImportStatus;
  currentFolder: string;
  totalFolders: number;
  processedFolders: number;
  totalEmails: number;
  processedEmails: number;
  importedEmails: number;
  duplicateEmails: number;
  failedEmails: number;
  startedAt: string;
  estimatedTimeRemaining: number | null;
  error?: string;
}

interface EmailImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
}

const STATUS_CONFIG: Record<ImportStatus, { 
  label: string; 
  variant: "default" | "secondary" | "destructive" | "outline"; 
  icon: React.ReactNode;
  color: string;
}> = {
  pending: {
    label: "In attesa",
    variant: "secondary",
    icon: <Clock className="h-4 w-4" />,
    color: "text-slate-400",
  },
  running: {
    label: "In corso",
    variant: "default",
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    color: "text-blue-500",
  },
  paused: {
    label: "In pausa",
    variant: "outline",
    icon: <Pause className="h-4 w-4" />,
    color: "text-amber-500",
  },
  completed: {
    label: "Completato",
    variant: "default",
    icon: <CheckCircle className="h-4 w-4" />,
    color: "text-green-500",
  },
  failed: {
    label: "Fallito",
    variant: "destructive",
    icon: <XCircle className="h-4 w-4" />,
    color: "text-red-500",
  },
  cancelled: {
    label: "Annullato",
    variant: "outline",
    icon: <X className="h-4 w-4" />,
    color: "text-slate-500",
  },
};

function formatTimeRemaining(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "--";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatElapsedTime(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - start) / 1000);
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function EmailImportDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
}: EmailImportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>("0s");

  const isFinished = progress?.status === "completed" || 
                     progress?.status === "failed" || 
                     progress?.status === "cancelled";

  const { data: activeJobData } = useQuery({
    queryKey: ["/api/email-hub/accounts", accountId, "import/active"],
    queryFn: async () => {
      const response = await fetch(`/api/email-hub/accounts/${accountId}/import/active`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return { data: null };
        throw new Error("Errore nel controllo job attivo");
      }
      return response.json();
    },
    enabled: open && !jobId,
  });

  useEffect(() => {
    if (activeJobData?.data?.jobId && !jobId) {
      setJobId(activeJobData.data.jobId);
    }
  }, [activeJobData, jobId]);

  const startImportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/email-hub/accounts/${accountId}/import/start`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Errore durante l'avvio dell'importazione");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setJobId(data.data.jobId);
      toast({ title: "Importazione avviata", description: "L'importazione delle email e iniziata" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const pauseImportMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error("Nessun job attivo");
      const response = await fetch(`/api/email-hub/import/${jobId}/pause`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Errore durante la pausa");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Importazione in pausa", description: "L'importazione e stata messa in pausa" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const resumeImportMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error("Nessun job attivo");
      const response = await fetch(`/api/email-hub/import/${jobId}/resume`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Errore durante la ripresa");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Importazione ripresa", description: "L'importazione e stata ripresa" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const cancelImportMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error("Nessun job attivo");
      const response = await fetch(`/api/email-hub/import/${jobId}/cancel`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Errore durante l'annullamento");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Importazione annullata", description: "L'importazione e stata annullata" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const connectSSE = useCallback((jId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const authToken = localStorage.getItem("authToken") || "";
    const url = `/api/email-hub/import/${jId}/progress?token=${encodeURIComponent(authToken)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data: ImportProgress = JSON.parse(event.data);
        setProgress(data);
        
        if (data.status === "completed" || data.status === "failed" || data.status === "cancelled") {
          eventSource.close();
          queryClient.invalidateQueries({ queryKey: ["/api/email-hub/inbox"] });
          queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts"] });
        }
      } catch (err) {
        console.error("[EmailImportDialog] SSE parse error:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("[EmailImportDialog] SSE error:", err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient]);

  useEffect(() => {
    if (jobId && open) {
      connectSSE(jobId);
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [jobId, open, connectSSE]);

  useEffect(() => {
    if (progress?.startedAt && !isFinished) {
      const interval = setInterval(() => {
        setElapsedTime(formatElapsedTime(progress.startedAt));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [progress?.startedAt, isFinished]);

  const handleClose = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setJobId(null);
    setProgress(null);
    onOpenChange(false);
  };

  const handleStartImport = () => {
    startImportMutation.mutate();
  };

  const progressPercent = progress 
    ? progress.totalEmails > 0 
      ? Math.round((progress.processedEmails / progress.totalEmails) * 100)
      : progress.processedFolders > 0 && progress.totalFolders > 0
        ? Math.round((progress.processedFolders / progress.totalFolders) * 100)
        : 0
    : 0;

  const statusConfig = progress ? STATUS_CONFIG[progress.status] : STATUS_CONFIG.pending;

  return (
    <Dialog open={open} onOpenChange={isFinished || !jobId ? handleClose : undefined}>
      <DialogContent className="sm:max-w-[500px] bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Importa Email
          </DialogTitle>
          <DialogDescription>
            {accountName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!jobId && !startImportMutation.isPending ? (
            <div className="text-center py-8 space-y-4">
              <Mail className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">Importa Email</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Avvia l'importazione delle email dall'account selezionato
                </p>
              </div>
              <Button onClick={handleStartImport} className="mt-4">
                <Download className="h-4 w-4 mr-2" />
                Avvia Importazione
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={statusConfig.color}>{statusConfig.icon}</span>
                  <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                </div>
                {progress?.startedAt && (
                  <span className="text-sm text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {elapsedTime}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso</span>
                  <span className="font-medium">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-3" />
              </div>

              {progress?.currentFolder && (
                <div className="flex items-center gap-2 text-sm">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Cartella corrente:</span>
                  <span className="font-medium truncate">{progress.currentFolder}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Mail className="h-3 w-3" />
                    Email processate
                  </div>
                  <p className="text-lg font-semibold">
                    {progress?.processedEmails || 0}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}/ {progress?.totalEmails || "?"}
                    </span>
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Clock className="h-3 w-3" />
                    Tempo rimanente
                  </div>
                  <p className="text-lg font-semibold">
                    {formatTimeRemaining(progress?.estimatedTimeRemaining || null)}
                  </p>
                </div>

                <div className="bg-green-500/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-600 text-xs mb-1">
                    <CheckCircle className="h-3 w-3" />
                    Email importate
                  </div>
                  <p className="text-lg font-semibold text-green-600">
                    {progress?.importedEmails || 0}
                  </p>
                </div>

                <div className="bg-amber-500/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-amber-600 text-xs mb-1">
                    <Copy className="h-3 w-3" />
                    Email duplicate
                  </div>
                  <p className="text-lg font-semibold text-amber-600">
                    {progress?.duplicateEmails || 0}
                  </p>
                </div>
              </div>

              {progress?.error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                  <p className="text-sm text-destructive">{progress.error}</p>
                </div>
              )}

              {progress?.status === "completed" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm text-green-600">
                    Importazione completata! {progress.importedEmails} email importate.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <div className="flex gap-2">
            {progress?.status === "running" && (
              <Button
                variant="outline"
                onClick={() => pauseImportMutation.mutate()}
                disabled={pauseImportMutation.isPending}
              >
                {pauseImportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
                <span className="ml-2">Pausa</span>
              </Button>
            )}

            {progress?.status === "paused" && (
              <Button
                variant="outline"
                onClick={() => resumeImportMutation.mutate()}
                disabled={resumeImportMutation.isPending}
              >
                {resumeImportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span className="ml-2">Riprendi</span>
              </Button>
            )}

            {(progress?.status === "running" || progress?.status === "paused") && (
              <Button
                variant="destructive"
                onClick={() => cancelImportMutation.mutate()}
                disabled={cancelImportMutation.isPending}
              >
                {cancelImportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                <span className="ml-2">Annulla</span>
              </Button>
            )}
          </div>

          {(isFinished || !jobId) && (
            <Button onClick={handleClose}>
              Chiudi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
