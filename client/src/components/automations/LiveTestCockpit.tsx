import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  FlaskConical,
  Send,
  Brain,
  Clock,
  User,
  MessageSquare,
  RefreshCw,
  Loader2,
  CheckCircle,
  Zap,
  Phone,
  Timer,
  Moon,
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface ConversationOption {
  id: string;
  phoneNumber: string;
  leadName: string;
  agentName: string;
  currentState: string;
  lastMessageAt: string | null;
  followupCount: number;
  consecutiveNoReplyCount: number;
  temperatureLevel: string | null;
}

interface ConversationDetails {
  id: string;
  phoneNumber: string;
  leadName: string;
  agentName: string;
  currentState: string;
  followupCount: number;
  consecutiveNoReplyCount: number;
  temperatureLevel: string | null;
  lastMessageAt: string | null;
  lastFollowupAt: string | null;
  dormantUntil: string | null;
  permanentlyExcluded: boolean;
  engagementScore: number | null;
  window24hExpiresAt: string | null;
  canSendFreeform: boolean;
}

interface EvaluateNowResponse {
  success: boolean;
  decision: string;
  reasoning: string;
  confidenceScore: number;
  recommendedAction: string;
  templateId?: string;
  templateName?: string;
  messagePreview?: string;
}

function getTemperatureBadge(temp: string | null) {
  switch (temp) {
    case 'hot': return <Badge className="bg-red-100 text-red-700">🔥 Hot</Badge>;
    case 'warm': return <Badge className="bg-yellow-100 text-yellow-700">🟡 Warm</Badge>;
    case 'cold': return <Badge className="bg-blue-100 text-blue-700">❄️ Cold</Badge>;
    case 'ghost': return <Badge className="bg-gray-100 text-gray-500">👻 Ghost</Badge>;
    default: return <Badge className="bg-gray-100 text-gray-500">Sconosciuto</Badge>;
  }
}

function getStateBadge(state: string) {
  const colors: Record<string, string> = {
    'new': 'bg-blue-100 text-blue-700',
    'contacted': 'bg-green-100 text-green-700',
    'interested': 'bg-purple-100 text-purple-700',
    'qualified': 'bg-indigo-100 text-indigo-700',
    'converted': 'bg-emerald-100 text-emerald-700',
    'lost': 'bg-red-100 text-red-700',
  };
  return <Badge className={colors[state] || 'bg-gray-100 text-gray-700'}>{state}</Badge>;
}

export function LiveTestCockpit() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [timeOverrideHours, setTimeOverrideHours] = useState<string>("");

  const { data: conversations, isLoading: isLoadingConversations } = useQuery<ConversationOption[]>({
    queryKey: ['live-test-conversations'],
    queryFn: async () => {
      const response = await fetch('/api/followup/conversations-for-test', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Errore nel caricamento conversazioni');
      return response.json();
    },
  });

  const { data: selectedDetails, isLoading: isLoadingDetails, refetch: refetchDetails } = useQuery<ConversationDetails>({
    queryKey: ['live-test-details', selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return null;
      const response = await fetch(`/api/followup/conversation-details/${selectedConversationId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Errore nel caricamento dettagli');
      return response.json();
    },
    enabled: !!selectedConversationId,
  });

  const evaluateNowMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch('/api/followup/evaluate-now', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          timeOverrideHours: timeOverrideHours ? parseFloat(timeOverrideHours) : undefined,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Errore nella valutazione AI');
      }
      return response.json() as Promise<EvaluateNowResponse>;
    },
    onSuccess: (data) => {
      toast({
        title: "Valutazione AI completata",
        description: `Decisione: ${data.decision} (${Math.round(data.confidenceScore * 100)}% confidenza)`,
      });
      refetchDetails();
    },
    onError: (error: any) => {
      toast({
        title: "Errore valutazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendTemplateMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch(`/api/followup/send-now/${conversationId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Errore invio template');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Template inviato",
        description: data.message || "Messaggio inviato con successo",
      });
      refetchDetails();
      queryClient.invalidateQueries({ queryKey: ['live-test-conversations'] });
    },
    onError: (error: any) => {
      toast({
        title: "Errore invio",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 dark:border-purple-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
              <FlaskConical className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Test Live Cockpit</CardTitle>
              <CardDescription>
                Testa le valutazioni AI e invia messaggi in tempo reale per singoli lead
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Seleziona Lead
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingConversations ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select
                value={selectedConversationId || ""}
                onValueChange={(value) => setSelectedConversationId(value || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona una conversazione..." />
                </SelectTrigger>
                <SelectContent>
                  {conversations?.map((conv) => (
                    <SelectItem key={conv.id} value={conv.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{conv.leadName || conv.phoneNumber}</span>
                        <span className="text-xs text-muted-foreground">({conv.agentName})</span>
                      </div>
                    </SelectItem>
                  ))}
                  {(!conversations || conversations.length === 0) && (
                    <SelectItem value="" disabled>
                      Nessuna conversazione disponibile
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}

            {selectedDetails && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{selectedDetails.leadName || selectedDetails.phoneNumber}</span>
                  {getTemperatureBadge(selectedDetails.temperatureLevel)}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedDetails.phoneNumber}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Stato:</span>
                    {getStateBadge(selectedDetails.currentState)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Agente:</span>
                    <span>{selectedDetails.agentName}</span>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Follow-up inviati:</span>{" "}
                    <span className="font-medium">{selectedDetails.followupCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Senza risposta:</span>{" "}
                    <span className="font-medium">{selectedDetails.consecutiveNoReplyCount}/3</span>
                  </div>
                </div>
                {selectedDetails.lastMessageAt && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Ultimo messaggio:</span>{" "}
                    <span>{format(new Date(selectedDetails.lastMessageAt), "d MMM yyyy HH:mm", { locale: it })}</span>
                  </div>
                )}
                {selectedDetails.window24hExpiresAt && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Finestra 24h scade:</span>{" "}
                    <span className={new Date(selectedDetails.window24hExpiresAt) > new Date() ? "text-green-600" : "text-red-600"}>
                      {format(new Date(selectedDetails.window24hExpiresAt), "d MMM yyyy HH:mm", { locale: it })}
                    </span>
                  </div>
                )}
                {selectedDetails.canSendFreeform && (
                  <Badge className="bg-green-100 text-green-700">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Freeform disponibile
                  </Badge>
                )}
                {selectedDetails.dormantUntil && new Date(selectedDetails.dormantUntil) > new Date() && (
                  <div className="p-2 bg-amber-50 rounded text-amber-800 text-sm">
                    <Moon className="h-4 w-4 inline mr-1" />
                    Dormiente fino a: {format(new Date(selectedDetails.dormantUntil), "d MMMM yyyy", { locale: it })}
                  </div>
                )}
              </div>
            )}

            {isLoadingDetails && selectedConversationId && (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4" />
              Controlli Test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Override Tempo (ore senza risposta)
              </Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                placeholder="Lascia vuoto per usare tempo reale"
                value={timeOverrideHours}
                onChange={(e) => setTimeOverrideHours(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Simula che siano passate X ore dall'ultimo messaggio del lead
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => selectedConversationId && evaluateNowMutation.mutate(selectedConversationId)}
                disabled={!selectedConversationId || evaluateNowMutation.isPending}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
              >
                {evaluateNowMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4" />
                )}
                Valuta AI
              </Button>

              <Button
                onClick={() => selectedConversationId && sendTemplateMutation.mutate(selectedConversationId)}
                disabled={!selectedConversationId || sendTemplateMutation.isPending}
                variant="outline"
                className="flex items-center gap-2"
              >
                {sendTemplateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Invia Template
              </Button>

              <Button
                onClick={() => refetchDetails()}
                disabled={!selectedConversationId}
                variant="ghost"
                size="icon"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {evaluateNowMutation.data && (
              <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <Brain className="h-4 w-4 text-purple-600" />
                  Risultato Valutazione AI
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Decisione:</span>
                    <Badge className={
                      evaluateNowMutation.data.decision === 'send' ? 'bg-green-100 text-green-700' :
                      evaluateNowMutation.data.decision === 'skip' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }>
                      {evaluateNowMutation.data.decision}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Confidenza:</span>
                    <span>{Math.round(evaluateNowMutation.data.confidenceScore * 100)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ragionamento:</span>
                    <p className="mt-1 text-sm">{evaluateNowMutation.data.reasoning}</p>
                  </div>
                  {evaluateNowMutation.data.templateName && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Template consigliato:</span>
                      <span>{evaluateNowMutation.data.templateName}</span>
                    </div>
                  )}
                  {evaluateNowMutation.data.messagePreview && (
                    <div>
                      <span className="text-muted-foreground">Anteprima messaggio:</span>
                      <p className="mt-1 p-2 bg-white dark:bg-gray-800 rounded text-sm italic">
                        "{evaluateNowMutation.data.messagePreview}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" />
              AI Decision Stream
            </CardTitle>
            <CardDescription>
              Visualizza le ultime decisioni AI per il lead selezionato
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
              <div className="text-center">
                <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Seleziona un lead e clicca "Valuta AI" per vedere le decisioni</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              Chat Preview
            </CardTitle>
            <CardDescription>
              Anteprima degli ultimi messaggi della conversazione
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-muted-foreground bg-muted/30 rounded-lg">
              <div className="text-center">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Seleziona un lead per vedere la cronologia chat</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
