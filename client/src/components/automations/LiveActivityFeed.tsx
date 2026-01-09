import { useState, useMemo, useRef, useEffect } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
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
  Brain,
  Loader2,
  Zap,
  Search,
  Calendar,
  Filter,
  Inbox,
  Bot,
  Image as ImageIcon,
  FileText,
  CheckCheck,
  Check,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Link } from "wouter";
import { useSendMessageNow, useFollowupAgents, useActivityLog, usePendingQueue, type ActivityLogFilters, type PendingQueueItem } from "@/hooks/useFollowupApi";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WhatsAppMessage {
  id: string;
  text: string;
  direction: "inbound" | "outbound";
  sender: "client" | "consultant" | "ai";
  mediaType: string;
  mediaUrl: string | null;
  twilioStatus: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
}

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
  agentName: string;
  agentId?: string;
  currentStatus: string;
  temperatureLevel?: 'hot' | 'warm' | 'cold' | 'ghost';
  currentState?: string;
  window24hExpiresAt?: string;
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
      return { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle, label: 'Attivo' };
    case 'stopped':
      return { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Stop' };
    case 'waiting':
      return { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock, label: 'In Attesa' };
    case 'error':
      return { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertTriangle, label: 'Errore' };
    case 'scheduled':
      return { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock, label: 'Programmato' };
    default:
      return { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: Activity, label: status };
  }
}

function getTemperatureConfig(temperature?: string) {
  switch (temperature) {
    case 'hot':
      return { emoji: '🔥', label: 'Hot', color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700' };
    case 'warm':
      return { emoji: '🟡', label: 'Warm', color: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700' };
    case 'cold':
      return { emoji: '❄️', label: 'Cold', color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700' };
    case 'ghost':
      return { emoji: '👻', label: 'Ghost', color: 'bg-gray-100 text-gray-500 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600' };
    default:
      return { emoji: '🟡', label: 'Warm', color: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700' };
  }
}

function getTemplateStatusConfig(twilioStatus?: string | null, hasTemplate?: boolean) {
  if (!hasTemplate) {
    return { icon: '❌', label: 'Nessun template', color: 'text-gray-500', tooltip: 'Messaggio AI senza template' };
  }
  switch (twilioStatus) {
    case 'approved':
      return { icon: '✅', label: 'Approvato', color: 'text-green-600', tooltip: 'Template approvato da WhatsApp' };
    case 'pending':
      return { icon: '⏳', label: 'In attesa', color: 'text-yellow-600', tooltip: 'Template in attesa di approvazione WhatsApp' };
    case 'rejected':
      return { icon: '🚫', label: 'Rifiutato', color: 'text-red-600', tooltip: 'Template rifiutato da WhatsApp' };
    case 'not_synced':
      return { icon: '🔄', label: 'Non sincronizzato', color: 'text-blue-500', tooltip: 'Template non ancora sincronizzato con Twilio' };
    default:
      return { icon: '❓', label: 'Sconosciuto', color: 'text-gray-500', tooltip: 'Stato template sconosciuto' };
  }
}

function formatCountdown(expiresAt?: string): { text: string; isExpired: boolean; isUrgent: boolean } | null {
  if (!expiresAt) return null;

  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { text: 'Scaduta', isExpired: true, isUrgent: false };
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const isUrgent = hours < 2;

  if (hours > 0) {
    return { text: `${hours}h ${minutes}m`, isExpired: false, isUrgent };
  }
  return { text: `${minutes}m`, isExpired: false, isUrgent };
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

function SendNowButton({
  messageId,
  canSendFreeform,
  hasApprovedTemplate
}: {
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
      toast({
        title: "Messaggio inviato",
        description: result.message || "Il messaggio è stato inviato con successo!",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'invio del messaggio",
        variant: "destructive",
      });
    }
  };

  const isDisabled = sendNow.isPending || !canSend;
  const tooltipText = !canSend
    ? "Fuori finestra 24h e nessun template approvato"
    : hasApprovedTemplate && !canSendFreeform
      ? "Invia subito (con template approvato)"
      : "Invia subito";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendNow}
              disabled={isDisabled}
              className={`gap-1 ${!canSend ? 'opacity-50 cursor-not-allowed' : 'text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
            >
              {sendNow.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              Invia Ora
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();
      if (result.success) {
        toast({
          title: "Ritentativo schedulato",
          description: "Il messaggio verrà rinviato a breve",
        });
        queryClient.invalidateQueries({ queryKey: ['activity-log'] });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Errore durante il ritentativo",
        variant: "destructive",
      });
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRetry}
      disabled={isRetrying}
      className="gap-1 text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20"
    >
      {isRetrying ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <RefreshCw className="h-3 w-3" />
      )}
      Riprova
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
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      const result = await response.json();
      if (result.success) {
        toast({
          title: `📤 ${result.message}`,
          description: result.messagePreview ? `"${result.messagePreview}..."` : undefined,
        });

        if (result.dormancyTriggered) {
          toast({
            title: "😴 Lead in Dormienza",
            description: "Troppi tentativi senza risposta. Il lead è stato messo in pausa per 3 mesi.",
            variant: "destructive",
          });
        }

        queryClient.invalidateQueries({ queryKey: ['activity-log'] });
        queryClient.invalidateQueries({ queryKey: ['followup-conversations'] });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: "Errore Simulazione",
        description: error.message || "Errore durante la simulazione AI",
        variant: "destructive",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSimulate}
            disabled={isSimulating}
            className="gap-1 text-purple-600 border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
          >
            {isSimulating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Brain className="h-3 w-3" />
            )}
            Simula AI
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Forza valutazione AI e aggiorna contatori (per test)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PendingQueuePanel() {
  const { data, isLoading, error } = usePendingQueue();
  const [isOpen, setIsOpen] = useState(true);

  if (isLoading) {
    return (
      <div className="p-3 border-b border-border">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !data || data.agents.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-border">
      <CollapsibleTrigger className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4 text-primary" />
          Prossimi Controlli
          <Badge variant="secondary" className="text-xs">
            {data.totalPending}
          </Badge>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-3 pt-0 space-y-2 max-h-48 overflow-y-auto">
          {data.agents.map((agent) => (
            <div key={agent.agentId} className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Activity className="h-3 w-3" />
                {agent.agentName}
              </div>
              <div className="ml-4 space-y-1">
                {agent.pending.slice(0, 3).map((item) => (
                  <PendingQueueRow key={item.conversationId} item={item} />
                ))}
                {agent.pending.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{agent.pending.length - 3} altri...
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PendingQueueRow({ item }: { item: PendingQueueItem }) {
  const formatNextCheck = (dateStr: string | null) => {
    if (!dateStr) return "Non schedulato";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 0) return "Scaduto";
    if (diffMins < 60) return `tra ${diffMins}m`;
    if (diffHours < 24) return `tra ${diffHours}h`;
    return format(date, "dd MMM HH:mm", { locale: it });
  };

  return (
    <div className={`flex items-center justify-between text-xs p-1.5 rounded ${
      item.isDormant ? 'bg-orange-50 dark:bg-orange-900/20' :
      item.isOverdue ? 'bg-red-50 dark:bg-red-900/20' :
      'bg-muted/50'
    }`}>
      <span className="truncate font-medium">{item.leadName}</span>
      <Badge variant="secondary" className="text-[10px] ml-1">
        {item.isDormant ? '😴' : formatNextCheck(item.nextCheckAt)}
      </Badge>
    </div>
  );
}

function ConversationListItem({
  conversation,
  isSelected,
  onClick
}: {
  conversation: ConversationTimeline;
  isSelected: boolean;
  onClick: () => void;
}) {
  const statusConfig = getStatusConfig(conversation.currentStatus);
  const StatusIcon = statusConfig.icon;
  const tempConfig = getTemperatureConfig(conversation.temperatureLevel);
  const lastEvent = conversation.events[0];
  const lastEventTime = lastEvent ? format(new Date(lastEvent.timestamp), "dd MMM HH:mm", { locale: it }) : null;

  return (
    <div
      onClick={onClick}
      className={`p-3 border-b border-border cursor-pointer transition-colors hover:bg-muted/50 ${
        isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-full flex-shrink-0">
          <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="font-medium text-sm truncate">{conversation.leadName}</span>
            <Badge variant="outline" className={`text-[10px] px-1 py-0 h-4 flex-shrink-0 border ${tempConfig.color}`}>
              {tempConfig.emoji}
            </Badge>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-normal">
              {conversation.agentName}
            </Badge>
            <Badge className={`text-[10px] px-1 py-0 h-4 ${statusConfig.color}`}>
              <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
              {statusConfig.label}
            </Badge>
          </div>
          {lastEventTime && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {lastEventTime} · {conversation.events.length} eventi
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageStatusIcon({ status }: { status: string | null }) {
  if (!status) return null;
  switch (status) {
    case 'delivered':
    case 'read':
      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    case 'sent':
      return <CheckCheck className="h-3 w-3 text-gray-400" />;
    case 'queued':
    case 'accepted':
      return <Check className="h-3 w-3 text-gray-400" />;
    case 'failed':
    case 'undelivered':
      return <XCircle className="h-3 w-3 text-red-500" />;
    default:
      return <Check className="h-3 w-3 text-gray-400" />;
  }
}

function ChatMessagesView({ conversationId }: { conversationId: string }) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ["/api/whatsapp/conversations", conversationId, "messages"],
    queryFn: async () => {
      const response = await fetch(
        `/api/whatsapp/conversations/${conversationId}/messages`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
    enabled: !!conversationId,
    refetchInterval: 10000,
  });

  const messages: WhatsAppMessage[] = messagesData?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <MessageSquare className="h-10 w-10 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Nessun messaggio in questa conversazione</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-3 bg-[#e5ddd5] dark:bg-gray-900/50 min-h-full">
        {messages.map((msg) => {
          const isInbound = msg.direction === "inbound";
          const isAI = msg.sender === "ai";
          
          return (
            <div
              key={msg.id}
              className={`flex ${isInbound ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${
                  isInbound
                    ? "bg-white dark:bg-gray-800 text-foreground"
                    : isAI
                      ? "bg-purple-100 dark:bg-purple-900/50 text-foreground"
                      : "bg-green-100 dark:bg-green-900/50 text-foreground"
                }`}
              >
                {isAI && (
                  <div className="flex items-center gap-1 mb-1 text-purple-600 dark:text-purple-400">
                    <Bot className="h-3 w-3" />
                    <span className="text-[10px] font-medium">AI</span>
                  </div>
                )}
                
                {msg.mediaUrl && msg.mediaType?.startsWith("image") && (
                  <div className="mb-2">
                    <img
                      src={msg.mediaUrl}
                      alt="Media"
                      className="max-w-full rounded-lg max-h-48 object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                
                {msg.mediaUrl && !msg.mediaType?.startsWith("image") && (
                  <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <a
                      href={msg.mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Apri file
                    </a>
                  </div>
                )}
                
                {msg.text && (
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                )}
                
                <div className={`flex items-center gap-1 mt-1 ${isInbound ? "justify-start" : "justify-end"}`}>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(msg.createdAt), "HH:mm", { locale: it })}
                  </span>
                  {!isInbound && <MessageStatusIcon status={msg.twilioStatus} />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}

function TimelineEventsView({ 
  conversation, 
  showFullReasoning, 
  setShowFullReasoning,
  showFullMessagePreview,
  setShowFullMessagePreview
}: { 
  conversation: ConversationTimeline;
  showFullReasoning: Record<string, boolean>;
  setShowFullReasoning: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  showFullMessagePreview: Record<string, boolean>;
  setShowFullMessagePreview: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  return (
    <ScrollArea className="flex-1">
      <div className="p-4">
        <h3 className="text-sm font-medium mb-3 text-muted-foreground">
          Timeline Eventi ({conversation.events.length})
        </h3>
        <div className="border-l-2 border-gray-200 dark:border-gray-700 ml-2 pl-4 space-y-4">
          {conversation.events.map((event) => (
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
                    <div className="mt-0.5">
                      <p className={`text-xs text-muted-foreground ${showFullReasoning[event.id] ? '' : 'line-clamp-2'}`}>
                        {event.reasoning}
                      </p>
                      {event.reasoning.length > 100 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFullReasoning(prev => ({ ...prev, [event.id]: !prev[event.id] }));
                          }}
                          className="text-xs text-blue-600 hover:underline mt-0.5"
                        >
                          {showFullReasoning[event.id] ? 'Mostra meno' : 'Mostra tutto'}
                        </button>
                      )}
                    </div>
                  )}

                  {event.messagePreview && (
                    <div className="mt-1.5 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {event.templateName ? `Template: ${event.templateName}` : 'Messaggio AI'}
                        </p>
                        {(() => {
                          const templateStatus = getTemplateStatusConfig(event.templateTwilioStatus, !!event.templateId);
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={`text-xs flex items-center gap-1 ${templateStatus.color}`}>
                                    <span>{templateStatus.icon}</span>
                                    <span className="hidden sm:inline">{templateStatus.label}</span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{templateStatus.tooltip}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()}
                      </div>
                      <p className={`text-xs italic ${showFullMessagePreview[event.id] ? '' : 'line-clamp-3'}`}>"{event.messagePreview}"</p>
                      {event.messagePreview.length > 150 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFullMessagePreview(prev => ({ ...prev, [event.id]: !prev[event.id] }));
                          }}
                          className="text-xs text-blue-600 hover:underline mt-1"
                        >
                          {showFullMessagePreview[event.id] ? 'Mostra meno' : 'Mostra tutto'}
                        </button>
                      )}
                      {event.aiSelectedTemplateReasoning && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1.5 flex items-center gap-1">
                          <Brain className="h-3 w-3" />
                          <span className="font-medium">AI:</span> {event.aiSelectedTemplateReasoning}
                        </p>
                      )}
                    </div>
                  )}

                  {event.errorMessage && (
                    <div className="mt-0.5">
                      <p className="text-xs text-red-600">
                        Errore: {event.errorMessage}
                      </p>
                      {event.type === 'message_failed' && (
                        <div className="mt-1.5">
                          <RetryButton messageId={event.id.replace('msg-', '')} />
                        </div>
                      )}
                    </div>
                  )}

                  {event.confidenceScore !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      Confidenza: {Math.round(event.confidenceScore * 100)}%
                    </span>
                  )}

                  {event.type === 'message_scheduled' && event.status === 'scheduled' && (
                    <div className="mt-2">
                      <SendNowButton
                        messageId={event.id.replace('msg-', '')}
                        canSendFreeform={event.canSendFreeform}
                        hasApprovedTemplate={event.templateTwilioStatus === 'approved'}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

function ConversationDetailView({ conversation }: { conversation: ConversationTimeline | null }) {
  const [showFullReasoning, setShowFullReasoning] = useState<Record<string, boolean>>({});
  const [showFullMessagePreview, setShowFullMessagePreview] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<string>("chat");

  if (!conversation) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="bg-muted/50 rounded-full p-6 mb-4">
          <Inbox className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">Seleziona una conversazione</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Seleziona una conversazione dalla lista per visualizzare la chat e la timeline degli eventi.
        </p>
      </div>
    );
  }

  const statusConfig = getStatusConfig(conversation.currentStatus);
  const StatusIcon = statusConfig.icon;
  const tempConfig = getTemperatureConfig(conversation.temperatureLevel);
  const countdown = formatCountdown(conversation.window24hExpiresAt);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-full">
              <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h2 className="font-semibold text-lg flex items-center gap-2 flex-wrap">
                {conversation.leadName}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className={`text-xs font-normal border ${tempConfig.color}`}>
                        {tempConfig.emoji} {tempConfig.label}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Temperatura lead: {tempConfig.label}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                <span>via {conversation.agentName}</span>
                <Badge className={`${statusConfig.color} text-xs`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
                {countdown && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                          countdown.isExpired
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : countdown.isUrgent
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          <Clock className="h-3 w-3" />
                          {countdown.isExpired ? '24h scaduta' : `24h: ${countdown.text}`}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{countdown.isExpired
                          ? 'Finestra 24h scaduta - serve template approvato'
                          : `Finestra 24h scade tra ${countdown.text}`}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList className="h-8">
              <TabsTrigger value="chat" className="text-xs gap-1 px-3">
                <MessageSquare className="h-3 w-3" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs gap-1 px-3">
                <Activity className="h-3 w-3" />
                Timeline AI ({conversation.events.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2 flex-wrap">
            <Link href={`/consultant/whatsapp-conversations?conversation=${conversation.conversationId}`}>
              <Button variant="outline" size="sm" className="gap-1 h-8">
                <ExternalLink className="h-3 w-3" />
                Apri
              </Button>
            </Link>
            <SimulateAiButton conversationId={conversation.conversationId} />
            {conversation.currentStatus === 'scheduled' && conversation.events.some(e => e.type === 'message_scheduled') && (() => {
              const scheduledEvent = conversation.events.find(e => e.type === 'message_scheduled');
              return scheduledEvent ? (
                <SendNowButton
                  messageId={scheduledEvent.id.replace('msg-', '')}
                  canSendFreeform={scheduledEvent.canSendFreeform}
                  hasApprovedTemplate={scheduledEvent.templateTwilioStatus === 'approved'}
                />
              ) : null;
            })()}
            {conversation.currentStatus === 'error' && conversation.events.some(e => e.type === 'message_failed') && (
              <RetryButton
                messageId={conversation.events.find(e => e.type === 'message_failed')!.id.replace('msg-', '')}
              />
            )}
          </div>
        </div>
      </div>

      {activeTab === "chat" ? (
        <ChatMessagesView conversationId={conversation.conversationId} />
      ) : (
        <TimelineEventsView 
          conversation={conversation}
          showFullReasoning={showFullReasoning}
          setShowFullReasoning={setShowFullReasoning}
          showFullMessagePreview={showFullMessagePreview}
          setShowFullMessagePreview={setShowFullMessagePreview}
        />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-0">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-3 border-b border-border">
          <div className="flex items-start gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
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
  const [page, setPage] = useState(1);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filter, agentId, search, dateFrom, dateTo]);

  const filters: ActivityLogFilters = useMemo(() => ({
    filter: filter !== 'all' ? filter : undefined,
    agentId: agentId || undefined,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize: 20,
  }), [filter, agentId, search, dateFrom, dateTo, page]);

  const { data, isLoading, error, refetch, isFetching } = useActivityLog(filters);
  const { data: agents } = useFollowupAgents();

  const clearAllFilters = () => {
    setFilter('all');
    setAgentId('');
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = agentId || search || dateFrom || dateTo;

  const selectedConversation = useMemo(() => {
    if (!selectedConversationId || !data?.timeline) return null;
    return data.timeline.find((c: ConversationTimeline) => c.conversationId === selectedConversationId) || null;
  }, [selectedConversationId, data?.timeline]);

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all" className="text-xs">Tutti</TabsTrigger>
            <TabsTrigger value="sent" className="text-xs">Inviati</TabsTrigger>
            <TabsTrigger value="scheduled" className="text-xs">Programmati</TabsTrigger>
            <TabsTrigger value="stopped" className="text-xs">Bloccati</TabsTrigger>
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
            {hasActiveFilters && (
              <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-[10px] rounded-full">
                !
              </Badge>
            )}
          </Button>
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
      </div>

      {showAdvancedFilters && (
        <Card className="p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Search className="h-3 w-3" /> Cerca lead
              </label>
              <Input
                placeholder="Nome o telefono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Agente
              </label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Tutti gli agenti" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tutti gli agenti</SelectItem>
                  {agents?.map((agent: { id: string; agentName: string }) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.agentName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Da data
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> A data
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-3 pt-3 border-t flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs">
                Rimuovi tutti i filtri
              </Button>
            </div>
          )}
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 mb-4">
          <CardContent className="p-4 text-center text-red-600 dark:text-red-400">
            Errore nel caricamento del log attività
          </CardContent>
        </Card>
      )}

      <Card className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={32} minSize={25} maxSize={45}>
            <div className="h-full flex flex-col border-r border-border">
              <PendingQueuePanel />
              <ScrollArea className="flex-1">
                {isLoading && <LoadingSkeleton />}

                {!isLoading && !error && data?.timeline?.length === 0 && (
                  <div className="p-6 text-center">
                    <Activity className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {hasActiveFilters
                        ? "Nessuna attività trovata."
                        : "Nessuna attività."}
                    </p>
                  </div>
                )}

                {!isLoading && !error && data?.timeline && data.timeline.length > 0 && (
                  <div>
                    {data.timeline.map((conversation: ConversationTimeline) => (
                      <ConversationListItem
                        key={conversation.conversationId}
                        conversation={conversation}
                        isSelected={selectedConversationId === conversation.conversationId}
                        onClick={() => setSelectedConversationId(conversation.conversationId)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
              {data && data.totalConversations > 0 && (
                <div className="p-2 border-t border-border">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={!data.hasPrevPage || isFetching}
                      className="h-6 px-2"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Pag. {data.page}/{data.totalPages} · {data.totalConversations} conv.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={!data.hasNextPage || isFetching}
                      className="h-6 px-2"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={68} minSize={55}>
            <ConversationDetailView conversation={selectedConversation} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </Card>
    </div>
  );
}
