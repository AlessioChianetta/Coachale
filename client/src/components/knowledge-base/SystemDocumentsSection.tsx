import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Edit3,
  Trash2,
  FileText,
  Sparkles,
  MessageCircle,
  Bot,
  Users,
  ChevronDown,
  Loader2,
  Search,
  StickyNote,
  Building2,
  X,
  Cloud,
  RefreshCw,
  Clock,
  History,
  CheckCircle2,
  XCircle,
  Timer,
  AlertTriangle,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const AUTONOMOUS_AGENTS = [
  { id: "alessia", name: "Alessia" },
  { id: "millie", name: "Millie" },
  { id: "echo", name: "Echo" },
  { id: "nova", name: "Nova" },
  { id: "stella", name: "Stella" },
  { id: "iris", name: "Iris" },
  { id: "marco", name: "Marco" },
  { id: "personalizza", name: "Personalizza" },
];

interface WhatsAppAgent {
  id: string;
  agent_name: string;
  agent_type: string;
  is_active: boolean;
}

interface SystemDocument {
  id: string;
  title: string;
  content: string;
  description: string | null;
  is_active: boolean;
  target_client_assistant: boolean;
  target_client_mode: 'all' | 'clients_only' | 'employees_only' | 'specific_clients' | 'specific_departments' | 'specific_employees';
  target_client_ids: string[];
  target_department_ids: string[];
  target_autonomous_agents: Record<string, boolean>;
  target_whatsapp_agents: Record<string, boolean>;
  injection_mode: "system_prompt" | "file_search";
  priority: number;
  google_drive_file_id: string | null;
  last_drive_sync_at: string | null;
  sync_count: number | null;
  pending_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isEmployee: boolean;
  departmentId: string | null;
}

interface Department {
  id: string;
  name: string;
  color: string;
  employee_count: number;
}

type TargetClientMode = 'all' | 'clients_only' | 'employees_only' | 'specific_clients' | 'specific_departments' | 'specific_employees';

interface DocumentForm {
  title: string;
  content: string;
  description: string;
  target_client_assistant: boolean;
  target_client_mode: TargetClientMode;
  target_client_ids: string[];
  target_department_ids: string[];
  target_autonomous_agents: Record<string, boolean>;
  target_whatsapp_agents: Record<string, boolean>;
  injection_mode: "system_prompt" | "file_search";
  priority: number;
}

const emptyForm = (): DocumentForm => ({
  title: "",
  content: "",
  description: "",
  target_client_assistant: false,
  target_client_mode: 'all',
  target_client_ids: [],
  target_department_ids: [],
  target_autonomous_agents: Object.fromEntries(AUTONOMOUS_AGENTS.map(a => [a.id, false])),
  target_whatsapp_agents: {},
  injection_mode: "system_prompt",
  priority: 5,
});

export default function SystemDocumentsSection() {
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<SystemDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<DocumentForm>(emptyForm());
  const [agentsOpen, setAgentsOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: response, isLoading } = useQuery({
    queryKey: ["/api/consultant/knowledge/system-documents"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/knowledge/system-documents", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch system documents");
      return res.json();
    },
  });

  const { data: whatsappResponse } = useQuery({
    queryKey: ["/api/consultant/knowledge/whatsapp-agents"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/knowledge/whatsapp-agents", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch WhatsApp agents");
      return res.json();
    },
  });

  const { data: clientsResponse } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const { data: departmentsResponse } = useQuery({
    queryKey: ["/api/departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch departments");
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const documents: SystemDocument[] = response?.data || [];
  const whatsappAgents: WhatsAppAgent[] = whatsappResponse?.data || [];
  const allClients: ClientUser[] = Array.isArray(clientsResponse) ? clientsResponse : (clientsResponse?.data || []);
  const departments: Department[] = departmentsResponse?.data || [];
  const nonEmployeeClients = allClients.filter(c => !c.isEmployee);
  const employeeClients = allClients.filter(c => c.isEmployee);

  const createMutation = useMutation({
    mutationFn: async (data: DocumentForm) => {
      const res = await fetch("/api/consultant/knowledge/system-documents", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nella creazione");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/system-documents"] });
      closeForm();
      toast({ title: "Documento creato", description: "Il documento di sistema è stato creato con successo" });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DocumentForm }) => {
      const res = await fetch(`/api/consultant/knowledge/system-documents/${id}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nell'aggiornamento");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/system-documents"] });
      closeForm();
      toast({ title: "Documento aggiornato", description: "Le modifiche sono state salvate" });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/consultant/knowledge/system-documents/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nell'eliminazione");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/system-documents"] });
      setDeletingId(null);
      toast({ title: "Documento eliminato", description: "Il documento è stato eliminato" });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/consultant/knowledge/system-documents/${id}/toggle`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore nel toggle");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/system-documents"] });
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const [syncingDocId, setSyncingDocId] = useState<string | null>(null);

  const manualSyncMutation = useMutation({
    mutationFn: async (id: string) => {
      setSyncingDocId(id);
      const res = await fetch(`/api/consultant/knowledge/system-documents/${id}/sync`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Sync fallita");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/knowledge/system-documents"] });
      toast({ title: "Sincronizzato", description: "Documento aggiornato da Google Drive" });
      setSyncingDocId(null);
    },
    onError: (err: any) => {
      toast({ title: "Errore sync", description: err.message, variant: "destructive" });
      setSyncingDocId(null);
    },
  });

  const [historyDocId, setHistoryDocId] = useState<string | null>(null);
  const [historyDocTitle, setHistoryDocTitle] = useState("");

  const { data: syncHistoryResponse, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["/api/consultant/knowledge/system-documents/sync-history", historyDocId],
    queryFn: async () => {
      const res = await fetch(`/api/consultant/knowledge/system-documents/${historyDocId}/sync-history`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch sync history");
      return res.json();
    },
    enabled: !!historyDocId,
  });

  const syncHistory: any[] = syncHistoryResponse?.data || [];

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return dateStr; }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingDoc(null);
    setForm(emptyForm());
    setAgentsOpen(false);
  };

  const openCreate = () => {
    setEditingDoc(null);
    const newForm = emptyForm();
    if (whatsappAgents.length > 0) {
      newForm.target_whatsapp_agents = Object.fromEntries(whatsappAgents.map(a => [a.id, false]));
    }
    setForm(newForm);
    setShowForm(true);
  };

  const openEdit = (doc: SystemDocument) => {
    setEditingDoc(doc);
    const waAgents = whatsappAgents.length > 0
      ? { ...Object.fromEntries(whatsappAgents.map(a => [a.id, false])), ...(doc.target_whatsapp_agents || {}) }
      : (doc.target_whatsapp_agents || {});
    setForm({
      title: doc.title,
      content: doc.content,
      description: doc.description || "",
      target_client_assistant: doc.target_client_assistant,
      target_client_mode: doc.target_client_mode || 'all',
      target_client_ids: doc.target_client_ids || [],
      target_department_ids: doc.target_department_ids || [],
      target_autonomous_agents: { ...Object.fromEntries(AUTONOMOUS_AGENTS.map(a => [a.id, false])), ...doc.target_autonomous_agents },
      target_whatsapp_agents: waAgents,
      injection_mode: doc.injection_mode || "system_prompt",
      priority: doc.priority,
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: "Campi obbligatori", description: "Titolo e contenuto sono obbligatori", variant: "destructive" });
      return;
    }
    if (editingDoc) {
      updateMutation.mutate({ id: editingDoc.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const getTargetBadges = (doc: SystemDocument) => {
    const badges: { label: string; icon: React.ReactNode; colorClass: string }[] = [];

    badges.push({
      label: doc.injection_mode === "file_search" ? "File Search" : "System Prompt",
      icon: doc.injection_mode === "file_search" ? <Search className="h-3 w-3" /> : <StickyNote className="h-3 w-3" />,
      colorClass: doc.injection_mode === "file_search" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-slate-100 text-slate-800 border-slate-200",
    });

    if (doc.target_client_assistant) {
      const mode = doc.target_client_mode || 'all';
      let aiLabel = "AI Assistant - Tutti";
      if (mode === 'clients_only') aiLabel = "AI Assistant - Solo Clienti";
      else if (mode === 'employees_only') aiLabel = "AI Assistant - Solo Dipendenti";
      else if (mode === 'specific_clients') aiLabel = `AI Assistant - ${(doc.target_client_ids || []).length} clienti`;
      else if (mode === 'specific_departments') aiLabel = `AI Assistant - ${(doc.target_department_ids || []).length} reparti`;
      else if (mode === 'specific_employees') aiLabel = `AI Assistant - ${(doc.target_client_ids || []).length} dipendenti`;
      badges.push({ label: aiLabel, icon: <Sparkles className="h-3 w-3" />, colorClass: "bg-blue-100 text-blue-800 border-blue-200" });
    }

    const activeWhatsapp = Object.entries(doc.target_whatsapp_agents || {})
      .filter(([, v]) => v)
      .map(([k]) => k);
    activeWhatsapp.forEach(agentId => {
      const agent = whatsappAgents.find(a => a.id === agentId);
      badges.push({
        label: agent?.agent_name || agentId.slice(0, 8),
        icon: <MessageCircle className="h-3 w-3" />,
        colorClass: "bg-green-100 text-green-800 border-green-200",
      });
    });

    const activeAgents = Object.entries(doc.target_autonomous_agents || {})
      .filter(([, v]) => v)
      .map(([k]) => k);
    activeAgents.forEach(agentId => {
      const agent = AUTONOMOUS_AGENTS.find(a => a.id === agentId);
      if (agent) {
        badges.push({ label: agent.name, icon: <Bot className="h-3 w-3" />, colorClass: "bg-purple-100 text-purple-800 border-purple-200" });
      }
    });
    return badges;
  };

  const sortedDocuments = [...documents].sort((a, b) => b.priority - a.priority);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-indigo-500" />
              Documenti di Sistema
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Istruzioni personalizzate per l'AI — scegli se iniettarle nel System Prompt o nel File Search
            </p>
          </div>
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nuovo Documento
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Nessun documento di sistema creato</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Crea il tuo primo documento per iniettare istruzioni nell'AI
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedDocuments.map(doc => {
                const badges = getTargetBadges(doc);
                const isGoogleDriveDoc = !!doc.google_drive_file_id;
                return (
                  <div
                    key={doc.id}
                    className={`border rounded-lg p-4 transition-colors ${
                      doc.is_active
                        ? "bg-card hover:bg-accent/30"
                        : "bg-muted/30 opacity-70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium truncate">{doc.title}</h4>
                          <Badge variant={doc.is_active ? "default" : "secondary"} className="text-xs shrink-0">
                            {doc.is_active ? "Attivo" : "Inattivo"}
                          </Badge>
                          <Badge variant="outline" className="text-xs shrink-0">
                            Priorità {doc.priority}
                          </Badge>
                          {isGoogleDriveDoc && (
                            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                              <Cloud className="w-3 h-3" />
                              Google Drive
                            </span>
                          )}
                        </div>
                        {doc.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{doc.description}</p>
                        )}

                        {isGoogleDriveDoc && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {doc.sync_count != null && doc.sync_count > 0 && (
                              <span className="flex items-center gap-1 text-xs text-blue-600">
                                <RefreshCw className="w-3 h-3" />
                                {doc.sync_count} sincronizzazioni
                              </span>
                            )}
                            {doc.last_drive_sync_at && (
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                Ultimo sync: {formatDate(doc.last_drive_sync_at)}
                              </span>
                            )}
                            {doc.pending_sync_at && (
                              <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" />
                                Sync programmato: {formatDate(doc.pending_sync_at)}
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => manualSyncMutation.mutate(doc.id)}
                              disabled={syncingDocId === doc.id}
                            >
                              <RefreshCw className={`w-3 h-3 mr-1 ${syncingDocId === doc.id ? 'animate-spin' : ''}`} />
                              {syncingDocId === doc.id ? 'Sincronizzando...' : 'Sincronizza ora'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                              onClick={() => { setHistoryDocId(doc.id); setHistoryDocTitle(doc.title); }}
                            >
                              <History className="w-3 h-3 mr-1" />
                              Cronologia
                            </Button>
                          </div>
                        )}

                        {badges.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {badges.map((b, i) => (
                              <Badge key={i} variant="outline" className={`text-xs gap-1 py-0.5 ${b.colorClass}`}>
                                {b.icon}
                                {b.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={doc.is_active}
                          onCheckedChange={() => toggleMutation.mutate(doc.id)}
                          aria-label="Attiva/disattiva documento"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(doc)}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeletingId(doc.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <Card className="border-indigo-200 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-500" />
              {editingDoc ? "Modifica Documento di Sistema" : "Nuovo Documento di Sistema"}
            </CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeForm} disabled={isSaving}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sys-doc-title">Titolo *</Label>
                  <Input
                    id="sys-doc-title"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Es: Istruzioni generali per l'AI"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sys-doc-desc">Descrizione (nota interna)</Label>
                  <Input
                    id="sys-doc-desc"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Nota interna per identificare questo documento"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sys-doc-content">Contenuto *</Label>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{form.content.length} caratteri</span>
                    <span className="text-xs text-muted-foreground">~{Math.round(form.content.length / 4).toLocaleString()} token</span>
                  </div>
                </div>
                <Textarea
                  id="sys-doc-content"
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Testo che verrà iniettato nel prompt di sistema dell'AI..."
                  rows={8}
                  className="resize-y min-h-[150px] font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priorità: {form.priority}</Label>
                  <Slider
                    value={[form.priority]}
                    onValueChange={([v]) => setForm(f => ({ ...f, priority: v }))}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    1 = bassa, 10 = alta
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Modalità di Iniezione</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, injection_mode: 'system_prompt' }))}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        form.injection_mode === 'system_prompt'
                          ? 'border-slate-500 bg-slate-50 dark:bg-slate-900/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <StickyNote className="h-5 w-5 text-slate-600" />
                        <span className="font-semibold text-sm">System Prompt</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Sempre in memoria ad ogni chiamata AI. Ideale per <strong>brevi istruzioni</strong>, regole di comportamento e linee guida.
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        Consuma token ad ogni richiesta
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, injection_mode: 'file_search' }))}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        form.injection_mode === 'file_search'
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 shadow-sm'
                          : 'border-slate-200 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Search className="h-5 w-5 text-amber-600" />
                        <span className="font-semibold text-sm">File Search</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Cercato solo quando rilevante. Ideale per <strong>documentazione lunga</strong>, manuali, procedure e riferimenti.
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Efficiente — usa token solo se necessario
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {form.injection_mode === 'system_prompt' && form.content.length > 5000 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800 dark:text-amber-200">
                    <p className="font-medium">Contenuto lungo per System Prompt (~{Math.round(form.content.length / 4).toLocaleString()} token)</p>
                    <p className="mt-0.5 text-amber-600 dark:text-amber-300">
                      Questi token verranno consumati ad ogni chiamata AI. Per documentazione lunga, considera la modalità <strong>File Search</strong> che usa i token solo quando il contenuto è rilevante.
                    </p>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  <Label className="text-base font-semibold text-slate-800">Chi riceve questo documento?</Label>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">Seleziona almeno un destinatario tra AI Assistant, WhatsApp o Agenti Autonomi</p>

                {!form.target_client_assistant && Object.values(form.target_whatsapp_agents).every(v => !v) && Object.values(form.target_autonomous_agents).every(v => !v) && (
                  <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 p-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                    <p className="text-xs text-amber-700 font-medium">Nessun destinatario selezionato — il documento non sarà visibile a nessuno finché non attivi almeno un canale</p>
                  </div>
                )}

                <div className={`rounded-xl border-2 overflow-hidden transition-colors ${form.target_client_assistant ? 'border-blue-400 bg-blue-50/30' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Sparkles className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">AI Assistant Clienti</p>
                        <p className="text-xs text-muted-foreground">Inietta nel chatbot AI visibile ai clienti/dipendenti</p>
                      </div>
                    </div>
                    <Switch
                      checked={form.target_client_assistant}
                      onCheckedChange={v => setForm(f => ({ ...f, target_client_assistant: v }))}
                    />
                  </div>

                  {form.target_client_assistant && (
                    <div className="p-4 space-y-3 border-t border-blue-200 bg-white/50">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-blue-800 uppercase tracking-wide">A chi mostrare?</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {([
                            { value: 'all', label: 'Tutti', icon: '👥' },
                            { value: 'clients_only', label: 'Solo Clienti', icon: '🧑' },
                            { value: 'employees_only', label: 'Solo Dipendenti', icon: '👷' },
                            { value: 'specific_clients', label: 'Clienti Specifici', icon: '🎯' },
                            { value: 'specific_departments', label: 'Per Reparto', icon: '🏢' },
                            { value: 'specific_employees', label: 'Dipendenti Specifici', icon: '📋' },
                          ] as const).map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setForm(f => ({ ...f, target_client_mode: opt.value as TargetClientMode, target_client_ids: [], target_department_ids: [] }))}
                              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium border transition-all ${
                                form.target_client_mode === opt.value
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                              }`}
                            >
                              <span>{opt.icon}</span>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {form.target_client_mode === 'specific_clients' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-600">
                            {form.target_client_ids.length} clienti selezionati
                          </Label>
                          <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border bg-white p-2">
                            {nonEmployeeClients.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2 text-center">Nessun cliente trovato</p>
                            ) : nonEmployeeClients.map(client => (
                              <label key={client.id} className="flex items-center gap-2 rounded-md p-2 cursor-pointer hover:bg-blue-50 transition-colors">
                                <Checkbox
                                  checked={form.target_client_ids.includes(client.id)}
                                  onCheckedChange={(checked) =>
                                    setForm(f => ({
                                      ...f,
                                      target_client_ids: checked
                                        ? [...f.target_client_ids, client.id]
                                        : f.target_client_ids.filter(id => id !== client.id),
                                    }))
                                  }
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm truncate">{client.firstName} {client.lastName}</p>
                                  <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {form.target_client_mode === 'specific_departments' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-600">
                            {form.target_department_ids.length} reparti selezionati
                          </Label>
                          <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border bg-white p-2">
                            {departments.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2 text-center">Nessun reparto trovato — crea i reparti dalla pagina Gestione Clienti</p>
                            ) : departments.map(dept => (
                              <label key={dept.id} className="flex items-center gap-2 rounded-md p-2 cursor-pointer hover:bg-blue-50 transition-colors">
                                <Checkbox
                                  checked={form.target_department_ids.includes(dept.id)}
                                  onCheckedChange={(checked) =>
                                    setForm(f => ({
                                      ...f,
                                      target_department_ids: checked
                                        ? [...f.target_department_ids, dept.id]
                                        : f.target_department_ids.filter(id => id !== dept.id),
                                    }))
                                  }
                                />
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: dept.color || '#6b7280' }} />
                                  <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-sm truncate">{dept.name}</span>
                                  <Badge variant="outline" className="text-xs shrink-0 ml-auto">{dept.employee_count} dip.</Badge>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {form.target_client_mode === 'specific_employees' && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-600">
                            {form.target_client_ids.length} dipendenti selezionati
                          </Label>
                          <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border bg-white p-2">
                            {employeeClients.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2 text-center">Nessun dipendente trovato</p>
                            ) : (() => {
                              const grouped = new Map<string, ClientUser[]>();
                              employeeClients.forEach(emp => {
                                const deptId = emp.departmentId || '_none';
                                if (!grouped.has(deptId)) grouped.set(deptId, []);
                                grouped.get(deptId)!.push(emp);
                              });
                              return Array.from(grouped.entries()).map(([deptId, emps]) => {
                                const dept = departments.find(d => d.id === deptId);
                                return (
                                  <div key={deptId}>
                                    {grouped.size > 1 && (
                                      <div className="flex items-center gap-1.5 px-1 py-1.5 border-b border-slate-100">
                                        {dept && <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dept.color || '#6b7280' }} />}
                                        <span className="text-xs font-semibold text-slate-500">{dept?.name || 'Senza reparto'}</span>
                                      </div>
                                    )}
                                    {emps.map(emp => (
                                      <label key={emp.id} className="flex items-center gap-2 rounded-md p-2 cursor-pointer hover:bg-blue-50 transition-colors">
                                        <Checkbox
                                          checked={form.target_client_ids.includes(emp.id)}
                                          onCheckedChange={(checked) =>
                                            setForm(f => ({
                                              ...f,
                                              target_client_ids: checked
                                                ? [...f.target_client_ids, emp.id]
                                                : f.target_client_ids.filter(id => id !== emp.id),
                                            }))
                                          }
                                        />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm truncate">{emp.firstName} {emp.lastName}</p>
                                          <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {whatsappAgents.length > 0 && (
                  <div className={`rounded-xl border-2 overflow-hidden transition-colors ${Object.values(form.target_whatsapp_agents).some(Boolean) ? 'border-green-400 bg-green-50/30' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <MessageCircle className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Dipendenti WhatsApp</p>
                          <p className="text-xs text-muted-foreground">
                            {Object.values(form.target_whatsapp_agents).filter(Boolean).length} di {whatsappAgents.length} selezionati
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-3 border-t border-green-100 bg-white/50 grid grid-cols-1 gap-2">
                      {whatsappAgents.map(agent => (
                        <label
                          key={agent.id}
                          className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${!!form.target_whatsapp_agents[agent.id] ? 'bg-green-50 border-green-300' : 'hover:bg-green-50/50'}`}
                        >
                          <Checkbox
                            checked={!!form.target_whatsapp_agents[agent.id]}
                            onCheckedChange={(checked) =>
                              setForm(f => ({
                                ...f,
                                target_whatsapp_agents: {
                                  ...f.target_whatsapp_agents,
                                  [agent.id]: !!checked,
                                },
                              }))
                            }
                          />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <MessageCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            <span className="text-sm font-medium truncate">{agent.agent_name || "Agente senza nome"}</span>
                            <Badge variant="outline" className="text-xs shrink-0 ml-auto">
                              {agent.agent_type || "general"}
                            </Badge>
                            {!agent.is_active && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                Inattivo
                              </Badge>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <Collapsible open={agentsOpen} onOpenChange={setAgentsOpen}>
                  <CollapsibleTrigger asChild>
                    <div className={`flex items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition-colors ${Object.values(form.target_autonomous_agents).some(Boolean) ? 'border-purple-400 bg-purple-50/30' : 'border-slate-200 hover:bg-accent/50'}`}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Bot className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">Agenti Autonomi</p>
                          <p className="text-xs text-muted-foreground">
                            {Object.values(form.target_autonomous_agents).filter(Boolean).length} di {AUTONOMOUS_AGENTS.length} selezionati
                          </p>
                        </div>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${agentsOpen ? "rotate-180" : ""}`} />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid grid-cols-2 gap-2 mt-2 px-1">
                      {AUTONOMOUS_AGENTS.map(agent => (
                        <label
                          key={agent.id}
                          className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${!!form.target_autonomous_agents[agent.id] ? 'bg-purple-50 border-purple-300' : 'hover:bg-purple-50/50'}`}
                        >
                          <Checkbox
                            checked={!!form.target_autonomous_agents[agent.id]}
                            onCheckedChange={(checked) =>
                              setForm(f => ({
                                ...f,
                                target_autonomous_agents: {
                                  ...f.target_autonomous_agents,
                                  [agent.id]: !!checked,
                                },
                              }))
                            }
                          />
                          <span className="text-sm font-medium">{agent.name}</span>
                        </label>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              <Separator />

              <div className="flex items-center justify-end gap-3">
                <Button variant="outline" onClick={closeForm} disabled={isSaving}>
                  Annulla
                </Button>
                <Button onClick={handleSubmit} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingDoc ? "Salva Modifiche" : "Crea Documento"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione è irreversibile. Il documento verrà rimosso permanentemente e non sarà più iniettato nei prompt AI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!historyDocId} onOpenChange={(open) => { if (!open) setHistoryDocId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-blue-500" />
              Cronologia Sync
            </DialogTitle>
            <p className="text-sm text-muted-foreground truncate">{historyDocTitle}</p>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : syncHistory.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nessuna sincronizzazione registrata
              </div>
            ) : (
              <div className="space-y-2">
                {syncHistory.map((entry: any, i: number) => (
                  <div key={entry.id || i} className={`rounded-lg border p-3 text-sm ${
                    entry.status === 'failed' ? 'border-red-200 bg-red-50/50' :
                    entry.status === 'pending' ? 'border-orange-200 bg-orange-50/50' :
                    'border-green-200 bg-green-50/50'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {entry.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                        {entry.status === 'failed' && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                        {entry.status === 'pending' && <Timer className="h-4 w-4 text-orange-600 shrink-0" />}
                        <span className="font-medium capitalize">
                          {entry.sync_type === 'manual' ? 'Manuale' :
                           entry.sync_type === 'webhook' ? 'Automatica' :
                           entry.sync_type === 'scheduled' ? 'Programmata' :
                           entry.sync_type === 'initial' ? 'Iniziale' : entry.sync_type}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {entry.started_at ? formatDate(entry.started_at) : '-'}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {entry.characters_extracted != null && (
                        <span>{entry.characters_extracted.toLocaleString()} caratteri</span>
                      )}
                      {entry.estimated_tokens != null && (
                        <span>~{entry.estimated_tokens.toLocaleString()} token</span>
                      )}
                      {entry.duration_ms != null && (
                        <span>Durata: {formatDuration(entry.duration_ms)}</span>
                      )}
                      {entry.new_version != null && (
                        <span>Versione #{entry.new_version}</span>
                      )}
                    </div>
                    {entry.status === 'failed' && entry.error_message && (
                      <p className="mt-1.5 text-xs text-red-600 line-clamp-2">{entry.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
