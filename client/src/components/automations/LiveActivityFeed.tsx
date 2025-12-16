import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Activity,
  User,
  ChevronDown,
  ChevronUp,
  Send,
  XCircle,
  Clock,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  ExternalLink,
  RefreshCw,
  Brain
} from "lucide-react";
import { Link } from "wouter";

interface TimelineEvent {
  id: string;
  type: string;
  conversationId: string;
  leadName: string;
  agentName: string;
  timestamp: string;
  decision?: string;
  reasoning?: string;
  confidenceScore?: number;
  matchedRuleId?: string;
  matchedRuleReason?: string;
  currentState?: string;
  status: string;
  errorMessage?: string;
}

interface ConversationTimeline {
  conversationId: string;
  leadName: string;
  agentName: string;
  currentStatus: string;
  events: TimelineEvent[];
}

interface ActivityLogResponse {
  timeline: ConversationTimeline[];
  allEvents: TimelineEvent[];
  total: number;
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'active':
      return { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Attivo' };
    case 'stopped':
      return { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Stop' };
    case 'waiting':
      return { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'In Attesa' };
    case 'error':
      return { color: 'bg-orange-100 text-orange-700', icon: AlertTriangle, label: 'Errore' };
    case 'scheduled':
      return { color: 'bg-blue-100 text-blue-700', icon: Clock, label: 'Programmato' };
    default:
      return { color: 'bg-gray-100 text-gray-700', icon: Activity, label: status };
  }
}

function getEventIcon(type: string) {
  switch (type) {
    case 'message_sent':
      return <Send className="h-4 w-4 text-green-600" />;
    case 'message_failed':
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case 'message_scheduled':
      return <Clock className="h-4 w-4 text-blue-600" />;
    case 'ai_evaluation':
      return <Brain className="h-4 w-4 text-purple-600" />;
    default:
      return <Activity className="h-4 w-4 text-gray-600" />;
  }
}

function getEventLabel(type: string, decision?: string) {
  switch (type) {
    case 'message_sent':
      return 'Messaggio INVIATO';
    case 'message_failed':
      return 'Messaggio FALLITO';
    case 'message_scheduled':
      return 'Messaggio programmato';
    case 'message_cancelled':
      return 'Messaggio annullato';
    case 'ai_evaluation':
      if (decision === 'stop') return 'Valutazione AI: STOP';
      if (decision === 'skip') return 'Valutazione AI: ATTENDI';
      if (decision === 'send_now') return 'Valutazione AI: INVIA';
      return 'Valutazione AI';
    default:
      return type;
  }
}

function ConversationCard({ conversation }: { conversation: ConversationTimeline }) {
  const [isOpen, setIsOpen] = useState(false);
  const statusConfig = getStatusConfig(conversation.currentStatus);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-full">
                  <User className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {conversation.leadName}
                    <Badge variant="outline" className="text-xs font-normal">
                      via {conversation.agentName}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {conversation.events.length} eventi recenti
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${statusConfig.color} flex items-center gap-1`}>
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig.label}
                </Badge>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="border-l-2 border-gray-200 dark:border-gray-700 ml-4 pl-4 space-y-3">
              {conversation.events.slice(0, 10).map((event) => (
                <div key={event.id} className="relative">
                  <div className="absolute -left-[21px] w-3 h-3 rounded-full bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600" />
                  
                  <div className="flex items-start gap-2">
                    {getEventIcon(event.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {getEventLabel(event.type, event.decision)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.timestamp), "dd MMM HH:mm", { locale: it })}
                        </span>
                      </div>
                      
                      {event.matchedRuleId && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                          Regola: {event.matchedRuleId}
                          {event.matchedRuleReason && ` - ${event.matchedRuleReason}`}
                        </p>
                      )}
                      
                      {event.reasoning && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {event.reasoning}
                        </p>
                      )}
                      
                      {event.errorMessage && (
                        <p className="text-xs text-red-600 mt-0.5">
                          Errore: {event.errorMessage}
                        </p>
                      )}

                      {event.confidenceScore !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          Confidenza: {Math.round(event.confidenceScore * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-4 pt-3 border-t">
              <Link href={`/consultant/whatsapp?conversation=${conversation.conversationId}`}>
                <Button variant="outline" size="sm" className="gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Vedi Chat
                </Button>
              </Link>
              {conversation.currentStatus === 'error' && (
                <Button variant="outline" size="sm" className="gap-1 text-orange-600 border-orange-300">
                  <AlertTriangle className="h-3 w-3" />
                  Risolvi
                </Button>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function LiveActivityFeed() {
  const [filter, setFilter] = useState<string>('all');

  const { data, isLoading, error, refetch, isFetching } = useQuery<ActivityLogResponse>({
    queryKey: ["activity-log", filter],
    queryFn: async () => {
      const response = await fetch(`/api/followup/activity-log?filter=${filter}&limit=50`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch activity log");
      return response.json();
    },
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all" className="text-xs">Tutti</TabsTrigger>
            <TabsTrigger value="sent" className="text-xs">Inviati</TabsTrigger>
            <TabsTrigger value="scheduled" className="text-xs">Programmati</TabsTrigger>
            <TabsTrigger value="stopped" className="text-xs">Bloccati</TabsTrigger>
            <TabsTrigger value="errors" className="text-xs">Errori</TabsTrigger>
          </TabsList>
        </Tabs>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1"
        >
          <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          Aggiorna
        </Button>
      </div>

      {isLoading && <LoadingSkeleton />}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-center text-red-600">
            Errore nel caricamento del log attività
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && data?.timeline?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Nessuna attività trovata. Le attività appariranno quando il sistema valuterà le conversazioni.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && data?.timeline && data.timeline.length > 0 && (
        <div className="space-y-3">
          {data.timeline.map((conversation) => (
            <ConversationCard key={conversation.conversationId} conversation={conversation} />
          ))}
        </div>
      )}

      {data?.total && data.total > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          Mostrando {data.timeline?.length || 0} conversazioni ({data.total} eventi totali)
        </p>
      )}
    </div>
  );
}
