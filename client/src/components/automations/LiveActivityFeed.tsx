import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  Activity,
  User,
  ChevronLeft,
  ChevronRight,
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
  FileText,
  RotateCcw,
} from "lucide-react";
import { Link } from "wouter";
import { useSendMessageNow, useFollowupAgents, useActivityLog, usePendingQueue, type ActivityLogFilters } from "@/hooks/useFollowupApi";
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
  consecutiveNoReplyCount?: number;
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
    case 'message_sent': return <Send className="h-4 w-4 text-green-600" />;
    case 'message_failed': return <AlertTriangle className="h-4 w-4 text-red-600" />;
    case 'message_scheduled': return <Clock className="h-4 w-4 text-blue-600" />;
    case 'ai_evaluation': return <Brain className="h-4 w-4 text-purple-600" />;
    default: return <Activity className="h-4 w-4 text-gray-600" />;
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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSendNow}
            disabled={sendNow.isPending || !canSend}
            className={`h-7 px-2 text-xs ${canSend ? 'text-green-600 hover:bg-green-50' : 'text-gray-400'}`}
          >
            {sendNow.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            <span className="ml-1">Invia ora</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {!canSend ? "Fuori finestra 24h e template non approvato" :
              canSendFreeform ? "Finestra 24h attiva" : "Template approvato"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function RetryButton({ messageId }: { messageId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/followup/messages/${messageId}/retry`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Errore');
      toast({ title: "Ritentato", description: "Messaggio reinviato!" });
      queryClient.invalidateQueries({ queryKey: ['/api/followup/activity-log'] });
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleRetry} disabled={isRetrying} className="h-7 px-2 text-xs text-orange-600 hover:bg-orange-50">
      {isRetrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
      <span className="ml-1">Riprova</span>
    </Button>
  );
}

function SimulateAiButton({ conversationId }: { conversationId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSimulating(true);
    try {
      const res = await fetch(`/api/followup/simulate-ai/${conversationId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Errore');
      const data = await res.json();
      toast({
        title: `AI: ${data.decision}`,
        description: data.reasoning?.substring(0, 100) + (data.reasoning?.length > 100 ? '...' : ''),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/followup/activity-log'] });
    } catch (error: any) {
      toast({ title: "Errore simulazione", description: error.message, variant: "destructive" });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleSimulate} disabled={isSimulating} className="h-7 px-2 text-xs text-purple-600 hover:bg-purple-50">
      {isSimulating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
      <span className="ml-1">Simula AI</span>
    </Button>
  );
}

function PendingQueuePanel() {
  const { data, isLoading, error } = usePendingQueue();

  if (isLoading) return (
    <div className="p-3 border-b">
      <div className="animate-pulse h-4 bg-muted rounded w-3/4"></div>
    </div>
  );

  if (error || !data || data.agents.length === 0) return null;

  return (
    <div className="p-3 border-b bg-muted/30">
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Prossimi Controlli</span>
        <Badge variant="secondary" className="ml-auto">{data.totalPending} attivi</Badge>
        {data.totalDormant > 0 && <Badge variant="outline" className="text-orange-600">{data.totalDormant} pausa</Badge>}
      </div>
    </div>
  );
}

function LeadListItem({ 
  conversation, 
  isSelected, 
  onSelect 
}: { 
  conversation: ConversationTimeline; 
  isSelected: boolean;
  onSelect: () => void;
}) {
  const statusConfig = getStatusConfig(conversation.currentStatus);
  const countdown = formatCountdown(conversation.window24hExpiresAt);
  const noReplyCount = conversation.consecutiveNoReplyCount || 0;
  const latestEvent = conversation.events[0];

  return (
    <div
      onClick={onSelect}
      className={`p-3 border-b cursor-pointer transition-colors ${
        isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/50'
      }`}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg">{getTemperatureEmoji(conversation.temperatureLevel)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm truncate">{conversation.leadName}</span>
            {noReplyCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                noReplyCount >= 3 ? 'bg-red-100 text-red-700' : noReplyCount >= 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {noReplyCount}/3
              </span>
            )}
          </div>
          {conversation.leadPhone && (
            <div className="text-xs text-muted-foreground truncate">{conversation.leadPhone}</div>
          )}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
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
            {latestEvent?.templateId && (
              <span className={`text-[9px] px-1 py-0.5 rounded ${
                latestEvent.templateTwilioStatus === 'approved' ? 'bg-green-50 text-green-700 border border-green-200' :
                latestEvent.templateTwilioStatus === 'pending' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                'bg-gray-50 text-gray-600 border border-gray-200'
              }`}>
                TPL
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {latestEvent && format(new Date(latestEvent.timestamp), "dd/MM", { locale: it })}
          <div>{latestEvent && format(new Date(latestEvent.timestamp), "HH:mm", { locale: it })}</div>
        </div>
      </div>
    </div>
  );
}

function EventDetailCard({ event, isLast }: { event: TimelineEvent; isLast?: boolean }) {
  const statusConfig = getStatusConfig(event.status);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getEventColor = (type: string) => {
    switch (type) {
      case 'message_sent': return 'border-green-400 bg-green-50';
      case 'message_failed': return 'border-red-400 bg-red-50';
      case 'message_scheduled': return 'border-blue-400 bg-blue-50';
      case 'message_cancelled': return 'border-gray-400 bg-gray-50';
      case 'ai_evaluation': return 'border-purple-400 bg-purple-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  const hasExpandableContent = event.reasoning || event.aiSelectedTemplateReasoning || event.messagePreview;

  return (
    <div className="relative pl-6">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
      )}
      
      {/* Timeline dot */}
      <div className={`absolute left-0 top-2 w-6 h-6 rounded-full flex items-center justify-center border-2 bg-background ${
        event.type === 'message_sent' ? 'border-green-500' :
        event.type === 'message_failed' ? 'border-red-500' :
        event.type === 'message_scheduled' ? 'border-blue-500' :
        event.type === 'ai_evaluation' ? 'border-purple-500' :
        'border-gray-400'
      }`}>
        {getEventIcon(event.type)}
      </div>

      <div className={`ml-4 mb-4 rounded-lg border-l-3 p-3 ${getEventColor(event.type)}`}>
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{getEventLabel(event.type, event.decision)}</span>
            <Badge className={`${statusConfig.color} text-[10px] px-1.5 py-0`}>
              {statusConfig.label}
            </Badge>
            {event.confidenceScore !== undefined && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-white/50">
                {Math.round(event.confidenceScore * 100)}%
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(event.timestamp), "dd MMM HH:mm", { locale: it })}
          </span>
        </div>

        {/* Template info - compact */}
        {event.templateId && (
          <div className="flex items-center gap-2 text-xs mb-2 bg-white/50 rounded px-2 py-1">
            <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{event.templateName || event.templateId}</span>
            <Badge className={`text-[9px] px-1 py-0 flex-shrink-0 ${
              event.templateTwilioStatus === 'approved' ? 'bg-green-100 text-green-700' :
              event.templateTwilioStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
              event.templateTwilioStatus === 'rejected' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {event.templateTwilioStatus === 'approved' ? 'OK' :
               event.templateTwilioStatus === 'pending' ? 'Attesa' :
               event.templateTwilioStatus === 'rejected' ? 'No' : '?'}
            </Badge>
          </div>
        )}

        {/* Freeform indicator */}
        {!event.templateId && event.canSendFreeform && (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] mb-2">
            <Brain className="h-2.5 w-2.5" />
            Finestra 24h attiva
          </div>
        )}

        {/* Error message - always visible */}
        {event.errorMessage && (
          <div className="text-xs bg-red-100 text-red-700 p-2 rounded mb-2">
            <strong>Errore:</strong> {event.errorMessage}
          </div>
        )}

        {/* Expandable content */}
        {hasExpandableContent && (
          <>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-primary hover:underline flex items-center gap-1 mb-1"
            >
              {isExpanded ? (
                <>
                  <ChevronLeft className="h-3 w-3 rotate-90" />
                  Nascondi dettagli
                </>
              ) : (
                <>
                  <ChevronRight className="h-3 w-3 rotate-90" />
                  Mostra dettagli
                </>
              )}
            </button>

            {isExpanded && (
              <div className="space-y-2 mt-2 pt-2 border-t border-current/10">
                {event.reasoning && (
                  <div>
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Ragionamento AI
                    </div>
                    <div className="text-xs bg-white/70 p-2 rounded whitespace-pre-wrap leading-relaxed">
                      {event.reasoning}
                    </div>
                  </div>
                )}

                {event.aiSelectedTemplateReasoning && (
                  <div>
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Scelta Template
                    </div>
                    <div className="text-xs bg-blue-100/70 p-2 rounded whitespace-pre-wrap leading-relaxed text-blue-900">
                      {event.aiSelectedTemplateReasoning}
                    </div>
                  </div>
                )}

                {event.messagePreview && (
                  <div>
                    <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Messaggio
                    </div>
                    <div className="text-xs bg-green-100/70 p-2 rounded border-l-2 border-green-500 whitespace-pre-wrap leading-relaxed">
                      {event.messagePreview}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Actions */}
        {(event.type === 'message_scheduled' && event.status === 'scheduled') || event.type === 'message_failed' ? (
          <div className="flex gap-2 mt-2 pt-2 border-t border-current/10">
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
        ) : null}
      </div>
    </div>
  );
}

function DetailPanel({ conversation }: { conversation: ConversationTimeline | null }) {
  if (!conversation) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Seleziona un lead per vedere i dettagli</p>
        </div>
      </div>
    );
  }

  const totalEvents = conversation.events.length;
  const countdown = formatCountdown(conversation.window24hExpiresAt);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-muted/50 to-muted/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-3xl">{getTemperatureEmoji(conversation.temperatureLevel)}</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">{conversation.leadName}</h2>
            {conversation.leadPhone && (
              <p className="text-sm text-muted-foreground">{conversation.leadPhone}</p>
            )}
          </div>
        </div>
        
        {/* Status badges */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <Badge className={`${getStatusConfig(conversation.currentStatus).color} font-medium`}>
            {getStatusConfig(conversation.currentStatus).label}
          </Badge>
          {countdown && (
            <Badge variant="outline" className={`text-xs ${
              countdown.isExpired ? 'border-red-300 bg-red-50 text-red-700' : 
              countdown.isUrgent ? 'border-orange-300 bg-orange-50 text-orange-700' : 
              'border-green-300 bg-green-50 text-green-700'
            }`}>
              <Clock className="h-3 w-3 mr-1" />
              24h: {countdown.text}
            </Badge>
          )}
          {conversation.consecutiveNoReplyCount !== undefined && conversation.consecutiveNoReplyCount > 0 && (
            <Badge variant="outline" className={`text-xs ${
              conversation.consecutiveNoReplyCount >= 3 ? 'border-red-300 bg-red-50 text-red-700' : 'border-orange-300 bg-orange-50 text-orange-700'
            }`}>
              {conversation.consecutiveNoReplyCount}/3 no reply
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            via {conversation.agentName}
          </Badge>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          <Link href={`/consultant/whatsapp-conversations?conversation=${conversation.conversationId}`}>
            <Button variant="default" size="sm" className="gap-1.5">
              <MessageSquare className="h-4 w-4" /> Apri Chat
            </Button>
          </Link>
          <SimulateAiButton conversationId={conversation.conversationId} />
        </div>
      </div>

      {/* Timeline header */}
      <div className="px-4 py-2 border-b bg-muted/20 flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Cronologia Completa
        </h3>
        <Badge variant="secondary" className="text-xs">
          {totalEvents} eventi
        </Badge>
      </div>

      {/* Full timeline - no pagination */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {conversation.events.map((event, index) => (
            <EventDetailCard 
              key={event.id} 
              event={event} 
              isLast={index === conversation.events.length - 1}
            />
          ))}
          
          {totalEvents === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nessun evento ancora</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2 p-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 border rounded">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-32" />
          </div>
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
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

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
  const timeline = data?.timeline || [];
  const selectedConversation = timeline.find((c: ConversationTimeline) => c.conversationId === selectedConversationId) || null;

  useEffect(() => {
    if (timeline.length > 0 && !selectedConversationId) {
      setSelectedConversationId(timeline[0].conversationId);
    }
  }, [timeline, selectedConversationId]);

  useEffect(() => {
    if (selectedConversationId && timeline.length > 0) {
      const exists = timeline.some((c: ConversationTimeline) => c.conversationId === selectedConversationId);
      if (!exists) {
        setSelectedConversationId(timeline[0]?.conversationId || null);
      }
    }
  }, [timeline, selectedConversationId]);

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
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
        <Card className="p-4 mb-4">
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

      {error && (
        <Card className="border-red-200 bg-red-50 mb-4">
          <CardContent className="p-4 text-center text-red-600">Errore nel caricamento</CardContent>
        </Card>
      )}

      {!isLoading && !error && timeline.length === 0 && (
        <Card className="flex-1">
          <CardContent className="py-8 text-center">
            <Activity className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">
              {hasActiveFilters ? "Nessuna attività con questi filtri." : "Nessuna attività. Le attività appariranno con le valutazioni AI."}
            </p>
          </CardContent>
        </Card>
      )}

      {(isLoading || (!error && timeline.length > 0)) && (
        <Card className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
              <div className="h-full flex flex-col border-r">
                <PendingQueuePanel />
                <div className="px-3 py-2 border-b text-xs text-muted-foreground">
                  {timeline.length} conversazioni ({data?.total || 0} eventi)
                </div>
                {isLoading ? (
                  <LoadingSkeleton />
                ) : (
                  <ScrollArea className="flex-1">
                    {timeline.map((conversation: ConversationTimeline) => (
                      <LeadListItem
                        key={conversation.conversationId}
                        conversation={conversation}
                        isSelected={selectedConversationId === conversation.conversationId}
                        onSelect={() => setSelectedConversationId(conversation.conversationId)}
                      />
                    ))}
                  </ScrollArea>
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={65}>
              <DetailPanel conversation={selectedConversation} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </Card>
      )}
    </div>
  );
}
