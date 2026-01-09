import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Ticket, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  RefreshCw,
  MessageSquare,
  Mail
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface EmailTicket {
  ticket: {
    id: string;
    status: "open" | "in_progress" | "resolved" | "closed";
    priority: "low" | "medium" | "high" | "urgent";
    reason: string;
    reasonDetails?: string;
    suggestedResponse?: string;
    createdAt: string;
  };
  email: {
    subject?: string;
    fromEmail: string;
    fromName?: string;
    snippet?: string;
    receivedAt?: string;
  };
}

const statusLabels: Record<string, string> = {
  open: "Aperto",
  in_progress: "In lavorazione",
  resolved: "Risolto",
  closed: "Chiuso",
};

const statusColors: Record<string, string> = {
  open: "bg-yellow-500",
  in_progress: "bg-blue-500",
  resolved: "bg-green-500",
  closed: "bg-gray-500",
};

const priorityLabels: Record<string, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-400",
  medium: "bg-blue-400",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

const reasonLabels: Record<string, string> = {
  no_kb_answer: "KB senza risposta",
  high_urgency: "Alta urgenza",
  negative_sentiment: "Sentiment negativo",
  escalation_keyword: "Parola escalation",
  low_confidence: "Bassa confidenza",
  manual: "Creazione manuale",
};

interface TicketsListProps {
  onSelectEmail?: (emailId: string) => void;
}

export function TicketsList({ onSelectEmail }: TicketsListProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<EmailTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  async function fetchTickets() {
    setLoading(true);
    try {
      const res = await fetch("/api/email-hub/tickets", { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setTickets(data.data);
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i ticket",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function updateTicketStatus(ticketId: string, newStatus: string) {
    setUpdatingId(ticketId);
    try {
      const res = await fetch(`/api/email-hub/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setTickets(tickets.map(t => 
          t.ticket.id === ticketId 
            ? { ...t, ticket: { ...t.ticket, status: newStatus as any } }
            : t
        ));
        toast({
          title: "Stato aggiornato",
          description: `Ticket spostato in "${statusLabels[newStatus]}"`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiornare il ticket",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredTickets = statusFilter === "all" 
    ? tickets 
    : tickets.filter(t => t.ticket.status === statusFilter);

  const openCount = tickets.filter(t => t.ticket.status === "open").length;
  const inProgressCount = tickets.filter(t => t.ticket.status === "in_progress").length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="font-medium flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Ticket ({tickets.length})
          </h3>
          {openCount > 0 && (
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              {openCount} aperti
            </Badge>
          )}
          {inProgressCount > 0 && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {inProgressCount} in lavorazione
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filtra stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="open">Aperti</SelectItem>
              <SelectItem value="in_progress">In lavorazione</SelectItem>
              <SelectItem value="resolved">Risolti</SelectItem>
              <SelectItem value="closed">Chiusi</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchTickets}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Ticket className="h-12 w-12 text-muted-foreground mb-4" />
            <h4 className="font-medium text-lg">Nessun ticket</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {statusFilter === "all" 
                ? "Non ci sono ticket da mostrare"
                : `Non ci sono ticket con stato "${statusLabels[statusFilter]}"`
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-3 pr-4">
            {filteredTickets.map((item) => (
              <Card key={item.ticket.id} className="hover:bg-muted/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={priorityColors[item.ticket.priority]}>
                          {priorityLabels[item.ticket.priority]}
                        </Badge>
                        <Badge variant="outline" className={`${statusColors[item.ticket.status]} text-white`}>
                          {statusLabels[item.ticket.status]}
                        </Badge>
                        <Badge variant="secondary">
                          {reasonLabels[item.ticket.reason] || item.ticket.reason}
                        </Badge>
                      </div>

                      <h4 className="font-medium truncate mb-1">
                        {item.email.subject || "(Nessun oggetto)"}
                      </h4>
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">
                          {item.email.fromName || item.email.fromEmail}
                        </span>
                        <span className="text-muted-foreground/60">·</span>
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(item.ticket.createdAt), { 
                            addSuffix: true, 
                            locale: it 
                          })}
                        </span>
                      </div>

                      {item.email.snippet && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.email.snippet}
                        </p>
                      )}

                      {item.ticket.reasonDetails && (
                        <p className="text-sm text-orange-600 mt-2">
                          {item.ticket.reasonDetails}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {item.ticket.status === "open" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          disabled={updatingId === item.ticket.id}
                          onClick={() => updateTicketStatus(item.ticket.id, "in_progress")}
                        >
                          {updatingId === item.ticket.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Prendi
                            </>
                          )}
                        </Button>
                      )}
                      {item.ticket.status === "in_progress" && (
                        <Button 
                          size="sm"
                          disabled={updatingId === item.ticket.id}
                          onClick={() => updateTicketStatus(item.ticket.id, "resolved")}
                        >
                          {updatingId === item.ticket.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Risolvi
                            </>
                          )}
                        </Button>
                      )}
                      {(item.ticket.status === "resolved" || item.ticket.status === "closed") && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          disabled={updatingId === item.ticket.id}
                          onClick={() => updateTicketStatus(item.ticket.id, "open")}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Riapri
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
