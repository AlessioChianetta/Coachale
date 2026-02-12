import { useState, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  Users,
  Loader2,
  Crown,
  Shield,
  ArrowRight,
  Database,
  RefreshCw,
  UserPlus,
} from "lucide-react";

interface QueuedClient {
  id: number;
  client_email: string;
  client_name: string | null;
  client_phone: string | null;
  tier: string;
  purchase_date: string;
  file_status: "pending" | "uploaded";
  file_uploaded_at: string | null;
  file_name: string | null;
  rows_imported: number | null;
  sync_id: string | null;
}

interface UploadResult {
  success: boolean;
  sync_id?: string;
  client_email?: string;
  rows_imported?: number;
  rows_inserted?: number;
  rows_updated?: number;
  columns_mapped?: number;
  columns_unmapped?: number;
  duration_ms?: number;
  error?: string;
  message?: string;
}

export default function PartnerDashboard() {
  const { apiKey } = useParams<{ apiKey: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingFor, setUploadingFor] = useState<QueuedClient | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientTier, setNewClientTier] = useState("silver");

  const clientsQuery = useQuery({
    queryKey: ["partner-clients", apiKey],
    queryFn: async () => {
      const res = await fetch(`/api/dataset-sync/partner/${apiKey}/clients`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore nel recupero dei clienti");
      }
      return res.json();
    },
    refetchInterval: 15000,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ client, file }: { client: QueuedClient; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("client_email", client.client_email);
      formData.append("queue_id", client.id.toString());

      const res = await fetch(`/api/dataset-sync/partner/${apiKey}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Errore upload");
      return data as UploadResult;
    },
    onSuccess: (data) => {
      setUploadResult(data);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ["partner-clients", apiKey] });
      toast({
        title: "Upload completato!",
        description: `${data.rows_imported} righe importate per ${data.client_email}`,
      });
    },
    onError: (error: Error) => {
      setUploadResult({ success: false, error: error.message });
      toast({
        title: "Errore upload",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addClientMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/dataset-sync/partner/${apiKey}/add-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_email: newClientEmail,
          client_name: newClientName || undefined,
          tier: newClientTier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore");
      return data;
    },
    onSuccess: () => {
      setIsAddClientOpen(false);
      setNewClientEmail("");
      setNewClientName("");
      queryClient.invalidateQueries({ queryKey: ["partner-clients", apiKey] });
      toast({ title: "Cliente aggiunto!", description: `${newClientEmail} aggiunto alla coda` });
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null);
    }
  }, []);

  const handleUpload = () => {
    if (!uploadingFor || !selectedFile) return;
    uploadMutation.mutate({ client: uploadingFor, file: selectedFile });
  };

  const clients: QueuedClient[] = clientsQuery.data?.clients || [];
  const sourceName = clientsQuery.data?.source_name || "";
  const pendingClients = clients.filter((c) => c.file_status === "pending");
  const uploadedClients = clients.filter((c) => c.file_status === "uploaded");

  if (clientsQuery.isError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold">Accesso non valido</h2>
            <p className="text-muted-foreground">
              {(clientsQuery.error as Error)?.message || "API key non valida o sorgente disattivata. Controlla il link ricevuto."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <Database className="h-8 w-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Partner Dashboard</h1>
          </div>
          {sourceName && (
            <p className="text-muted-foreground">
              Sorgente: <span className="font-semibold text-indigo-600">{sourceName}</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Qui puoi vedere i clienti che hanno acquistato e caricare i loro file dati (CSV/XLSX). 
            Ogni file viene elaborato e reso disponibile per l'analisi AI.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{clients.length}</p>
                <p className="text-xs text-muted-foreground">Clienti Totali</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 dark:border-amber-800">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold text-amber-600">{pendingClients.length}</p>
                <p className="text-xs text-muted-foreground">In Attesa di File</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-600">{uploadedClients.length}</p>
                <p className="text-xs text-muted-foreground">File Caricati</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["partner-clients", apiKey] })}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Aggiorna
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddClientOpen(true)}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Aggiungi Cliente
          </Button>
        </div>

        {/* Pending clients (need file upload) */}
        {pendingClients.length > 0 && (
          <Card className="border-2 border-amber-200 dark:border-amber-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <Clock className="h-5 w-5" />
                Clienti in Attesa di File ({pendingClients.length})
              </CardTitle>
              <CardDescription>
                Questi clienti hanno acquistato ma non hanno ancora ricevuto i loro dati. Carica un file CSV o XLSX per ognuno.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
                      {client.tier === "gold" ? (
                        <Crown className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <Shield className="h-5 w-5 text-slate-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{client.client_name || client.client_email}</p>
                      <p className="text-xs text-muted-foreground">{client.client_email}</p>
                      {client.purchase_date && (
                        <p className="text-xs text-muted-foreground">
                          Acquistato: {new Date(client.purchase_date).toLocaleDateString("it-IT")}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className={client.tier === "gold" ? "bg-yellow-50 text-yellow-700 border-yellow-300" : "bg-slate-50 text-slate-700 border-slate-300"}>
                      {client.tier.toUpperCase()}
                    </Badge>
                  </div>
                  <Button
                    onClick={() => {
                      setUploadingFor(client);
                      setSelectedFile(null);
                      setUploadResult(null);
                    }}
                    className="bg-amber-500 hover:bg-amber-600"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Carica File
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Uploaded clients */}
        {uploadedClients.length > 0 && (
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle className="h-5 w-5" />
                File Caricati ({uploadedClients.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {uploadedClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">{client.client_name || client.client_email}</p>
                      <p className="text-xs text-muted-foreground">{client.client_email}</p>
                      {client.file_name && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <FileSpreadsheet className="h-3 w-3" />
                          {client.file_name}
                          {client.rows_imported != null && (
                            <span className="text-green-600 font-medium"> ({client.rows_imported} righe)</span>
                          )}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className={client.tier === "gold" ? "bg-yellow-50 text-yellow-700 border-yellow-300" : "bg-slate-50 text-slate-700 border-slate-300"}>
                      {client.tier.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-100 text-green-800">Completato</Badge>
                    {client.file_uploaded_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(client.file_uploaded_at).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {clients.length === 0 && !clientsQuery.isLoading && (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <Users className="h-12 w-12 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-semibold">Nessun cliente ancora</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Quando un cliente acquista una licenza tramite Stripe, apparira qui automaticamente.
                Puoi anche aggiungere un cliente manualmente per testare il flusso.
              </p>
              <Button onClick={() => setIsAddClientOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Aggiungi Cliente di Test
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {clientsQuery.isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        )}

        {/* Upload Dialog */}
        <Dialog open={!!uploadingFor} onOpenChange={() => setUploadingFor(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-indigo-600" />
                Carica File per {uploadingFor?.client_name || uploadingFor?.client_email}
              </DialogTitle>
              <DialogDescription>
                Seleziona il file CSV o XLSX con i dati del cliente. Il file verra elaborato automaticamente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">Cliente:</span> {uploadingFor?.client_email}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Tier:</span>{" "}
                  <Badge variant="outline" className="ml-1">
                    {uploadingFor?.tier?.toUpperCase()}
                  </Badge>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file-upload">File Dati (CSV, XLSX, XLS)</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="cursor-pointer"
                />
                {selectedFile && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileSpreadsheet className="h-3 w-3" />
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploadMutation.isPending}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Elaborazione in corso...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Invia Dati al Cliente
                  </>
                )}
              </Button>

              {uploadResult && (
                <div className={`p-4 rounded-lg ${uploadResult.success ? "bg-green-50 dark:bg-green-950/20 border border-green-200" : "bg-red-50 dark:bg-red-950/20 border border-red-200"}`}>
                  {uploadResult.success ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-semibold">Upload completato!</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Righe importate:</span>
                          <span className="font-semibold ml-1">{uploadResult.rows_imported}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Inserite:</span>
                          <span className="font-semibold ml-1">{uploadResult.rows_inserted}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Aggiornate:</span>
                          <span className="font-semibold ml-1">{uploadResult.rows_updated}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Colonne mappate:</span>
                          <span className="font-semibold ml-1">{uploadResult.columns_mapped}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Durata:</span>
                          <span className="font-semibold ml-1">{((uploadResult.duration_ms || 0) / 1000).toFixed(1)}s</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-700">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-semibold">{uploadResult.error || uploadResult.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Client Dialog */}
        <Dialog open={isAddClientOpen} onOpenChange={setIsAddClientOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-600" />
                Aggiungi Cliente
              </DialogTitle>
              <DialogDescription>
                Aggiungi manualmente un cliente alla coda per testare il flusso di upload.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-email">Email Cliente *</Label>
                <Input
                  id="client-email"
                  type="email"
                  placeholder="cliente@example.com"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-name">Nome (opzionale)</Label>
                <Input
                  id="client-name"
                  placeholder="Mario Rossi"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Tier</Label>
                <div className="flex gap-2">
                  <Button
                    variant={newClientTier === "silver" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewClientTier("silver")}
                  >
                    <Shield className="h-4 w-4 mr-1" />
                    Silver
                  </Button>
                  <Button
                    variant={newClientTier === "gold" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewClientTier("gold")}
                    className={newClientTier === "gold" ? "bg-yellow-500 hover:bg-yellow-600" : ""}
                  >
                    <Crown className="h-4 w-4 mr-1" />
                    Gold
                  </Button>
                </div>
              </div>
              <Button
                onClick={() => addClientMutation.mutate()}
                disabled={!newClientEmail || addClientMutation.isPending}
                className="w-full"
              >
                {addClientMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Aggiungi alla Coda
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
