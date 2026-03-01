import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Search, Clock, CheckCircle2, ChevronDown, ChevronUp, Loader2,
  User, Calendar, BarChart2, X, RefreshCw, Archive,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { getAuthHeaders } from "@/lib/auth";

interface ClientSummary {
  fromEmail: string;
  fromName: string | null;
  totalTickets: number;
  resolvedTickets: number;
  avgResolutionHours: number | null;
  firstTicketAt: string;
  lastTicketAt: string;
}

interface HistoryTicket {
  id: string;
  status: string;
  priority: string;
  reason: string;
  reasonDetails?: string;
  resolutionNotes?: string;
  aiClassification?: any;
  resolvedAt?: string;
  resolvedByName?: string;
  createdAt: string;
  resolutionHours?: number;
  subject?: string;
  fromEmail: string;
  fromName?: string;
  receivedAt?: string;
  emailId?: string;
}

const reasonLabels: Record<string, string> = {
  no_kb_answer: "KB senza risposta",
  high_urgency: "Alta urgenza",
  negative_sentiment: "Sentiment negativo",
  escalation_keyword: "Parola escalation",
  low_confidence: "Bassa confidenza",
  ai_low_confidence: "Bassa confidenza AI",
  manual: "Manuale",
};

const priorityLabels: Record<string, string> = {
  low: "Bassa", medium: "Media", high: "Alta", urgent: "Urgente",
};

function priorityBadgeClass(p: string) {
  return { urgent: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" }[p] ?? "bg-slate-100 text-slate-600";
}

function shortId(id: string) {
  return "#" + id.replace(/-/g, "").substring(0, 6);
}

function formatResolutionTime(hours: number | null | undefined): string {
  if (hours == null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}gg`;
}

function initials(name: string | null, email: string): string {
  if (name) return name.split(" ").map(p => p[0]).join("").toUpperCase().substring(0, 2);
  return email.substring(0, 2).toUpperCase();
}

function avatarColor(str: string): string {
  const colors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-amber-500"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function TicketRow({ ticket, expanded, onToggle }: { ticket: HistoryTicket; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="border-b last:border-b-0">
      <div
        onClick={onToggle}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
      >
        <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-16">{shortId(ticket.id)}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{ticket.subject || "(Nessun oggetto)"}</p>
        </div>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded shrink-0", priorityBadgeClass(ticket.priority))}>
          {priorityLabels[ticket.priority]}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 shrink-0">
          {reasonLabels[ticket.reason] || ticket.reason}
        </span>
        <span className="text-xs text-muted-foreground shrink-0 w-14 text-right">
          {ticket.resolutionHours != null ? formatResolutionTime(ticket.resolutionHours) : "—"}
        </span>
        <span className="text-xs text-muted-foreground shrink-0 w-28 text-right">
          {ticket.resolvedAt ? format(new Date(ticket.resolvedAt), "d MMM yyyy", { locale: it }) : "—"}
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </div>
      {expanded && (
        <div className="px-4 pb-4 bg-slate-50/50 dark:bg-slate-900/30 border-t space-y-3">
          {ticket.reasonDetails && (
            <div className="pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Motivo dettagliato</p>
              <p className="text-xs text-slate-700 dark:text-slate-300">{ticket.reasonDetails}</p>
            </div>
          )}
          {ticket.resolutionNotes && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Note di risoluzione</p>
              <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{ticket.resolutionNotes}</p>
            </div>
          )}
          {ticket.resolvedByName && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Risolto da</p>
              <p className="text-xs text-slate-700 dark:text-slate-300">{ticket.resolvedByName}</p>
            </div>
          )}
          <div className="flex gap-4 pt-1 text-[10px] text-muted-foreground">
            <span>Creato: {format(new Date(ticket.createdAt), "d MMM yyyy HH:mm", { locale: it })}</span>
            {ticket.resolvedAt && <span>Risolto: {format(new Date(ticket.resolvedAt), "d MMM yyyy HH:mm", { locale: it })}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function TicketsHistory() {
  const { toast } = useToast();
  const [view, setView] = useState<"clients" | "chronological">("clients");

  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summary, setSummary] = useState<ClientSummary[]>([]);
  const [summarySearch, setSummarySearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [clientTickets, setClientTickets] = useState<HistoryTicket[]>([]);
  const [clientTicketsLoading, setClientTicketsLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [chronoLoading, setChronoLoading] = useState(false);
  const [chronoTickets, setChronoTickets] = useState<HistoryTicket[]>([]);
  const [chronoTotal, setChronoTotal] = useState(0);
  const [chronoOffset, setChronoOffset] = useState(0);
  const [chronoSearch, setChronoSearch] = useState("");
  const [chronoExpandedIds, setChronoExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => { fetchSummary(); }, [dateFrom, dateTo]);
  useEffect(() => {
    if (view === "chronological") fetchChrono(0);
  }, [view, dateFrom, dateTo]);

  async function fetchSummary() {
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/email-hub/tickets/history/summary?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setSummary(data.data);
    } catch {
      toast({ title: "Errore", description: "Impossibile caricare lo storico", variant: "destructive" });
    } finally {
      setSummaryLoading(false);
    }
  }

  async function fetchClientTickets(email: string) {
    setClientTicketsLoading(true);
    setClientTickets([]);
    try {
      const params = new URLSearchParams({ fromEmail: email });
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/email-hub/tickets/history/detail?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setClientTickets(data.data);
    } catch { } finally {
      setClientTicketsLoading(false);
    }
  }

  async function fetchChrono(offset: number) {
    setChronoLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", offset: String(offset) });
      if (chronoSearch) params.set("search", chronoSearch);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const res = await fetch(`/api/email-hub/tickets/history/detail?${params}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        if (offset === 0) setChronoTickets(data.data);
        else setChronoTickets(prev => [...prev, ...data.data]);
        setChronoTotal(data.total);
        setChronoOffset(offset + data.data.length);
      }
    } catch { } finally {
      setChronoLoading(false);
    }
  }

  function handleClientSelect(email: string) {
    setSelectedClient(email);
    setExpandedIds(new Set());
    fetchClientTickets(email);
  }

  function toggleExpand(id: string, set: Set<string>, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  }

  const filteredSummary = summary.filter(c => {
    if (!summarySearch) return true;
    const q = summarySearch.toLowerCase();
    return c.fromEmail.toLowerCase().includes(q) || (c.fromName || "").toLowerCase().includes(q);
  });

  const totalClosed = summary.reduce((a, c) => a + c.totalTickets, 0);
  const avgRes = summary.length > 0
    ? summary.reduce((a, c) => a + (c.avgResolutionHours || 0), 0) / summary.filter(c => c.avgResolutionHours != null).length
    : null;
  const topClient = summary[0];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none px-6 pt-4 pb-3 border-b bg-white dark:bg-slate-950">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl border bg-white dark:bg-slate-900 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Ticket chiusi</span>
              <Archive className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{totalClosed}</div>
          </div>
          <div className="rounded-xl border bg-white dark:bg-slate-900 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Tempo medio risoluzione</span>
              <Clock className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">{formatResolutionTime(avgRes)}</div>
          </div>
          <div className="rounded-xl border bg-white dark:bg-slate-900 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Cliente più frequente</span>
              <BarChart2 className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
              {topClient ? (topClient.fromName || topClient.fromEmail) : "—"}
            </div>
            {topClient && <div className="text-xs text-muted-foreground">{topClient.totalTickets} ticket</div>}
          </div>
        </div>

        {/* Tabs + filters */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex rounded-lg border bg-slate-50 dark:bg-slate-900 p-0.5 gap-0.5">
            {(["clients", "chronological"] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", view === v ? "bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white" : "text-muted-foreground hover:text-foreground")}
              >
                {v === "clients" ? "Per cliente" : "Cronologico"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Dal</span>
            </div>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-7 text-xs w-36" />
            <span className="text-xs text-muted-foreground">al</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-7 text-xs w-36" />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {view === "clients" ? (
          <>
            {/* Client list */}
            <div className={cn("flex flex-col border-r overflow-hidden", selectedClient ? "w-[38%]" : "w-full max-w-xl mx-auto")}>
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Cerca cliente..."
                    value={summarySearch}
                    onChange={e => setSummarySearch(e.target.value)}
                    className="pl-8 h-7 text-xs"
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {summaryLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredSummary.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <Archive className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Nessuno storico</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {summarySearch ? "Nessun cliente trovato" : "I ticket risolti appariranno qui"}
                    </p>
                  </div>
                ) : filteredSummary.map(c => (
                  <div
                    key={c.fromEmail}
                    onClick={() => handleClientSelect(c.fromEmail)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 border-b cursor-pointer transition-colors",
                      selectedClient === c.fromEmail
                        ? "bg-blue-50 dark:bg-blue-950/30"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    )}
                  >
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0", avatarColor(c.fromEmail))}>
                      {initials(c.fromName, c.fromEmail)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {c.fromName || c.fromEmail}
                      </p>
                      {c.fromName && <p className="text-xs text-muted-foreground truncate">{c.fromEmail}</p>}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Ultimo: {formatDistanceToNow(new Date(c.lastTicketAt), { addSuffix: true, locale: it })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{c.totalTickets}</div>
                      <div className="text-[10px] text-muted-foreground">
                        ~{formatResolutionTime(c.avgResolutionHours)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Client detail */}
            {selectedClient ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {(() => {
                  const clientInfo = summary.find(c => c.fromEmail === selectedClient);
                  return (
                    <>
                      <div className="p-4 border-b bg-white dark:bg-slate-950 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0", avatarColor(selectedClient))}>
                            {initials(clientInfo?.fromName || null, selectedClient)}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">{clientInfo?.fromName || selectedClient}</h3>
                            {clientInfo?.fromName && <p className="text-xs text-muted-foreground">{selectedClient}</p>}
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span>{clientInfo?.totalTickets} ticket totali</span>
                              <span>{clientInfo?.resolvedTickets} risolti</span>
                              <span>Media ~{formatResolutionTime(clientInfo?.avgResolutionHours)}</span>
                            </div>
                          </div>
                        </div>
                        <button onClick={() => setSelectedClient(null)} className="text-muted-foreground hover:text-foreground mt-0.5">
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="overflow-y-auto flex-1">
                        {clientTicketsLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : clientTickets.length === 0 ? (
                          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                            Nessun ticket trovato
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-3 px-4 py-2 border-b bg-slate-50 dark:bg-slate-900 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              <span className="w-16">ID</span>
                              <span className="flex-1">Oggetto</span>
                              <span className="w-16">Priorità</span>
                              <span className="w-24">Motivo</span>
                              <span className="w-14 text-right">Tempo</span>
                              <span className="w-28 text-right">Risolto</span>
                              <span className="w-4" />
                            </div>
                            {clientTickets.map(ticket => (
                              <TicketRow
                                key={ticket.id}
                                ticket={ticket}
                                expanded={expandedIds.has(ticket.id)}
                                onToggle={() => toggleExpand(ticket.id, expandedIds, setExpandedIds)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <User className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="font-medium text-slate-600 dark:text-slate-400">Seleziona un cliente</p>
                <p className="text-sm text-muted-foreground mt-1">Clicca su un cliente per vedere la sua cronologia ticket</p>
              </div>
            )}
          </>
        ) : (
          /* Chronological view */
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-3 border-b flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cerca per oggetto, mittente..."
                  value={chronoSearch}
                  onChange={e => setChronoSearch(e.target.value)}
                  className="pl-8 h-7 text-xs"
                />
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fetchChrono(0)} disabled={chronoLoading}>
                <RefreshCw className={cn("h-3 w-3 mr-1", chronoLoading && "animate-spin")} />
                Aggiorna
              </Button>
              {chronoTotal > 0 && (
                <span className="text-xs text-muted-foreground">{chronoTotal} ticket totali</span>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {chronoLoading && chronoTickets.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : chronoTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Archive className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Nessun ticket nello storico</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 px-4 py-2 border-b bg-slate-50 dark:bg-slate-900 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sticky top-0 z-10">
                    <span className="w-16">ID</span>
                    <span className="w-36">Mittente</span>
                    <span className="flex-1">Oggetto</span>
                    <span className="w-16">Priorità</span>
                    <span className="w-24">Motivo</span>
                    <span className="w-14 text-right">Tempo</span>
                    <span className="w-28 text-right">Risolto</span>
                    <span className="w-4" />
                  </div>
                  {chronoTickets
                    .filter(t => {
                      if (!chronoSearch) return true;
                      const q = chronoSearch.toLowerCase();
                      return (t.subject || "").toLowerCase().includes(q) ||
                        (t.fromName || "").toLowerCase().includes(q) ||
                        t.fromEmail.toLowerCase().includes(q);
                    })
                    .map(ticket => (
                      <div key={ticket.id} className="border-b last:border-b-0">
                        <div
                          onClick={() => toggleExpand(ticket.id, chronoExpandedIds, setChronoExpandedIds)}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-16">{shortId(ticket.id)}</span>
                          <div className="w-36 min-w-0 shrink-0">
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{ticket.fromName || ticket.fromEmail}</p>
                            {ticket.fromName && <p className="text-[10px] text-muted-foreground truncate">{ticket.fromEmail}</p>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{ticket.subject || "(Nessun oggetto)"}</p>
                          </div>
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded shrink-0 w-16 text-center", priorityBadgeClass(ticket.priority))}>
                            {priorityLabels[ticket.priority]}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 shrink-0 w-24 text-center truncate">
                            {reasonLabels[ticket.reason] || ticket.reason}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0 w-14 text-right">
                            {formatResolutionTime(ticket.resolutionHours)}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0 w-28 text-right">
                            {ticket.resolvedAt ? format(new Date(ticket.resolvedAt), "d MMM yyyy", { locale: it }) : "—"}
                          </span>
                          {chronoExpandedIds.has(ticket.id) ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        </div>
                        {chronoExpandedIds.has(ticket.id) && (
                          <div className="px-4 pb-4 bg-slate-50/50 dark:bg-slate-900/30 border-t space-y-3">
                            {ticket.reasonDetails && (
                              <div className="pt-3">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Motivo dettagliato</p>
                                <p className="text-xs text-slate-700 dark:text-slate-300">{ticket.reasonDetails}</p>
                              </div>
                            )}
                            {ticket.resolutionNotes && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Note di risoluzione</p>
                                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{ticket.resolutionNotes}</p>
                              </div>
                            )}
                            {ticket.resolvedByName && (
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Risolto da</p>
                                <p className="text-xs text-slate-700 dark:text-slate-300">{ticket.resolvedByName}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  {chronoTickets.length < chronoTotal && (
                    <div className="p-4 flex justify-center">
                      <Button variant="outline" size="sm" onClick={() => fetchChrono(chronoOffset)} disabled={chronoLoading}>
                        {chronoLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                        Carica altri ({chronoTotal - chronoTickets.length} rimanenti)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
