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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
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
  Settings,
  ChevronDown,
  Loader2,
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

interface SystemDocument {
  id: string;
  title: string;
  content: string;
  description: string | null;
  is_active: boolean;
  target_client_assistant: boolean;
  target_autonomous_agents: Record<string, boolean>;
  target_whatsapp_agents: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

interface DocumentForm {
  title: string;
  content: string;
  description: string;
  target_client_assistant: boolean;
  target_autonomous_agents: Record<string, boolean>;
  target_whatsapp_agents: boolean;
  priority: number;
}

const emptyForm = (): DocumentForm => ({
  title: "",
  content: "",
  description: "",
  target_client_assistant: true,
  target_autonomous_agents: Object.fromEntries(AUTONOMOUS_AGENTS.map(a => [a.id, false])),
  target_whatsapp_agents: false,
  priority: 5,
});

export default function SystemDocumentsSection() {
  const [showDialog, setShowDialog] = useState(false);
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

  const documents: SystemDocument[] = response?.data || [];

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
      closeDialog();
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
      closeDialog();
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

  const closeDialog = () => {
    setShowDialog(false);
    setEditingDoc(null);
    setForm(emptyForm());
    setAgentsOpen(false);
  };

  const openCreate = () => {
    setEditingDoc(null);
    setForm(emptyForm());
    setShowDialog(true);
  };

  const openEdit = (doc: SystemDocument) => {
    setEditingDoc(doc);
    setForm({
      title: doc.title,
      content: doc.content,
      description: doc.description || "",
      target_client_assistant: doc.target_client_assistant,
      target_autonomous_agents: { ...Object.fromEntries(AUTONOMOUS_AGENTS.map(a => [a.id, false])), ...doc.target_autonomous_agents },
      target_whatsapp_agents: doc.target_whatsapp_agents,
      priority: doc.priority,
    });
    setShowDialog(true);
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
    const badges: { label: string; icon: React.ReactNode; variant: string }[] = [];
    if (doc.target_client_assistant) {
      badges.push({ label: "AI Assistant", icon: <Sparkles className="h-3 w-3" />, variant: "blue" });
    }
    if (doc.target_whatsapp_agents) {
      badges.push({ label: "WhatsApp", icon: <MessageCircle className="h-3 w-3" />, variant: "green" });
    }
    const activeAgents = Object.entries(doc.target_autonomous_agents || {})
      .filter(([, v]) => v)
      .map(([k]) => k);
    activeAgents.forEach(agentId => {
      const agent = AUTONOMOUS_AGENTS.find(a => a.id === agentId);
      if (agent) {
        badges.push({ label: agent.name, icon: <Bot className="h-3 w-3" />, variant: "purple" });
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
              Documenti iniettati direttamente nel prompt di sistema dell'AI (sempre in memoria)
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
                Crea il tuo primo documento per iniettare istruzioni nel prompt AI
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedDocuments.map(doc => {
                const badges = getTargetBadges(doc);
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
                        </div>
                        {doc.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{doc.description}</p>
                        )}
                        {badges.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            {badges.map((b, i) => (
                              <Badge key={i} variant="outline" className="text-xs gap-1 py-0.5">
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

      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingDoc ? "Modifica Documento di Sistema" : "Nuovo Documento di Sistema"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-5 pb-2">
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="sys-doc-content">Contenuto *</Label>
                  <span className="text-xs text-muted-foreground">{form.content.length} caratteri</span>
                </div>
                <Textarea
                  id="sys-doc-content"
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Testo che verrà iniettato nel prompt di sistema dell'AI..."
                  rows={10}
                  className="resize-y min-h-[200px] font-mono text-sm"
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
                  Priorità più alta = iniettato prima nel prompt (1 = bassa, 10 = alta)
                </p>
              </div>

              <div className="space-y-4">
                <Label className="text-base font-medium">Destinatari</Label>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">AI Assistant Clienti</p>
                      <p className="text-xs text-muted-foreground">Inietta nel prompt dell'assistente AI</p>
                    </div>
                  </div>
                  <Switch
                    checked={form.target_client_assistant}
                    onCheckedChange={v => setForm(f => ({ ...f, target_client_assistant: v }))}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Agenti WhatsApp</p>
                      <p className="text-xs text-muted-foreground">Visibile agli agenti WhatsApp</p>
                    </div>
                  </div>
                  <Switch
                    checked={form.target_whatsapp_agents}
                    onCheckedChange={v => setForm(f => ({ ...f, target_whatsapp_agents: v }))}
                  />
                </div>

                <Collapsible open={agentsOpen} onOpenChange={setAgentsOpen}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-purple-500" />
                        <div>
                          <p className="text-sm font-medium">Agenti Autonomi</p>
                          <p className="text-xs text-muted-foreground">
                            {Object.values(form.target_autonomous_agents).filter(Boolean).length} di {AUTONOMOUS_AGENTS.length} selezionati
                          </p>
                        </div>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${agentsOpen ? "rotate-180" : ""}`} />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid grid-cols-2 gap-2 mt-2 pl-2">
                      {AUTONOMOUS_AGENTS.map(agent => (
                        <label
                          key={agent.id}
                          className="flex items-center gap-2 rounded-md border p-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
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
                          <span className="text-sm">{agent.name}</span>
                        </label>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              Annulla
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingDoc ? "Salva Modifiche" : "Crea Documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  );
}