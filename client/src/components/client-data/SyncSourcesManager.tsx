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
  Download,
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

  const downloadGuidePDF = async (source: SyncSource) => {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;
      let pageNum = 1;

      const checkPageBreak = (neededHeight: number) => {
        if (y + neededHeight > pageHeight - 25) {
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(`Pagina ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
          doc.addPage();
          pageNum++;
          y = margin;
        }
      };

      const addText = (text: string, fontSize: number, opts?: { bold?: boolean; color?: [number, number, number]; maxWidth?: number; lineHeight?: number; x?: number }) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
        if (opts?.color) doc.setTextColor(...opts.color);
        else doc.setTextColor(40, 40, 40);
        const w = opts?.maxWidth || contentWidth;
        const xPos = opts?.x || margin;
        const lines = doc.splitTextToSize(text, w);
        const lh = opts?.lineHeight || fontSize * 0.5;
        for (const line of lines) {
          checkPageBreak(lh);
          doc.text(line, xPos, y);
          y += lh;
        }
      };

      doc.setFillColor(20, 30, 50);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('Guida Integrazione per Partner', margin, 22);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(200, 200, 220);
      doc.text(`Sorgente: ${source.name}  |  ${new Date().toLocaleDateString('it-IT')}`, margin, 33);
      y = 50;

      addText('1. Cosa facciamo noi', 13, { bold: true, color: [16, 120, 80] });
      y += 2;
      const nostre = [
        'Riceviamo i dati - Endpoint webhook sicuro pronto a ricevere file',
        'Mappiamo automaticamente le colonne - Riconosciamo campi come prezzo, quantita, data ordine',
        'Gestiamo gli aggiornamenti - Full replace, append o upsert in base alla configurazione',
        'Monitoriamo lo stato - Dashboard con errori, metriche e cronologia sync',
      ];
      for (const item of nostre) {
        checkPageBreak(6);
        addText(`  \u2022  ${item}`, 10, { color: [60, 60, 60], lineHeight: 4.5 });
        y += 1;
      }
      y += 4;

      addText('2. Cosa ci aspettiamo dal partner', 13, { bold: true, color: [30, 80, 180] });
      y += 2;
      const partner = [
        'Esportare i dati in CSV o Excel - Formato tabellare con intestazioni nella prima riga',
        'Inviare il file via HTTP POST - All\'endpoint webhook fornito sotto',
        'Firmare la richiesta con HMAC - Per garantire autenticita e sicurezza',
        'Specificare le colonne chiave - Solo al primo invio, per identificare record unici',
      ];
      for (let i = 0; i < partner.length; i++) {
        checkPageBreak(6);
        addText(`  ${i + 1}. ${partner[i]}`, 10, { color: [60, 60, 60], lineHeight: 4.5 });
        y += 1;
      }
      y += 4;

      addText('3. Credenziali di Accesso', 13, { bold: true, color: [30, 30, 30] });
      y += 3;
      const endpoint = `POST ${window.location.origin}/api/dataset-sync/webhook/${source.api_key}`;
      addText('Endpoint Webhook:', 10, { bold: true, color: [80, 80, 80] });
      y += 1;
      addText(endpoint, 9, { color: [16, 120, 80], lineHeight: 4 });
      y += 3;
      addText('API Key:', 10, { bold: true, color: [80, 80, 80] });
      y += 1;
      addText(source.api_key, 9, { color: [16, 120, 80] });
      y += 3;
      addText('Secret Key:', 10, { bold: true, color: [80, 80, 80] });
      y += 1;
      addText('Fornita al momento della creazione della sorgente', 9, { color: [180, 120, 20] });
      y += 6;

      addText('4. Headers HTTP Richiesti', 13, { bold: true, color: [30, 30, 30] });
      y += 3;
      const headers = [
        ['Content-Type', 'multipart/form-data', 'Per upload file'],
        ['X-Dataset-Timestamp', 'Unix timestamp (es: 1737745200)', 'Secondi da epoch'],
        ['X-Dataset-Signature', 'sha256=...', 'HMAC-SHA256 del file con Secret Key'],
        ['X-Idempotency-Key', '(opzionale)', 'ID univoco per evitare duplicazioni'],
        ['X-Client-Email', 'email cliente', 'Email del cliente destinatario (routing multi-cliente)'],
      ];
      for (const [name, value, desc] of headers) {
        checkPageBreak(10);
        addText(`${name}: ${value}`, 9, { bold: true, color: [60, 60, 60], lineHeight: 4 });
        addText(`    ${desc}`, 9, { color: [120, 120, 120], lineHeight: 4 });
        y += 2;
      }
      y += 4;

      checkPageBreak(30);
      addText('4b. Routing Multi-Cliente', 13, { bold: true, color: [63, 81, 181] });
      y += 3;
      addText('Con una sola sorgente e API key, puoi inviare dati a clienti diversi.', 9, { color: [63, 81, 181] });
      y += 1;
      addText('Aggiungi l\'header X-Client-Email con l\'email del cliente destinatario.', 9, { color: [63, 81, 181] });
      y += 2;
      const routingPoints = [
        'Il sistema cerca il cliente per email e associa i dati al suo account',
        'Ogni cliente ha il suo dataset separato, anche dalla stessa sorgente',
        'Quando un nuovo cliente acquista, riceverai una notifica con la sua email',
        'Se l\'email non corrisponde a nessun cliente attivo: errore CLIENT_NOT_FOUND',
      ];
      for (const point of routingPoints) {
        checkPageBreak(6);
        addText(`• ${point}`, 9, { color: [80, 80, 120], lineHeight: 4.5 });
      }
      y += 4;

      addText('5. Campi del Form (multipart/form-data)', 13, { bold: true, color: [30, 30, 30] });
      y += 3;
      const campi = [
        ['file (obbligatorio)', 'File dati in formato CSV, XLSX o XLS'],
        ['replace_mode (opzionale)', 'full | append | upsert'],
        ['upsert_key_columns (obbligatorio se upsert)', 'Colonne chiave separate da virgola (es: order_id,line_id)'],
      ];
      for (const [name, desc] of campi) {
        checkPageBreak(8);
        addText(`${name}`, 9, { bold: true, color: [60, 60, 60], lineHeight: 4 });
        addText(`    ${desc}`, 9, { color: [120, 120, 120], lineHeight: 4 });
        y += 2;
      }
      y += 4;

      addText('6. Modalita di Aggiornamento', 13, { bold: true, color: [30, 30, 30] });
      y += 3;
      const modes = [
        ['full (default)', 'Cancella tutti i dati esistenti e inserisce quelli nuovi. Ideale per export giornalieri completi.'],
        ['append', 'Inserisce nuovi record senza toccare quelli esistenti. Utile per log incrementali.'],
        ['upsert (consigliato)', 'Aggiorna record esistenti (stessa chiave) e inserisce quelli nuovi. Ideale per sync incrementali.'],
      ];
      for (const [name, desc] of modes) {
        checkPageBreak(10);
        addText(name, 10, { bold: true, color: [60, 60, 60], lineHeight: 4.5 });
        addText(desc, 9, { color: [100, 100, 100], lineHeight: 4 });
        y += 3;
      }
      y += 4;

      checkPageBreak(50);
      addText('7. Esempio Implementazione (cURL)', 13, { bold: true, color: [30, 30, 30] });
      y += 3;
      doc.setFillColor(240, 240, 245);
      const codeBlockY = y;
      const curlExample = [
        '#!/bin/bash',
        '# Configurazione',
        `API_KEY="${source.api_key}"`,
        'SECRET_KEY="<la_tua_secret_key>"',
        'FILE_PATH="ordini.xlsx"',
        'CLIENT_EMAIL="cliente@example.com"',
        `ENDPOINT="${window.location.origin}/api/dataset-sync/webhook/$API_KEY"`,
        '',
        '# Genera timestamp e firma HMAC',
        'TIMESTAMP=$(date +%s)',
        'SIGNATURE=$(cat "$FILE_PATH" | openssl dgst -sha256 \\',
        '  -hmac "$SECRET_KEY" | cut -d\' \' -f2)',
        '',
        '# Invio dati per un cliente specifico (con routing)',
        'curl -X POST "$ENDPOINT" \\',
        '  -H "X-Dataset-Timestamp: $TIMESTAMP" \\',
        '  -H "X-Dataset-Signature: sha256=$SIGNATURE" \\',
        '  -H "X-Client-Email: $CLIENT_EMAIL" \\',
        '  -F "file=@$FILE_PATH" \\',
        '  -F "replace_mode=upsert" \\',
        '  -F "upsert_key_columns=order_id,line_id"',
      ];
      const codeLineHeight = 4;
      const codeBlockHeight = curlExample.length * codeLineHeight + 6;
      doc.roundedRect(margin, codeBlockY - 3, contentWidth, codeBlockHeight, 2, 2, 'F');
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 50);
      for (const line of curlExample) {
        doc.text(line, margin + 4, y);
        y += codeLineHeight;
      }
      y += 6;

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Pagina ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });

      doc.save(`guida-integrazione-${source.name.toLowerCase().replace(/\s+/g, '-')}.pdf`);
      toast({ title: "PDF scaricato!", description: "La guida e stata scaricata correttamente" });
    } catch (err) {
      console.error('PDF generation error:', err);
      toast({ title: "Errore", description: "Impossibile generare il PDF", variant: "destructive" });
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
            <div className="space-y-6 py-4 text-sm">
              {/* Sezione 1: Cosa facciamo noi */}
              <div className="border-l-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-r-lg">
                <h4 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-3">Cosa facciamo noi</h4>
                <ul className="space-y-2 text-emerald-700 dark:text-emerald-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Riceviamo i dati</strong> - Endpoint webhook sicuro pronto a ricevere file</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Mappiamo automaticamente le colonne</strong> - Riconosciamo automaticamente campi come prezzo, quantita, data ordine</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Gestiamo gli aggiornamenti</strong> - Full replace, append o upsert in base alla configurazione</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span><strong>Monitoriamo lo stato</strong> - Dashboard con errori, metriche e cronologia sync</span>
                  </li>
                </ul>
              </div>

              {/* Sezione 2: Cosa ci aspettiamo dal partner */}
              <div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-r-lg">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">Cosa ci aspettiamo dal partner</h4>
                <ul className="space-y-2 text-blue-700 dark:text-blue-300">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-500">1.</span>
                    <span><strong>Esportare i dati in CSV o Excel</strong> - Formato tabellare con intestazioni nella prima riga</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-500">2.</span>
                    <span><strong>Inviare il file via HTTP POST</strong> - All'endpoint webhook fornito sotto</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-500">3.</span>
                    <span><strong>Firmare la richiesta con HMAC</strong> - Per garantire autenticita e sicurezza</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-500">4.</span>
                    <span><strong>Specificare le colonne chiave</strong> - Solo al primo invio, per identificare record unici</span>
                  </li>
                </ul>
              </div>

              {/* Sezione 3: Credenziali */}
              <div className="space-y-3">
                <h4 className="font-semibold border-b pb-2">Credenziali di Accesso</h4>
                <div className="grid gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Endpoint Webhook</p>
                    <code className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded block break-all">
                      POST {window.location.origin}/api/dataset-sync/webhook/{guideSource.api_key}
                    </code>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">API Key</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono truncate flex-1">{guideSource.api_key}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(guideSource.api_key, "API Key")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Secret Key</p>
                      <p className="text-xs text-amber-600">Fornita al momento della creazione</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sezione 4: Headers */}
              <div className="space-y-3">
                <h4 className="font-semibold border-b pb-2">Headers HTTP Richiesti</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800">
                      <tr>
                        <th className="text-left p-2 font-medium">Header</th>
                        <th className="text-left p-2 font-medium">Valore</th>
                        <th className="text-left p-2 font-medium">Descrizione</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="p-2 font-mono">Content-Type</td>
                        <td className="p-2 font-mono text-emerald-600">multipart/form-data</td>
                        <td className="p-2">Per upload file</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-2 font-mono">X-Dataset-Timestamp</td>
                        <td className="p-2 font-mono text-emerald-600">Unix timestamp</td>
                        <td className="p-2">Secondi da epoch (es: 1737745200)</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-2 font-mono">X-Dataset-Signature</td>
                        <td className="p-2 font-mono text-emerald-600">sha256=...</td>
                        <td className="p-2">HMAC-SHA256 del file con Secret Key</td>
                      </tr>
                      <tr className="border-t">
                        <td className="p-2 font-mono">X-Idempotency-Key</td>
                        <td className="p-2 font-mono text-blue-600">opzionale</td>
                        <td className="p-2">ID univoco per evitare duplicazioni</td>
                      </tr>
                      <tr className="border-t bg-indigo-50/50 dark:bg-indigo-900/10">
                        <td className="p-2 font-mono font-bold">X-Client-Email</td>
                        <td className="p-2 font-mono text-indigo-600">email cliente</td>
                        <td className="p-2">Email del cliente destinatario dei dati (routing multi-cliente)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sezione 4b: Routing Multi-Cliente */}
              <div className="border-l-4 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-r-lg">
                <h4 className="font-semibold text-indigo-800 dark:text-indigo-200 mb-3">Routing Multi-Cliente (Una Sorgente, Molti Clienti)</h4>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mb-3">
                  Con una sola sorgente e API key, puoi inviare dati a clienti diversi. Basta aggiungere l'header <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded font-mono">X-Client-Email</code> con l'email del cliente destinatario.
                </p>
                <div className="space-y-2 text-xs text-indigo-700 dark:text-indigo-300">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-indigo-500" />
                    <span>Il sistema cerca il cliente per email e associa automaticamente i dati al suo account</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-indigo-500" />
                    <span>Ogni cliente ha il suo dataset separato, anche se i dati arrivano dalla stessa sorgente</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-indigo-500" />
                    <span>Quando un nuovo cliente acquista, riceverai una notifica webhook con la sua email da usare qui</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
                    <span>Se l'email non corrisponde a nessun cliente attivo, la richiesta viene rifiutata con errore <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded font-mono">CLIENT_NOT_FOUND</code></span>
                  </div>
                </div>
              </div>

              {/* Sezione 5: Campi Form */}
              <div className="space-y-3">
                <h4 className="font-semibold border-b pb-2">Campi del Form (multipart/form-data)</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800">
                      <tr>
                        <th className="text-left p-2 font-medium">Campo</th>
                        <th className="text-left p-2 font-medium">Tipo</th>
                        <th className="text-left p-2 font-medium">Obbl.</th>
                        <th className="text-left p-2 font-medium">Descrizione</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="p-2 font-mono font-bold">file</td>
                        <td className="p-2">File</td>
                        <td className="p-2 text-emerald-600 font-bold">Si</td>
                        <td className="p-2">File dati in formato CSV, XLSX o XLS</td>
                      </tr>
                      <tr className="border-t bg-purple-50/50 dark:bg-purple-900/10">
                        <td className="p-2 font-mono">replace_mode</td>
                        <td className="p-2">String</td>
                        <td className="p-2 text-slate-400">No</td>
                        <td className="p-2">
                          <span className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">full</span> | 
                          <span className="font-mono bg-blue-200 dark:bg-blue-700 px-1 rounded ml-1">append</span> | 
                          <span className="font-mono bg-purple-200 dark:bg-purple-700 px-1 rounded ml-1">upsert</span>
                        </td>
                      </tr>
                      <tr className="border-t bg-purple-50/50 dark:bg-purple-900/10">
                        <td className="p-2 font-mono">upsert_key_columns</td>
                        <td className="p-2">String</td>
                        <td className="p-2 text-amber-600">*</td>
                        <td className="p-2">Colonne chiave separate da virgola (es: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">order_id,line_id</code>)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">* Obbligatorio se replace_mode=upsert. Definisce quali colonne identificano univocamente ogni riga.</p>
              </div>

              {/* Sezione 6: Modalità Aggiornamento */}
              <div className="space-y-3">
                <h4 className="font-semibold border-b pb-2">Modalita di Aggiornamento Dati</h4>
                <div className="grid gap-2">
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-xs font-bold">full</span>
                      <span className="font-medium">Sostituisci tutto (default)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Cancella tutti i dati esistenti e inserisce quelli nuovi. Ideale per export giornalieri completi.</p>
                  </div>
                  <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-3 bg-blue-50/30 dark:bg-blue-900/10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono bg-blue-200 dark:bg-blue-700 px-2 py-0.5 rounded text-xs font-bold">append</span>
                      <span className="font-medium">Aggiungi in coda</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Inserisce nuovi record senza toccare quelli esistenti. Utile per log incrementali.</p>
                  </div>
                  <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-3 bg-purple-50/30 dark:bg-purple-900/10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono bg-purple-200 dark:bg-purple-700 px-2 py-0.5 rounded text-xs font-bold">upsert</span>
                      <span className="font-medium">Aggiorna o inserisci</span>
                      <span className="text-xs text-purple-600 font-medium">CONSIGLIATO</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Aggiorna record esistenti (stessa chiave) e inserisce quelli nuovi. Ideale per sync incrementali efficienti.</p>
                  </div>
                </div>
              </div>

              {/* Sezione 7: Esempio cURL */}
              <div className="space-y-3">
                <h4 className="font-semibold border-b pb-2">Esempio Implementazione (cURL)</h4>
                <div className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-x-auto">
                  <pre className="whitespace-pre-wrap">{`#!/bin/bash
# Configurazione
API_KEY="${guideSource.api_key}"
SECRET_KEY="<la_tua_secret_key>"
FILE_PATH="ordini.xlsx"
CLIENT_EMAIL="cliente@example.com"
ENDPOINT="${window.location.origin}/api/dataset-sync/webhook/$API_KEY"

# Genera timestamp e firma HMAC
TIMESTAMP=$(date +%s)
SIGNATURE=$(cat "$FILE_PATH" | openssl dgst -sha256 -hmac "$SECRET_KEY" | cut -d' ' -f2)

# Invio dati per un cliente specifico (con routing)
curl -X POST "$ENDPOINT" \\
  -H "X-Dataset-Timestamp: $TIMESTAMP" \\
  -H "X-Dataset-Signature: sha256=$SIGNATURE" \\
  -H "X-Client-Email: $CLIENT_EMAIL" \\
  -F "file=@$FILE_PATH" \\
  -F "replace_mode=upsert" \\
  -F "upsert_key_columns=order_id,line_id"

# Invii successivi per lo stesso cliente
curl -X POST "$ENDPOINT" \\
  -H "X-Dataset-Timestamp: $TIMESTAMP" \\
  -H "X-Dataset-Signature: sha256=$SIGNATURE" \\
  -H "X-Client-Email: $CLIENT_EMAIL" \\
  -F "file=@$FILE_PATH"`}</pre>
                </div>
              </div>

              {/* Nota finale */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Nota Importante
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Le opzioni <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">replace_mode</code> e{' '}
                  <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">upsert_key_columns</code> vengono 
                  salvate nel sistema al primo invio. Negli invii successivi non e necessario ripeterle.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" className="gap-2" onClick={() => guideSource && downloadGuidePDF(guideSource)}>
              <Download className="h-4 w-4" />
              Scarica PDF
            </Button>
            <Button onClick={() => setGuideSource(null)}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
