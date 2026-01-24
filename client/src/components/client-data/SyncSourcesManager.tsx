import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import {
  useDatasetSyncSources,
  useCreateSyncSource,
  useDeleteSyncSource,
  useRegenerateApiKey,
  useToggleSyncSource,
  useUpdateSyncSource,
  useSyncSourceColumns,
  SyncSource,
} from "@/hooks/useDatasetSync";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Copy,
  MoreVertical,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  Eye,
  EyeOff,
  Key,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Link2,
  Users,
  Settings,
  FileText,
} from "lucide-react";
import { Label } from "@/components/ui/label";

interface CreatedSourceData {
  id: number;
  name: string;
  api_key: string;
  secret_key: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export function SyncSourcesManager() {
  const { toast } = useToast();
  const { data: sourcesData, isLoading } = useDatasetSyncSources();
  const createMutation = useCreateSyncSource();
  const deleteMutation = useDeleteSyncSource();
  const regenerateMutation = useRegenerateApiKey();
  const toggleMutation = useToggleSyncSource();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: () => apiRequest("/api/clients"),
  });

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [replaceMode, setReplaceMode] = useState<'full' | 'append' | 'upsert'>('full');
  const [upsertKeyColumns, setUpsertKeyColumns] = useState("");
  const [createdSource, setCreatedSource] = useState<CreatedSourceData | null>(null);
  const [showCreatedDialog, setShowCreatedDialog] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<number>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [regenerateConfirmId, setRegenerateConfirmId] = useState<number | null>(null);
  const [editingSource, setEditingSource] = useState<SyncSource | null>(null);
  const [editReplaceMode, setEditReplaceMode] = useState<'full' | 'append' | 'upsert'>('full');
  const [editSelectedColumns, setEditSelectedColumns] = useState<Set<string>>(new Set());
  const [guideSource, setGuideSource] = useState<SyncSource | null>(null);

  const updateMutation = useUpdateSyncSource();
  const { data: columnsData, isLoading: columnsLoading } = useSyncSourceColumns(editingSource?.id || null);
  const sources = sourcesData?.data || [];

  const maskApiKey = (apiKey: string) => {
    if (!apiKey) return "...";
    return apiKey.substring(0, 8) + "...";
  };

  const toggleSecretVisibility = (id: number) => {
    setVisibleSecrets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiato!",
        description: `${label} copiato negli appunti`,
      });
    } catch {
      toast({
        title: "Errore",
        description: "Impossibile copiare negli appunti",
        variant: "destructive",
      });
    }
  };

  const handleCreateSource = async () => {
    if (!newSourceName.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci un nome per la sorgente",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await createMutation.mutateAsync({ 
        name: newSourceName.trim(),
        clientId: selectedClientId && selectedClientId !== "__none__" ? selectedClientId : undefined,
        replaceMode,
        upsertKeyColumns: replaceMode === 'upsert' ? upsertKeyColumns.trim() : undefined,
      });
      const data = result as any;
      if (data?.data) {
        setCreatedSource({
          id: data.data.id,
          name: data.data.name,
          api_key: data.data.api_key,
          secret_key: data.data.secret_key,
        });
        setShowAddDialog(false);
        setNewSourceName("");
        setSelectedClientId("");
        setReplaceMode('full');
        setUpsertKeyColumns("");
        setShowCreatedDialog(true);
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile creare la sorgente",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({
        title: "Sorgente eliminata",
        description: "La sorgente è stata eliminata con successo",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile eliminare la sorgente",
        variant: "destructive",
      });
    }
    setDeleteConfirmId(null);
  };

  const handleRegenerateKey = async (id: number) => {
    try {
      const result = await regenerateMutation.mutateAsync(id);
      const data = result as any;
      if (data?.data) {
        setCreatedSource({
          id: data.data.id,
          name: data.data.name,
          api_key: data.data.api_key,
          secret_key: data.data.secret_key,
        });
        setShowCreatedDialog(true);
      }
      toast({
        title: "Chiavi rigenerate",
        description: "Le nuove chiavi API sono state generate",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile rigenerare le chiavi",
        variant: "destructive",
      });
    }
    setRegenerateConfirmId(null);
  };

  const handleToggle = async (source: SyncSource) => {
    try {
      await toggleMutation.mutateAsync({ id: source.id, isActive: !source.is_active });
      toast({
        title: source.is_active ? "Sorgente disattivata" : "Sorgente attivata",
        description: source.is_active
          ? "La sorgente è stata messa in pausa"
          : "La sorgente è ora attiva",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile modificare lo stato",
        variant: "destructive",
      });
    }
  };

  const formatLastSync = (lastSyncAt?: string) => {
    if (!lastSyncAt) return "Mai";
    try {
      return formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true, locale: it });
    } catch {
      return "N/D";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="h-5 w-5 text-cyan-600" />
            Sorgenti di Sincronizzazione
          </h3>
          <p className="text-sm text-muted-foreground">
            Gestisci le sorgenti esterne per la sincronizzazione automatica dei dati
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Aggiungi Sorgente
        </Button>
      </div>

      {sources.length === 0 ? (
        <div className="border rounded-lg p-12 text-center bg-muted/20">
          <Link2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h4 className="text-lg font-medium mb-2">Nessuna sorgente configurata</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Crea la tua prima sorgente per iniziare a ricevere dati da sistemi esterni
          </p>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Aggiungi Prima Sorgente
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>API Key</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Ultimo Sync</TableHead>
                <TableHead>Sync Totali</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell>
                    {source.client_id && source.client_first_name ? (
                      <div className="flex items-center gap-2">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {source.client_first_name} {source.client_last_name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Solo per me</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                        {maskApiKey(source.api_key)}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(source.api_key, "API Key")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {source.is_active ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Attivo
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <Pause className="h-3 w-3 mr-1" />
                        In Pausa
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatLastSync(source.last_sync_at)}
                  </TableCell>
                  <TableCell className="font-mono">{source.sync_count || 0}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingSource(source);
                            setEditReplaceMode(source.replace_mode || 'full');
                            setEditSelectedColumns(new Set(source.upsert_key_columns || []));
                          }}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Modifica Impostazioni
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setGuideSource(source)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Guida per Partner
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => copyToClipboard(source.api_key, "API Key")}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copia API Key
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setRegenerateConfirmId(source.id)}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Rigenera Chiavi
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleToggle(source)}>
                          {source.is_active ? (
                            <>
                              <Pause className="h-4 w-4 mr-2" />
                              Metti in Pausa
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Attiva
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteConfirmId(source.id)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) {
          setNewSourceName("");
          setSelectedClientId("");
          setReplaceMode('full');
          setUpsertKeyColumns("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova Sorgente di Sincronizzazione</DialogTitle>
            <DialogDescription>
              Crea una nuova sorgente per ricevere dati da sistemi esterni tramite API
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome Sorgente</label>
              <Input
                placeholder="Es. Sistema Gestionale, CRM, etc."
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateSource()}
              />
            </div>
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
                Se associ la sorgente a un cliente, i dati importati saranno visibili anche a lui.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="replace-mode" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Modalità Aggiornamento
              </Label>
              <Select value={replaceMode} onValueChange={(v) => setReplaceMode(v as 'full' | 'append' | 'upsert')}>
                <SelectTrigger id="replace-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Sostituisci tutto (Full Replace)</SelectItem>
                  <SelectItem value="append">Aggiungi in coda (Append)</SelectItem>
                  <SelectItem value="upsert">Aggiorna esistenti (Upsert)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                {replaceMode === 'full' && "Ogni sync sostituirà completamente i dati esistenti."}
                {replaceMode === 'append' && "I nuovi dati verranno aggiunti a quelli esistenti."}
                {replaceMode === 'upsert' && "I record esistenti verranno aggiornati, i nuovi inseriti."}
              </p>
            </div>
            {replaceMode === 'upsert' && (
              <div className="space-y-2">
                <Label htmlFor="upsert-keys">Colonne Chiave per Upsert</Label>
                <Input
                  id="upsert-keys"
                  placeholder="order_id, order_date"
                  value={upsertKeyColumns}
                  onChange={(e) => setUpsertKeyColumns(e.target.value)}
                />
                <p className="text-xs text-slate-500">
                  Inserisci i nomi delle colonne chiave separati da virgola. Questi campi verranno usati per identificare i record esistenti.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleCreateSource}
              disabled={createMutation.isPending || !newSourceName.trim()}
            >
              {createMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Crea Sorgente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreatedDialog} onOpenChange={setShowCreatedDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-emerald-600" />
              Credenziali API Generate
            </DialogTitle>
            <DialogDescription>
              Salva queste credenziali in un luogo sicuro
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Attenzione: Salva la Secret Key adesso
                  </p>
                  <p className="text-amber-700 dark:text-amber-300">
                    La Secret Key viene mostrata solo una volta. Non sarà più possibile
                    recuperarla in seguito.
                  </p>
                </div>
              </div>
            </div>

            {createdSource && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome</label>
                  <div className="bg-muted rounded-lg px-4 py-2">
                    {createdSource.name}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted rounded-lg px-4 py-2 text-sm font-mono break-all">
                      {createdSource.api_key}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(createdSource.api_key, "API Key")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Secret Key</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted rounded-lg px-4 py-2 text-sm font-mono break-all">
                      {createdSource.secret_key}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        copyToClipboard(createdSource.secret_key, "Secret Key")
                      }
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowCreatedDialog(false)}>
              Ho salvato le credenziali
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questa sorgente? Questa azione non può essere
              annullata e tutte le integrazioni esistenti smetteranno di funzionare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={regenerateConfirmId !== null}
        onOpenChange={(open) => !open && setRegenerateConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Rigenera Chiavi API
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Stai per rigenerare le chiavi API per questa sorgente. Questo invaliderà
                immediatamente le chiavi esistenti.
              </p>
              <p className="font-medium text-amber-600">
                Tutte le integrazioni esistenti che utilizzano le vecchie chiavi
                smetteranno di funzionare fino a quando non saranno aggiornate con le
                nuove credenziali.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => regenerateConfirmId && handleRegenerateKey(regenerateConfirmId)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {regenerateMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Rigenera Chiavi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Source Dialog */}
      <Dialog open={editingSource !== null} onOpenChange={(open) => {
        if (!open) {
          setEditingSource(null);
          setEditReplaceMode('full');
          setEditSelectedColumns(new Set());
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Modifica Impostazioni Sorgente
            </DialogTitle>
            <DialogDescription>
              Modifica la modalità di aggiornamento per "{editingSource?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-replace-mode" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Modalità Aggiornamento
              </Label>
              <Select value={editReplaceMode} onValueChange={(v) => setEditReplaceMode(v as 'full' | 'append' | 'upsert')}>
                <SelectTrigger id="edit-replace-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Sostituisci tutto (Full Replace)</SelectItem>
                  <SelectItem value="append">Aggiungi in coda (Append)</SelectItem>
                  <SelectItem value="upsert">Aggiorna esistenti (Upsert)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                {editReplaceMode === 'full' && "Ogni sync sostituirà completamente i dati esistenti."}
                {editReplaceMode === 'append' && "I nuovi dati verranno aggiunti a quelli esistenti."}
                {editReplaceMode === 'upsert' && "I record esistenti verranno aggiornati, i nuovi inseriti."}
              </p>
            </div>
            {editReplaceMode === 'upsert' && (
              <div className="space-y-2">
                <Label>Colonne Chiave per Upsert</Label>
                {columnsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Caricamento colonne...
                  </div>
                ) : columnsData?.columns?.length > 0 ? (
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                    {columnsData.columns.map((col: string) => (
                      <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={editSelectedColumns.has(col)}
                          onChange={(e) => {
                            const newSet = new Set(editSelectedColumns);
                            if (e.target.checked) {
                              newSet.add(col);
                            } else {
                              newSet.delete(col);
                            }
                            setEditSelectedColumns(newSet);
                          }}
                          className="rounded border-slate-300"
                        />
                        <span className="text-sm font-mono">{col}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-amber-600">
                    Nessun sync effettuato. Le colonne saranno disponibili dopo il primo invio di dati.
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Seleziona le colonne che identificano univocamente ogni record.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSource(null)}>
              Annulla
            </Button>
            <Button
              onClick={() => {
                if (!editingSource) return;
                updateMutation.mutate({
                  id: editingSource.id,
                  data: {
                    replaceMode: editReplaceMode,
                    upsertKeyColumns: editReplaceMode === 'upsert' ? Array.from(editSelectedColumns).join(', ') : undefined,
                  }
                }, {
                  onSuccess: () => {
                    toast({
                      title: "Salvato",
                      description: "Impostazioni aggiornate con successo",
                    });
                    setEditingSource(null);
                  },
                  onError: (error: any) => {
                    toast({
                      title: "Errore",
                      description: error.message || "Impossibile salvare le modifiche",
                      variant: "destructive",
                    });
                  }
                });
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salva Modifiche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Partner Guide Dialog */}
      <Dialog open={guideSource !== null} onOpenChange={(open) => !open && setGuideSource(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Guida Integrazione per Partner
            </DialogTitle>
            <DialogDescription>
              Istruzioni per configurare "{guideSource?.name}" nel sistema gestionale
            </DialogDescription>
          </DialogHeader>
          {guideSource && (
            <div className="space-y-6 py-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Endpoint Webhook</h4>
                <code className="text-sm bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded break-all">
                  POST {window.location.origin}/api/dataset-sync/webhook/{guideSource.api_key}
                </code>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Headers Richiesti</h4>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 text-sm font-mono space-y-1">
                  <p>Content-Type: multipart/form-data</p>
                  <p>X-Dataset-Timestamp: {`<unix_timestamp>`}</p>
                  <p>X-Dataset-Signature: sha256={`<HMAC-SHA256>`}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Parametri Form</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        <th className="text-left p-2">Campo</th>
                        <th className="text-left p-2">Obbligatorio</th>
                        <th className="text-left p-2">Descrizione</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="p-2 font-mono">file</td>
                        <td className="p-2">✅</td>
                        <td className="p-2">File CSV, XLSX o XLS</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-2 font-mono">replace_mode</td>
                        <td className="p-2">❌</td>
                        <td className="p-2">full | append | upsert</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-2 font-mono">upsert_key_columns</td>
                        <td className="p-2">❌*</td>
                        <td className="p-2">Colonne chiave (es: order_id,line_id)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">* Obbligatorio se replace_mode=upsert</p>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Esempio cURL - Prima Sincronizzazione</h4>
                <div className="bg-slate-900 text-slate-100 rounded-lg p-4 text-sm font-mono overflow-x-auto">
                  <pre className="whitespace-pre-wrap">{`# Generare timestamp e firma
TIMESTAMP=$(date +%s)
SIGNATURE=$(echo -n "@ordini.xlsx" | openssl dgst -sha256 -hmac "SECRET_KEY" | cut -d' ' -f2)

curl -X POST "${window.location.origin}/api/dataset-sync/webhook/${guideSource.api_key}" \\
  -H "X-Dataset-Timestamp: $TIMESTAMP" \\
  -H "X-Dataset-Signature: sha256=$SIGNATURE" \\
  -F "file=@ordini.xlsx" \\
  -F "replace_mode=upsert" \\
  -F "upsert_key_columns=order_id,line_id"`}</pre>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(guideSource.api_key, "API Key")}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copia API Key
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Modalità di Aggiornamento</h4>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <span className="font-mono bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-xs">full</span>
                    <span>Sostituisce tutti i dati ad ogni sync (default)</span>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <span className="font-mono bg-blue-200 dark:bg-blue-700 px-2 py-0.5 rounded text-xs">append</span>
                    <span>Aggiunge nuovi record senza cancellare i precedenti</span>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <span className="font-mono bg-purple-200 dark:bg-purple-700 px-2 py-0.5 rounded text-xs">upsert</span>
                    <span>Aggiorna record esistenti (basandosi su colonne chiave) e inserisce i nuovi</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">Nota Importante</h4>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Le opzioni <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">replace_mode</code> e{' '}
                  <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">upsert_key_columns</code> vengono 
                  salvate automaticamente. Una volta configurate nel primo invio, non è necessario ripeterle.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setGuideSource(null)}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
