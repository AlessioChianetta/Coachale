import { useState, useMemo } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Timer,
  MessageCircle,
  Ban,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Info
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

function getTemperatureConfig(temperature?: string) {
  switch (temperature) {
    case 'hot':
      return { emoji: '🔥', label: 'Hot', color: 'bg-red-100 text-red-700 border-red-300' };
    case 'warm':
      return { emoji: '🟡', label: 'Warm', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
    case 'cold':
      return { emoji: '❄️', label: 'Cold', color: 'bg-blue-100 text-blue-700 border-blue-300' };
    case 'ghost':
      return { emoji: '👻', label: 'Ghost', color: 'bg-gray-100 text-gray-500 border-gray-300' };
    default:
      return { emoji: '🟡', label: 'Warm', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' };
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

interface ReasoningInsight {
  icon: React.ReactNode;
  text: string;
  color: string;
  priority: number;
}

function parseReasoningInsights(reasoning: string): ReasoningInsight[] {
  const insights: ReasoningInsight[] = [];
  
  // Tempo dall'ultimo messaggio - alta priorità
  const timeMatch = reasoning.match(/Tempo dall'ultimo messaggio:\s*~?([\d.,]+)\s*(ore|minuti|giorni)/i);
  if (timeMatch) {
    const value = parseFloat(timeMatch[1].replace(',', '.'));
    const unit = timeMatch[2];
    const isLong = value > 24 && unit === 'ore';
    insights.push({
      icon: <Timer className="h-3 w-3" />,
      text: `${timeMatch[1]}${unit.charAt(0)}`,
      color: isLong ? "text-orange-600" : "text-blue-600",
      priority: 1
    });
  }
  
  // Finestra 24h - solo se scaduta (importante)
  if (reasoning.includes('fuori dalla finestra 24h') || reasoning.includes('fuori finestra')) {
    insights.push({
      icon: <Ban className="h-3 w-3" />,
      text: "24h scaduta",
      color: "text-red-600",
      priority: 2
    });
  }
  
  // Template vs freeform - solo se rilevante
  if (reasoning.includes('template approvato') || reasoning.includes('necessario utilizzare un template')) {
    insights.push({
      icon: <FileText className="h-3 w-3" />,
      text: "Template",
      color: "text-purple-600",
      priority: 3
    });
  }
  
  // Risposta lead - solo se menzionata
  if (reasoning.includes('non ha risposto')) {
    insights.push({
      icon: <ThumbsDown className="h-3 w-3" />,
      text: "No risposta",
      color: "text-amber-600",
      priority: 4
    });
  } else if (reasoning.includes('ha risposto positivamente') || reasoning.includes('lead ha risposto')) {
    insights.push({
      icon: <ThumbsUp className="h-3 w-3" />,
      text: "Risposta+",
      color: "text-green-600",
      priority: 4
    });
  }
  
  // Ordina per priorità e limita a 3 insights
  return insights.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

function StructuredReasoning({ reasoning, eventId, showFull, onToggle }: {
  reasoning: string;
  eventId: string;
  showFull: boolean;
  onToggle: () => void;
}) {
  const insights = parseReasoningInsights(reasoning);
  
  return (
    <div className="mt-1">
      <div className="flex items-center gap-3 text-xs">
        {insights.map((insight, idx) => (
          <span key={idx} className={`inline-flex items-center gap-1 ${insight.color}`}>
            {insight.icon}
            <span>{insight.text}</span>
          </span>
        ))}
        <button 
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 ml-auto"
        >
          <Info className="h-3 w-3" />
          {showFull ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>
      
      {showFull && (
        <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground leading-relaxed">
          {reasoning}
        </div>
      )}
    </div>
  );
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

  // Can send if: inside 24h window (canSendFreeform) OR has an approved template
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
              className={`gap-1 ${!canSend ? 'opacity-50 cursor-not-allowed' : 'text-blue-600 border-blue-300 hover:bg-blue-50'}`}
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
      className="gap-1 text-orange-600 border-orange-300 hover:bg-orange-50"
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
            className="gap-1 text-purple-600 border-purple-300 hover:bg-purple-50"
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

// ═══════════════════════════════════════════════════════════════════════════
// PENDING QUEUE PANEL - Shows upcoming follow-ups grouped by agent
// ═══════════════════════════════════════════════════════════════════════════



function PendingQueuePanel() {
  const { data, isLoading, error } = usePendingQueue();

  if (isLoading) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Prossimi Controlli
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mb-4 border-red-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            Errore Prossimi Controlli
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">{(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  if (data.agents.length === 0) {
    return (
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Prossimi Controlli
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nessun follow-up in coda</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Prossimi Controlli
          <Badge variant="secondary" className="ml-auto">
            {data.totalPending} attivi
          </Badge>
          {data.totalDormant > 0 && (
            <Badge variant="outline" className="text-orange-600">
              {data.totalDormant} in pausa
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.agents.map((agent) => (
          <div key={agent.agentId} className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-3 w-3 text-primary" />
              {agent.agentName}
              <Badge variant="outline" className="text-xs">
                {agent.pending.length}
              </Badge>
            </div>
            <div className="ml-5 space-y-1">
              {agent.pending.slice(0, 5).map((item) => (
                <PendingQueueRow key={item.conversationId} item={item} />
              ))}
              {agent.pending.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{agent.pending.length - 5} altri...
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
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

  // Describe what will happen next
  const getNextAction = () => {
    if (item.isDormant) {
      return `Risveglio: ${item.dormantUntil ? format(new Date(item.dormantUntil), "dd MMM yyyy", { locale: it }) : '3 mesi'}`;
    }
    if (item.consecutiveNoReply >= 2) {
      return "⚠️ Prossimo: ultimo tentativo prima di dormienza";
    }
    if (item.consecutiveNoReply === 1) {
      return `📤 Prossimo: follow-up #${item.followupCount + 1} (tentativo 2/3)`;
    }
    return `📤 Prossimo: follow-up #${item.followupCount + 1}`;
  };

  return (
    <div className={`flex flex-col gap-1 text-xs p-2 rounded ${item.isDormant ? 'bg-orange-50 border border-orange-200' :
      item.isOverdue ? 'bg-red-50 border border-red-200' :
        'bg-muted/50'
      }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <User className="h-3 w-3 flex-shrink-0" />
          <span className="truncate font-medium">{item.leadName}</span>
          <span className="text-muted-foreground">({item.consecutiveNoReply}/3)</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {item.isDormant ? (
            <Badge variant="outline" className="text-orange-600 text-[10px]">
              😴 Pausa
            </Badge>
          ) : item.isOverdue ? (
            <Badge variant="destructive" className="text-[10px]">
              ⚠️ Scaduto
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              {formatNextCheck(item.nextCheckAt)}
            </Badge>
          )}
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground pl-5">
        {getNextAction()}
      </div>
    </div>
  );
}

function ConversationCard({ conversation }: { conversation: ConversationTimeline }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showFullReasoning, setShowFullReasoning] = useState<Record<string, boolean>>({});
  const [showFullMessagePreview, setShowFullMessagePreview] = useState<Record<string, boolean>>({});
  const statusConfig = getStatusConfig(conversation.currentStatus);
  const StatusIcon = statusConfig.icon;
  const tempConfig = getTemperatureConfig(conversation.temperatureLevel);
  const countdown = formatCountdown(conversation.window24hExpiresAt);

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
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    {conversation.leadName}
                    <Badge variant="outline" className="text-xs font-normal">
                      via {conversation.agentName}
                    </Badge>
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
                  </CardTitle>
                  <CardDescription className="text-xs flex items-center gap-2 flex-wrap">
                    {conversation.events.length} eventi recenti
                    {countdown && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${countdown.isExpired
                              ? 'bg-red-100 text-red-700'
                              : countdown.isUrgent
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-green-100 text-green-700'
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
                        <StructuredReasoning
                          reasoning={event.reasoning}
                          eventId={event.id}
                          showFull={showFullReasoning[event.id] || false}
                          onToggle={() => setShowFullReasoning(prev => ({ ...prev, [event.id]: !prev[event.id] }))}
                        />
                      )}

                      {event.messagePreview && (
                        <div className="mt-2 relative">
                          <div className="flex items-center gap-2 mb-1.5">
                            {(() => {
                              const templateStatus = getTemplateStatusConfig(event.templateTwilioStatus, !!event.templateId);
                              const isTemplate = !!event.templateId;
                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={`text-xs font-medium flex items-center gap-1 px-1.5 py-0.5 rounded ${
                                        isTemplate 
                                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' 
                                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                      }`}>
                                        {isTemplate ? <FileText className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
                                        {isTemplate ? 'Template' : 'AI'}
                                        <span className={templateStatus.color}>{templateStatus.icon}</span>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{isTemplate ? `${event.templateName}` : 'Messaggio generato dall\'AI'}</p>
                                      <p className="text-xs opacity-70">{templateStatus.tooltip}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                          </div>
                          
                          <div className="pl-3 border-l-2 border-gray-200 dark:border-gray-700">
                            <p className={`text-xs text-muted-foreground leading-relaxed ${showFullMessagePreview[event.id] ? '' : 'line-clamp-2'}`}>
                              {event.messagePreview}
                            </p>
                            {event.messagePreview.length > 100 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowFullMessagePreview(prev => ({ ...prev, [event.id]: !prev[event.id] }));
                                }}
                                className="text-xs text-blue-600 hover:underline mt-0.5"
                              >
                                {showFullMessagePreview[event.id] ? '▲ meno' : '▼ tutto'}
                              </button>
                            )}
                          </div>
                          
                          {event.aiSelectedTemplateReasoning && (
                            <div className="mt-1.5 pl-3 border-l-2 border-purple-200 dark:border-purple-800">
                              <p className="text-xs text-purple-600 dark:text-purple-400 flex items-start gap-1">
                                <Brain className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span className="leading-relaxed">{event.aiSelectedTemplateReasoning}</span>
                              </p>
                            </div>
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

            <div className="flex gap-2 mt-4 pt-3 border-t flex-wrap">
              <Link href={`/consultant/whatsapp-conversations?conversation=${conversation.conversationId}`}>
                <Button variant="outline" size="sm" className="gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Vedi Chat
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
  const [agentId, setAgentId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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
        <Card className="p-4">
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
              {hasActiveFilters
                ? "Nessuna attività trovata con i filtri selezionati. Prova a modificare i criteri di ricerca."
                : "Nessuna attività trovata. Le attività appariranno quando il sistema valuterà le conversazioni."
              }
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && data?.timeline && data.timeline.length > 0 && (
        <div className="space-y-3">
          {/* Pending Queue Panel shows upcoming follow-ups */}
          <PendingQueuePanel />

          {data.timeline.map((conversation: ConversationTimeline) => (
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
