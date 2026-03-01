import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Loader2, Ticket, Clock, CheckCircle2, AlertCircle, XCircle,
  RefreshCw, Mail, Search, Copy, ChevronDown, ChevronUp,
  Inbox, CircleDot, Archive, X, Bot, MessageSquare, AlertTriangle,
  SendHorizonal, CheckCheck,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { it } from "date-fns/locale";
import { getAuthHeaders } from "@/lib/auth";

interface SentReply {
  bodyText: string | null;
  sentAt: string | null;
}

interface EmailTicket {
  ticket: {
    id: string;
    status: "open" | "in_progress" | "resolved" | "closed";
    priority: "low" | "medium" | "high" | "urgent";
    reason: string;
    reasonDetails?: string;
    suggestedResponse?: string;
    aiClassification?: any;
    resolutionNotes?: string;
    resolvedAt?: string;
    resolvedBy?: string;
    createdAt: string;
    updatedAt?: string;
  };
  email: {
    id?: string;
    subject?: string;
    fromEmail: string;
    fromName?: string;
    snippet?: string;
    receivedAt?: string;
    processingStatus?: string;
  };
  sentReply?: SentReply | null;
  timelineEvents?: Array<{ type: string; reason: string; at: string }>;
}

const statusLabels: Record<string, string> = {
  open: "Aperto",
  in_progress: "In lavorazione",
  resolved: "Risolto",
  closed: "Chiuso",
};

const priorityLabels: Record<string, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const reasonLabels: Record<string, string> = {
  no_kb_answer: "KB senza risposta",
  high_urgency: "Alta urgenza",
  negative_sentiment: "Sentiment negativo",
  escalation_keyword: "Parola escalation",
  low_confidence: "Bassa confidenza",
  ai_low_confidence: "Bassa confidenza AI",
  manual: "Manuale",
};

function priorityBorderColor(p: string) {
  return { urgent: "border-l-red-500", high: "border-l-orange-400", medium: "border-l-blue-400", low: "border-l-slate-300 dark:border-l-slate-600" }[p] ?? "border-l-slate-300";
}

function priorityBadgeClass(p: string) {
  return { urgent: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" }[p] ?? "bg-slate-100 text-slate-600";
}

function statusBadgeClass(s: string) {
  return { open: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", resolved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", closed: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" }[s] ?? "bg-slate-100 text-slate-500";
}

function SlaTag({ createdAt }: { createdAt: string }) {
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3600000;
  if (hours < 24) return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">&lt;24h</span>;
  if (hours < 72) return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">{Math.round(hours / 24)}gg</span>;
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{Math.round(hours / 24)}gg</span>;
}

function shortId(id: string) {
  return "#" + id.replace(/-/g, "").substring(0, 6);
}

interface TicketsListProps {
  onSelectEmail?: (emailId: string) => void;
  onOpenComposer?: (opts: { bodyText: string; replyTo?: any }) => void;
}

export function TicketsList({ onSelectEmail, onOpenComposer }: TicketsListProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<EmailTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);

  useEffect(() => { fetchTickets(); }, []);

  const selected = tickets.find(t => t.ticket.id === selectedId);

  useEffect(() => {
    if (selected) {
      setNotes(selected.ticket.resolutionNotes || "");
      setNotesSaved(false);
    }
  }, [selectedId]);

  async function fetchTickets() {
    setLoading(true);
    try {
      const res = await fetch("/api/email-hub/tickets", { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setTickets(data.data);
    } catch {
      toast({ title: "Errore", description: "Impossibile caricare i ticket", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function updateTicket(ticketId: string, patch: Record<string, any>) {
    setUpdatingId(ticketId);
    try {
      const res = await fetch(`/api/email-hub/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (data.success) {
        setTickets(prev => prev.map(t =>
          t.ticket.id === ticketId ? { ...t, ticket: { ...t.ticket, ...data.data } } : t
        ));
        return true;
      }
    } catch { }
    toast({ title: "Errore", description: "Impossibile aggiornare il ticket", variant: "destructive" });
    return false;
  }

  async function handleStatusChange(ticketId: string, newStatus: string) {
    const ok = await updateTicket(ticketId, { status: newStatus });
    if (ok) toast({ title: "Stato aggiornato", description: `Ticket → "${statusLabels[newStatus]}"` });
    setUpdatingId(null);
  }

  async function handlePriorityChange(ticketId: string, newPriority: string) {
    const ok = await updateTicket(ticketId, { priority: newPriority });
    if (ok) toast({ title: "Priorità aggiornata" });
    setUpdatingId(null);
  }

  async function handleSaveNotes() {
    if (!selectedId) return;
    setSavingNotes(true);
    const ok = await updateTicket(selectedId, { resolutionNotes: notes });
    setSavingNotes(false);
    if (ok) { setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2500); }
    setUpdatingId(null);
  }

  const filtered = tickets
    .filter(t => statusFilter === "all" || t.ticket.status === statusFilter)
    .filter(t => priorityFilter === "all" || t.ticket.priority === priorityFilter)
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (t.email.subject || "").toLowerCase().includes(q) ||
        (t.email.fromName || "").toLowerCase().includes(q) ||
        t.email.fromEmail.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.ticket.createdAt).getTime() - new Date(a.ticket.createdAt).getTime();
      if (sortBy === "oldest") return new Date(a.ticket.createdAt).getTime() - new Date(b.ticket.createdAt).getTime();
      if (sortBy === "priority") {
        const order = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (order[a.ticket.priority as keyof typeof order] ?? 4) - (order[b.ticket.priority as keyof typeof order] ?? 4);
      }
      if (sortBy === "age") return new Date(a.ticket.createdAt).getTime() - new Date(b.ticket.createdAt).getTime();
      return 0;
    });

  const counts = {
    open: tickets.filter(t => t.ticket.status === "open").length,
    in_progress: tickets.filter(t => t.ticket.status === "in_progress").length,
    resolved: tickets.filter(t => t.ticket.status === "resolved").length,
    closed: tickets.filter(t => t.ticket.status === "closed").length,
  };

  const statCards = [
    { key: "open", label: "Aperti", count: counts.open, icon: Inbox, cls: "text-amber-600 dark:text-amber-400", bg: statusFilter === "open" ? "bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700" : "bg-white dark:bg-slate-900 hover:bg-amber-50/50 dark:hover:bg-amber-900/10" },
    { key: "in_progress", label: "In lavorazione", count: counts.in_progress, icon: CircleDot, cls: "text-blue-600 dark:text-blue-400", bg: statusFilter === "in_progress" ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700" : "bg-white dark:bg-slate-900 hover:bg-blue-50/50 dark:hover:bg-blue-900/10" },
    { key: "resolved", label: "Risolti", count: counts.resolved, icon: CheckCircle2, cls: "text-green-600 dark:text-green-400", bg: statusFilter === "resolved" ? "bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700" : "bg-white dark:bg-slate-900 hover:bg-green-50/50 dark:hover:bg-green-900/10" },
    { key: "closed", label: "Chiusi", count: counts.closed, icon: Archive, cls: "text-slate-500 dark:text-slate-400", bg: statusFilter === "closed" ? "bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600" : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none px-6 pt-4 pb-3 border-b bg-white dark:bg-slate-950">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {statCards.map(c => {
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                onClick={() => setStatusFilter(statusFilter === c.key ? "all" : c.key)}
                className={cn("rounded-xl border p-3 text-left transition-all cursor-pointer", c.bg)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                  <Icon className={cn("h-4 w-4", c.cls)} />
                </div>
                <div className={cn("text-2xl font-bold", c.cls)}>{c.count}</div>
              </button>
            );
          })}
        </div>
        {/* Search + filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per oggetto, mittente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Priorità" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le priorità</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="low">Bassa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Ordina" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Più recenti</SelectItem>
              <SelectItem value="oldest">Più vecchi</SelectItem>
              <SelectItem value="priority">Per priorità</SelectItem>
              <SelectItem value="age">Tempo aperto</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={fetchTickets} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className={cn("flex flex-col overflow-hidden border-r", selected ? "w-[42%]" : "w-full")}>
          {loading ? (
            <div className="flex items-center justify-center flex-1">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
              <Ticket className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="font-medium text-slate-700 dark:text-slate-300">Nessun ticket</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? `Nessun risultato per "${search}"` : "Non ci sono ticket per questo filtro"}
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {filtered.map(item => (
                <div
                  key={item.ticket.id}
                  onClick={() => setSelectedId(item.ticket.id === selectedId ? null : item.ticket.id)}
                  className={cn(
                    "border-l-[3px] border-b cursor-pointer transition-colors px-4 py-3",
                    priorityBorderColor(item.ticket.priority),
                    selectedId === item.ticket.id
                      ? "bg-blue-50/80 dark:bg-blue-950/30"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono text-muted-foreground">{shortId(item.ticket.id)}</span>
                        <SlaTag createdAt={item.ticket.createdAt} />
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", priorityBadgeClass(item.ticket.priority))}>
                          {priorityLabels[item.ticket.priority]}
                        </span>
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", statusBadgeClass(item.ticket.status))}>
                          {statusLabels[item.ticket.status]}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                        {item.email.subject || "(Nessun oggetto)"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {item.email.fromName || item.email.fromEmail}
                        {item.email.fromName ? ` · ${item.email.fromEmail}` : ""}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400")}>
                          {reasonLabels[item.ticket.reason] || item.ticket.reason}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(item.ticket.createdAt), { addSuffix: true, locale: it })}
                        </span>
                        {item.timelineEvents?.some(e => e.type === "ticket_created" && e.reason.toLowerCase().includes("riaperto")) && (
                          <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/50">
                            Riaperto
                          </span>
                        )}
                        {item.sentReply && (
                          <span className="flex items-center gap-0.5 text-[10px] font-medium text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
                            <CheckCheck className="h-2.5 w-2.5" />
                            Risposta inviata
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected ? (
          <div className="flex flex-col overflow-hidden flex-1 bg-white dark:bg-slate-950">
            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Header detail */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white leading-snug flex-1">
                    {selected.email.subject || "(Nessun oggetto)"}
                  </h2>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Select
                    value={selected.ticket.priority}
                    onValueChange={v => handlePriorityChange(selected.ticket.id, v)}
                  >
                    <SelectTrigger className={cn("h-6 text-[11px] px-2 py-0 border-0 font-semibold w-auto gap-1 rounded", priorityBadgeClass(selected.ticket.priority))}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Bassa</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded", statusBadgeClass(selected.ticket.status))}>
                    {statusLabels[selected.ticket.status]}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">{shortId(selected.ticket.id)}</span>
                  <SlaTag createdAt={selected.ticket.createdAt} />
                </div>
              </div>

              {/* Sender info */}
              <div className="rounded-xl border bg-slate-50 dark:bg-slate-900 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selected.email.fromName || selected.email.fromEmail}
                  </span>
                  {selected.email.fromName && (
                    <span className="text-muted-foreground text-xs">{selected.email.fromEmail}</span>
                  )}
                </div>
                {selected.email.receivedAt && (
                  <p className="text-xs text-muted-foreground pl-5">
                    Ricevuta: {format(new Date(selected.email.receivedAt), "d MMM yyyy HH:mm", { locale: it })}
                  </p>
                )}
                <p className="text-xs text-muted-foreground pl-5">
                  Ticket aperto: {format(new Date(selected.ticket.createdAt), "d MMM yyyy HH:mm", { locale: it })}
                </p>
              </div>

              {/* Sent reply banner */}
              {selected.sentReply && (
                <div className="rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCheck className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                    <span className="text-sm font-semibold text-green-800 dark:text-green-300">Risposta già inviata</span>
                    {selected.sentReply.sentAt && (
                      <span className="text-xs text-green-600 dark:text-green-400 ml-auto">
                        {format(new Date(selected.sentReply.sentAt), "d MMM yyyy HH:mm", { locale: it })}
                      </span>
                    )}
                  </div>
                  {selected.sentReply.bodyText && (
                    <p className="text-xs text-green-700 dark:text-green-400 whitespace-pre-wrap leading-relaxed line-clamp-4">
                      {selected.sentReply.bodyText}
                    </p>
                  )}
                  <p className="text-[10px] text-green-600/70 dark:text-green-500/70 mt-2 italic">
                    Il ticket può essere chiuso se la risposta è soddisfacente.
                  </p>
                </div>
              )}

              {/* Escalation reason */}
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">Motivo escalation</p>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">
                    {reasonLabels[selected.ticket.reason] || selected.ticket.reason}
                  </p>
                  {selected.ticket.reasonDetails && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">{selected.ticket.reasonDetails}</p>
                  )}
                </div>
              </div>

              {/* AI classification */}
              {selected.ticket.aiClassification && (
                <div>
                  <button
                    onClick={() => setAiExpanded(!aiExpanded)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5 hover:text-slate-900"
                  >
                    <Bot className="h-3.5 w-3.5 text-violet-500" />
                    Classificazione AI
                    {aiExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {aiExpanded && (
                    <div className="flex flex-wrap gap-1.5">
                      {selected.ticket.aiClassification.category && (
                        <Badge variant="secondary" className="text-xs">{selected.ticket.aiClassification.category}</Badge>
                      )}
                      {selected.ticket.aiClassification.sentiment && (
                        <Badge variant="secondary" className="text-xs">{selected.ticket.aiClassification.sentiment}</Badge>
                      )}
                      {selected.ticket.aiClassification.intent && (
                        <Badge variant="secondary" className="text-xs">{selected.ticket.aiClassification.intent}</Badge>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Suggested response — nascosta se è già stata inviata una risposta */}
              {selected.ticket.suggestedResponse && !selected.sentReply && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">Risposta suggerita AI</p>
                  <div className="rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/50 p-3">
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selected.ticket.suggestedResponse}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(selected.ticket.suggestedResponse!);
                          toast({ title: "Copiato negli appunti" });
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copia
                      </Button>
                      {onOpenComposer && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white"
                          onClick={() => onOpenComposer({ bodyText: selected.ticket.suggestedResponse!, replyTo: selected.email })}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Usa come bozza
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">Note interne</p>
                <Textarea
                  value={notes}
                  onChange={e => { setNotes(e.target.value); setNotesSaved(false); }}
                  placeholder="Aggiungi note sulla lavorazione di questo ticket..."
                  rows={3}
                  className="text-sm resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className={cn("text-xs transition-opacity", notesSaved ? "text-green-600 dark:text-green-400 opacity-100" : "opacity-0")}>
                    ✓ Note salvate
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                  >
                    {savingNotes ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                    Salva note
                  </Button>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-2">Timeline</p>
                <div className="relative pl-5 space-y-3">
                  <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-200 dark:bg-slate-700" />
                  <div className="relative flex items-start gap-2">
                    <div className="absolute -left-5 top-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-white dark:border-slate-950 z-10" />
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Ticket creato</p>
                      <p className="text-[10px] text-muted-foreground">{format(new Date(selected.ticket.createdAt), "d MMM yyyy HH:mm", { locale: it })}</p>
                    </div>
                  </div>
                  {(selected.timelineEvents || []).map((ev, idx) => {
                    const isReopen = ev.type === "ticket_created" && ev.reason.toLowerCase().includes("riaperto");
                    const isNewReply = ev.type === "draft_generated" && ev.reason.toLowerCase().includes("nuova risposta");
                    if (!isReopen && !isNewReply) return null;
                    return (
                      <div key={idx} className="relative flex items-start gap-2">
                        <div className={`absolute -left-5 top-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-950 z-10 ${isReopen ? "bg-orange-400" : "bg-sky-400"}`} />
                        <div>
                          <p className={`text-xs font-medium ${isReopen ? "text-orange-700 dark:text-orange-400" : "text-sky-700 dark:text-sky-400"}`}>
                            {isReopen ? "Ticket riaperto" : "Nuova risposta ricevuta"}
                          </p>
                          {ev.reason && (
                            <p className="text-[10px] text-muted-foreground">{ev.reason.slice(0, 60)}{ev.reason.length > 60 ? "…" : ""}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground">{format(new Date(ev.at), "d MMM yyyy HH:mm", { locale: it })}</p>
                        </div>
                      </div>
                    );
                  })}
                  {(selected.ticket.status === "in_progress" || selected.ticket.status === "resolved" || selected.ticket.status === "closed") && (
                    <div className="relative flex items-start gap-2">
                      <div className="absolute -left-5 top-0.5 w-3 h-3 rounded-full bg-blue-400 border-2 border-white dark:border-slate-950 z-10" />
                      <div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Preso in carico</p>
                        <p className="text-[10px] text-muted-foreground">{selected.ticket.updatedAt ? format(new Date(selected.ticket.updatedAt), "d MMM yyyy HH:mm", { locale: it }) : "—"}</p>
                      </div>
                    </div>
                  )}
                  {selected.sentReply?.sentAt && (
                    <div className="relative flex items-start gap-2">
                      <div className="absolute -left-5 top-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-white dark:border-slate-950 z-10 flex items-center justify-center" />
                      <div>
                        <p className="text-xs font-medium text-green-700 dark:text-green-400">Risposta inviata</p>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(selected.sentReply.sentAt), "d MMM yyyy HH:mm", { locale: it })}</p>
                      </div>
                    </div>
                  )}
                  {(selected.ticket.status === "resolved" || selected.ticket.status === "closed") && selected.ticket.resolvedAt && (
                    <div className="relative flex items-start gap-2">
                      <div className="absolute -left-5 top-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-slate-950 z-10" />
                      <div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Risolto</p>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(selected.ticket.resolvedAt), "d MMM yyyy HH:mm", { locale: it })}</p>
                      </div>
                    </div>
                  )}
                  {selected.ticket.status === "closed" && (
                    <div className="relative flex items-start gap-2">
                      <div className="absolute -left-5 top-0.5 w-3 h-3 rounded-full bg-slate-400 border-2 border-white dark:border-slate-950 z-10" />
                      <div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Chiuso</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions footer */}
            <div className="flex-none border-t bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground shrink-0">Cambia stato:</span>
                <Select
                  value={selected.ticket.status}
                  onValueChange={v => handleStatusChange(selected.ticket.id, v)}
                  disabled={updatingId === selected.ticket.id}
                >
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aperto</SelectItem>
                    <SelectItem value="in_progress">In lavorazione</SelectItem>
                    <SelectItem value="resolved">Risolto</SelectItem>
                    <SelectItem value="closed">Chiuso</SelectItem>
                  </SelectContent>
                </Select>
                {updatingId === selected.ticket.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <div className="flex gap-2">
                {onSelectEmail && selected.email.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs"
                    onClick={() => onSelectEmail(selected.email.id!)}
                  >
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                    Apri email originale
                  </Button>
                )}
                {selected.ticket.status !== "closed" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-8 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    disabled={updatingId === selected.ticket.id}
                    onClick={() => handleStatusChange(selected.ticket.id, "closed")}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                    Chiudi ticket
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 dark:bg-slate-900/30">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Ticket className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="font-medium text-slate-600 dark:text-slate-400">Seleziona un ticket</p>
            <p className="text-sm text-muted-foreground mt-1">Clicca su un ticket per vedere i dettagli e gestirlo</p>
          </div>
        )}
      </div>
    </div>
  );
}
