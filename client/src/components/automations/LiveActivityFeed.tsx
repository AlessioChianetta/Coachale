import { useState, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  RefreshCw,
  Brain,
  Loader2,
  Zap,
  Search,
  Calendar,
  Filter,
} from "lucide-react";
import { Link } from "wouter";
import { useSendMessageNow, useFollowupAgents, useActivityLog, usePendingQueue, type ActivityLogFilters, type PendingQueueItem } from "@/hooks/useFollowupApi";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TimelineEvent {
  id: string;
  type: string;
  conversationId: string;
  leadName: string;
  agentName: string;
  agentId?: string;
  timestamp: string;
  decision?: string;
  reasoning?: string;
  confidenceScore?: number;
  matchedRuleId?: string;
  matchedRuleReason?: string;
  currentState?: string;
  status: string;
  errorMessage?: string;
  window24hExpiresAt?: string;
  canSendFreeform?: boolean;
  templateId?: string;
  templateName?: string;
  templateTwilioStatus?: 'not_synced' | 'pending' | 'approved' | 'rejected' | null;
  messagePreview?: string;
  aiSelectedTemplateReasoning?: string;
  temperatureLevel?: 'hot' | 'warm' | 'cold' | 'ghost';
}

interface ConversationTimeline {
  conversationId: string;
  leadName: string;
  leadPhone?: string;
  agentName: string;
  agentId?: string;
  currentStatus: string;
  temperatureLevel?: 'hot' | 'warm' | 'cold' | 'ghost';
  currentState?: string;
  window24hExpiresAt?: string;
  events: TimelineEvent[];
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'active':
      return { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Attivo' };
    case 'stopped':
      return { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Stop' };
    case 'waiting':
      return { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Attesa' };
    case 'error':
      return { color: 'bg-orange-100 text-orange-700', icon: AlertTriangle, label: 'Errore' };
    case 'scheduled':
      return { color: 'bg-blue-100 text-blue-700', icon: Clock, label: 'Prog.' };
    default:
      return { color: 'bg-gray-100 text-gray-700', icon: Activity, label: status };
  }
}

function getTemperatureEmoji(temperature?: string) {
  switch (temperature) {
    case 'hot': return '🔥';
    case 'warm': return '🟡';
    case 'cold': return '❄️';
    case 'ghost': return '👻';
    default: return '🟡';
  }
}

function formatCountdown(expiresAt?: string): { text: string; isExpired: boolean; isUrgent: boolean } | null {
  if (!expiresAt) return null;
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();
  if (diffMs <= 0) return { text: 'Scad.', isExpired: true, isUrgent: false };
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const isUrgent = hours < 2;
  if (hours > 0) return { text: `${hours}h`, isExpired: false, isUrgent };
  return { text: `${minutes}m`, isExpired: false, isUrgent };
}

function getEventLabel(type: string, decision?: string): string {
  switch (type) {
    case 'message_sent': return 'Inviato';
    case 'message_failed': return 'Fallito';
    case 'message_scheduled': return 'Programmato';
    case 'message_cancelled': return 'Annullato';
    case 'ai_evaluation':
      if (decision === 'stop') return 'AI: Stop';
      if (decision === 'skip') return 'AI: Attendi';
      if (decision === 'send_now') return 'AI: Invia';
      return 'AI Eval';
    default: return type;
  }
}

function getEventIcon(type: string) {
  switch (type) {
    case 'message_sent': return <Send className="h-3 w-3 text-green-600" />;
    case 'message_failed': return <AlertTriangle className="h-3 w-3 text-red-600" />;
    case 'message_scheduled': return <Clock className="h-3 w-3 text-blue-600" />;
    case 'ai_evaluation': return <Brain className="h-3 w-3 text-purple-600" />;
    default: return <Activity className="h-3 w-3 text-gray-600" />;
  }
}

function SendNowButton({ messageId, canSendFreeform, hasApprovedTemplate }: {
  messageId: string;
  canSendFreeform?: boolean;
  hasApprovedTemplate?: boolean;
}) {
  const { toast } = useToast();
  const sendNow = useSendMessageNow();
  const canSend = canSendFreeform || hasApprovedTemplate;

  const handleSendNow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canSend) return;
    try {
      const result = await sendNow.mutateAsync(messageId);
      toast({ title: "Inviato", description: result.message || "Messaggio inviato!" });
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSendNow}
      disabled={sendNow.isPending || !canSend}
      className={`h-6 px-2 text-xs ${!canSend ? 'opacity-50' : 'text-blue-600 hover:bg-blue-50'}`}
    >
      {sendNow.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
    </Button>
  );
}

function RetryButton({ messageId }: { messageId: string }) {
  const { toast } = useToast();
  const [isRetrying, setIsRetrying] = useState(false);
  const queryClient = useQueryClient();

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRetrying(true);
    try {
      const response = await fetch(`/api/followup/messages/${messageId}/retry`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: "Riprogrammato", description: "Ritentativo schedulato" });
        queryClient.invalidateQueries({ queryKey: ['activity-log'] });
      } else throw new Error(result.message);
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleRetry} disabled={isRetrying} className="h-6 px-2 text-xs text-orange-600 hover:bg-orange-50">
      {isRetrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
    </Button>
  );
}

function SimulateAiButton({ conversationId }: { conversationId: string }) {
  const { toast } = useToast();
  const [isSimulating, setIsSimulating] = useState(false);
  const queryClient = useQueryClient();

  const handleSimulate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSimulating(true);
    try {
      const response = await fetch(`/api/followup/conversations/${conversationId}/simulate-ai-followup`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: `📤 ${result.message}`, description: result.messagePreview ? `"${result.messagePreview}..."` : undefined });
        queryClient.invalidateQueries({ queryKey: ['activity-log'] });
        queryClient.invalidateQueries({ queryKey: ['followup-conversations'] });
      } else throw new Error(result.message);
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleSimulate} disabled={isSimulating} className="h-6 px-2 text-xs text-purple-600 hover:bg-purple-50">
      {isSimulating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
    </Button>
  );
}

function PendingQueuePanel() {
  const { data, isLoading, error } = usePendingQueue();

  if (isLoading) return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" /> Prossimi Controlli
        </CardTitle>
      </CardHeader>
      <CardContent><div className="animate-pulse h-4 bg-muted rounded w-3/4"></div></CardContent>
    </Card>
  );

  if (error || !data || data.agents.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" /> Prossimi Controlli
          <Badge variant="secondary" className="ml-auto">{data.totalPending} attivi</Badge>
          {data.totalDormant > 0 && <Badge variant="outline" className="text-orange-600">{data.totalDormant} pausa</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.agents.slice(0, 3).map((agent) => (
          <div key={agent.agentId} className="text-xs">
            <span className="font-medium">{agent.agentName}</span>
            <span className="text-muted-foreground ml-2">({agent.pending.length} lead)</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ActivityTableRow({ conversation }: { conversation: ConversationTimeline }) {
  const [isOpen, setIsOpen] = useState(false);
  const statusConfig = getStatusConfig(conversation.currentStatus);
  const countdown = formatCountdown(conversation.window24hExpiresAt);
  const latestEvent = conversation.events[0];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell className="py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">{getTemperatureEmoji(conversation.temperatureLevel)}</span>
              <div className="min-w-0">
                <div className="font-medium text-sm truncate max-w-[150px]">{conversation.leadName}</div>
                {conversation.leadPhone && (
                  <div className="text-xs text-muted-foreground truncate">{conversation.leadPhone}</div>
                )}
              </div>
            </div>
          </TableCell>
          <TableCell className="py-2">
            <div className="flex items-center gap-1">
              {latestEvent && getEventIcon(latestEvent.type)}
              <span className="text-xs">{latestEvent ? getEventLabel(latestEvent.type, latestEvent.decision) : '-'}</span>
            </div>
          </TableCell>
          <TableCell className="py-2">
            <div className="flex items-center gap-1">
              <Badge className={`${statusConfig.color} text-[10px] px-1.5 py-0`}>
                {statusConfig.label}
              </Badge>
              {countdown && (
                <span className={`text-[10px] px-1 py-0.5 rounded ${
                  countdown.isExpired ? 'bg-red-100 text-red-700' : countdown.isUrgent ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                }`}>
                  {countdown.text}
                </span>
              )}
            </div>
          </TableCell>
          <TableCell className="py-2 text-xs text-muted-foreground">
            {latestEvent ? format(new Date(latestEvent.timestamp), "dd/MM HH:mm", { locale: it }) : '-'}
          </TableCell>
          <TableCell className="py-2 w-8">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <TableRow className="bg-muted/30">
          <TableCell colSpan={5} className="py-3">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground mb-2">
                via <span className="font-medium">{conversation.agentName}</span> • {conversation.events.length} eventi
              </div>
              
              {conversation.events.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-start gap-2 text-xs p-2 bg-background rounded border">
                  {getEventIcon(event.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{getEventLabel(event.type, event.decision)}</span>
                      <span className="text-muted-foreground">{format(new Date(event.timestamp), "dd MMM HH:mm", { locale: it })}</span>
                      {event.confidenceScore !== undefined && (
                        <span className="text-muted-foreground">({Math.round(event.confidenceScore * 100)}%)</span>
                      )}
                    </div>
                    {event.reasoning && (
                      <p className="text-muted-foreground mt-1 line-clamp-2">{event.reasoning}</p>
                    )}
                    {event.messagePreview && (
                      <p className="text-muted-foreground mt-1 italic line-clamp-1">"{event.messagePreview}"</p>
                    )}
                    {event.errorMessage && (
                      <p className="text-red-600 mt-1">Errore: {event.errorMessage}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {event.type === 'message_scheduled' && event.status === 'scheduled' && (
                      <SendNowButton
                        messageId={event.id.replace('msg-', '')}
                        canSendFreeform={event.canSendFreeform}
                        hasApprovedTemplate={event.templateTwilioStatus === 'approved'}
                      />
                    )}
                    {event.type === 'message_failed' && (
                      <RetryButton messageId={event.id.replace('msg-', '')} />
                    )}
                  </div>
                </div>
              ))}
              
              <div className="flex gap-2 pt-2 border-t">
                <Link href={`/consultant/whatsapp-conversations?conversation=${conversation.conversationId}`}>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                    <MessageSquare className="h-3 w-3" /> Chat
                  </Button>
                </Link>
                <SimulateAiButton conversationId={conversation.conversationId} />
              </div>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 p-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function LiveActivityFeed() {
  const [filter, setFilter] = useState<string>('all');
  const [agentId, setAgentId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);

  const filters: ActivityLogFilters = useMemo(() => ({
    filter: filter !== 'all' ? filter : undefined,
    agentId: agentId || undefined,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [filter, agentId, search, dateFrom, dateTo]);

  const { data, isLoading, error, refetch, isFetching } = useActivityLog(filters);
  const { data: agents } = useFollowupAgents();

  const clearAllFilters = () => {
    setFilter('all');
    setAgentId('');
    setSearch('');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = agentId || search || dateFrom || dateTo;
  const visibleTimeline = data?.timeline?.slice(0, visibleCount) || [];
  const hasMore = (data?.timeline?.length || 0) > visibleCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all" className="text-xs">Tutti</TabsTrigger>
            <TabsTrigger value="sent" className="text-xs">Inviati</TabsTrigger>
            <TabsTrigger value="scheduled" className="text-xs">Prog.</TabsTrigger>
            <TabsTrigger value="stopped" className="text-xs">Stop</TabsTrigger>
            <TabsTrigger value="errors" className="text-xs">Errori</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant={showAdvancedFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="gap-1"
          >
            <Filter className="h-3 w-3" />
            Filtri
            {hasActiveFilters && <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-[10px] rounded-full">!</Badge>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1">
            <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {showAdvancedFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Search className="h-3 w-3" /> Cerca
              </label>
              <Input placeholder="Nome o telefono..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Agente
              </label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Tutti" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tutti</SelectItem>
                  {agents?.map((agent: { id: string; agentName: string }) => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.agentName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Da
              </label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> A
              </label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-3 pt-3 border-t flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs">Rimuovi filtri</Button>
            </div>
          )}
        </Card>
      )}

      {isLoading && <LoadingSkeleton />}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-center text-red-600">Errore nel caricamento</CardContent>
        </Card>
      )}

      {!isLoading && !error && data?.timeline?.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Activity className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">
              {hasActiveFilters ? "Nessuna attività con questi filtri." : "Nessuna attività. Le attività appariranno con le valutazioni AI."}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && visibleTimeline.length > 0 && (
        <>
          <PendingQueuePanel />
          
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Lead</TableHead>
                  <TableHead className="text-xs">Azione</TableHead>
                  <TableHead className="text-xs">Stato</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTimeline.map((conversation: ConversationTimeline) => (
                  <ActivityTableRow key={conversation.conversationId} conversation={conversation} />
                ))}
              </TableBody>
            </Table>
          </Card>

          {hasMore && (
            <div className="text-center">
              <Button variant="outline" size="sm" onClick={() => setVisibleCount(prev => prev + 20)}>
                Carica altri ({(data?.timeline?.length || 0) - visibleCount} rimanenti)
              </Button>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            {visibleTimeline.length} di {data?.timeline?.length || 0} conversazioni ({data?.total || 0} eventi)
          </p>
        </>
      )}
    </div>
  );
}
