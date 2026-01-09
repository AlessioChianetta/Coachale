import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  Send,
  FileText,
  Ticket,
  AlertCircle,
  Clock,
  Zap,
  TrendingUp,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface AIEvent {
  id: string;
  emailId: string;
  accountId: string;
  consultantId: string;
  eventType: string;
  classification?: {
    intent?: string;
    urgency?: string;
    sentiment?: string;
    category?: string;
    suggestedAction?: string;
    riskDetected?: boolean;
    escalationKeywords?: string[];
  };
  confidence?: number;
  confidenceThreshold?: number;
  decision?: string;
  decisionReason?: string;
  draftId?: string;
  ticketId?: string;
  modelUsed?: string;
  tokensUsed?: number;
  processingTimeMs?: number;
  knowledgeDocsUsed?: string[];
  emailSubject?: string;
  emailFrom?: string;
  createdAt: string;
}

interface AISummary {
  byEventType: Record<string, number>;
  averages: {
    confidence: number;
    processingTimeMs: number;
  };
  period: number;
}

const eventTypeLabels: Record<string, { label: string; icon: any; color: string }> = {
  classification: { label: "Classificazione", icon: Eye, color: "bg-slate-500" },
  draft_generated: { label: "Bozza generata", icon: FileText, color: "bg-blue-500" },
  auto_sent: { label: "Invio automatico", icon: Send, color: "bg-green-500" },
  held_for_review: { label: "In attesa di revisione", icon: Clock, color: "bg-amber-500" },
  ticket_created: { label: "Ticket creato", icon: Ticket, color: "bg-purple-500" },
  escalated: { label: "Escalation", icon: AlertTriangle, color: "bg-red-500" },
  skipped: { label: "Saltata", icon: CheckCircle, color: "bg-slate-400" },
  error: { label: "Errore", icon: AlertCircle, color: "bg-red-600" },
};

const decisionLabels: Record<string, string> = {
  auto_send: "Invio automatico",
  create_draft: "Bozza creata",
  needs_review: "Richiede revisione",
  create_ticket: "Ticket creato",
  escalate: "Escalation",
  skip: "Saltata",
  error: "Errore",
};

export function AIEventsPanel() {
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data: eventsData, isLoading: loadingEvents } = useQuery({
    queryKey: ["ai-events", eventTypeFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(page * limit));
      if (eventTypeFilter !== "all") {
        params.set("eventType", eventTypeFilter);
      }
      const res = await fetch(`/api/email-hub/ai-events?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore nel caricamento degli eventi");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ["ai-events-summary"],
    queryFn: async () => {
      const res = await fetch(`/api/email-hub/ai-events/summary?days=7`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore nel caricamento del riepilogo");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const events: AIEvent[] = eventsData?.data || [];
  const total = eventsData?.total || 0;
  const summary: AISummary = summaryData?.data;
  const totalPages = Math.ceil(total / limit);

  const getEventIcon = (eventType: string) => {
    const config = eventTypeLabels[eventType];
    if (!config) return <Zap className="h-4 w-4" />;
    const Icon = config.icon;
    return <Icon className="h-4 w-4" />;
  };

  const getEventBadge = (eventType: string) => {
    const config = eventTypeLabels[eventType];
    if (!config) return <Badge variant="secondary">{eventType}</Badge>;
    return (
      <Badge className={`${config.color} text-white`}>
        {config.label}
      </Badge>
    );
  };

  const formatConfidence = (confidence?: number) => {
    if (confidence === undefined || confidence === null) return "-";
    return `${(confidence * 100).toFixed(0)}%`;
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-400" />
            Cronologia AI
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Storico delle decisioni AI per le email elaborate
          </p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-green-400" />
                <span className="text-xs text-slate-400">Invii automatici</span>
              </div>
              <p className="text-2xl font-bold text-white mt-1">
                {summary.byEventType.auto_sent || 0}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-400" />
                <span className="text-xs text-slate-400">Bozze generate</span>
              </div>
              <p className="text-2xl font-bold text-white mt-1">
                {(summary.byEventType.draft_generated || 0) + (summary.byEventType.held_for_review || 0)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-violet-400" />
                <span className="text-xs text-slate-400">Confidenza media</span>
              </div>
              <p className="text-2xl font-bold text-white mt-1">
                {formatConfidence(summary.averages.confidence)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-400" />
                <span className="text-xs text-slate-400">Tempo medio</span>
              </div>
              <p className="text-2xl font-bold text-white mt-1">
                {summary.averages.processingTimeMs 
                  ? `${(summary.averages.processingTimeMs / 1000).toFixed(1)}s` 
                  : "-"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm text-slate-400">Filtra:</span>
        </div>
        <Select value={eventTypeFilter} onValueChange={(v) => { setEventTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-48 bg-slate-800 border-slate-600">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli eventi</SelectItem>
            <SelectItem value="auto_sent">Invii automatici</SelectItem>
            <SelectItem value="draft_generated">Bozze generate</SelectItem>
            <SelectItem value="held_for_review">In attesa revisione</SelectItem>
            <SelectItem value="escalated">Escalation</SelectItem>
            <SelectItem value="ticket_created">Ticket creati</SelectItem>
            <SelectItem value="error">Errori</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-500 ml-auto">
          {total} eventi totali
        </span>
      </div>

      <Card className="flex-1 bg-slate-800/50 border-slate-700 overflow-hidden">
        <ScrollArea className="h-full">
          {loadingEvents ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400">
              <Zap className="h-8 w-8 mb-2 opacity-50" />
              <p>Nessun evento AI registrato</p>
              <p className="text-xs mt-1">Gli eventi appariranno quando l'AI elaborerà delle email</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {events.map((event) => (
                <div key={event.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg ${eventTypeLabels[event.eventType]?.color || 'bg-slate-600'} text-white shrink-0`}>
                        {getEventIcon(event.eventType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getEventBadge(event.eventType)}
                          {event.decision && (
                            <span className="text-xs text-slate-400">
                              → {decisionLabels[event.decision] || event.decision}
                            </span>
                          )}
                        </div>
                        
                        {event.emailSubject && (
                          <p className="text-sm font-medium text-white mt-1 truncate">
                            {event.emailSubject}
                          </p>
                        )}
                        
                        {event.emailFrom && (
                          <p className="text-xs text-slate-400 truncate">
                            Da: {event.emailFrom}
                          </p>
                        )}
                        
                        {event.decisionReason && (
                          <p className="text-xs text-slate-300 mt-2 bg-slate-700/50 p-2 rounded">
                            {event.decisionReason}
                          </p>
                        )}

                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                          {event.confidence !== undefined && (
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Confidenza: {formatConfidence(event.confidence)}
                              {event.confidenceThreshold && (
                                <span className="text-slate-600">
                                  (soglia: {formatConfidence(event.confidenceThreshold)})
                                </span>
                              )}
                            </span>
                          )}
                          
                          {event.classification?.urgency && (
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                event.classification.urgency === 'high' 
                                  ? 'border-red-500 text-red-400' 
                                  : event.classification.urgency === 'medium' 
                                    ? 'border-amber-500 text-amber-400'
                                    : 'border-slate-500 text-slate-400'
                              }`}
                            >
                              {event.classification.urgency === 'high' ? 'Alta' : event.classification.urgency === 'medium' ? 'Media' : 'Bassa'}
                            </Badge>
                          )}

                          {event.processingTimeMs && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {(event.processingTimeMs / 1000).toFixed(1)}s
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-slate-500 shrink-0">
                      {format(new Date(event.createdAt), "dd MMM HH:mm", { locale: it })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="border-slate-600"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Precedente
          </Button>
          <span className="text-sm text-slate-400">
            Pagina {page + 1} di {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="border-slate-600"
          >
            Successivo
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}