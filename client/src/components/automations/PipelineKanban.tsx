import { useConversationStates } from "@/hooks/useFollowupApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Clock, TrendingUp, MessageSquare, KanbanSquare } from "lucide-react";

interface ConversationState {
  id: string;
  conversationId: string;
  currentState: string;
  engagementScore: number | null;
  conversionProbability: number | null;
  aiRecommendation: string | null;
  updatedAt: string;
}

interface Conversation {
  id: string;
  phoneNumber: string;
  lastMessageAt: string | null;
}

interface ConversationWithState {
  state: ConversationState;
  conversation: Conversation;
}

const PIPELINE_STATES = [
  { key: "new_contact", label: "Nuovo Contatto", color: "bg-blue-500" },
  { key: "contacted", label: "Contattato", color: "bg-cyan-500" },
  { key: "engaged", label: "Interessato", color: "bg-yellow-500" },
  { key: "qualified", label: "Qualificato", color: "bg-orange-500" },
  { key: "negotiating", label: "In Trattativa", color: "bg-purple-500" },
  { key: "demo", label: "Demo", color: "bg-indigo-500" },
  { key: "closed_won", label: "Chiuso Vinto", color: "bg-green-500" },
] as const;

function maskPhoneNumber(phone: string): string {
  if (!phone) return "N/A";
  const cleaned = phone.replace(/\s/g, "");
  if (cleaned.length < 8) return phone;
  const prefix = cleaned.slice(0, 3);
  const suffix = cleaned.slice(-4);
  return `${prefix} xxx xxx ${suffix}`;
}

function getDaysSinceLastMessage(lastMessageAt: string | null): number {
  if (!lastMessageAt) return 0;
  const lastMessage = new Date(lastMessageAt);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - lastMessage.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function getEngagementBadgeColor(score: number | null): string {
  if (score === null) return "bg-gray-400";
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function LeadCard({ data }: { data: ConversationWithState }) {
  const { state, conversation } = data;
  const daysSince = getDaysSinceLastMessage(conversation.lastMessageAt);

  return (
    <Card className="mb-3 hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            {maskPhoneNumber(conversation.phoneNumber)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <Clock className="h-3 w-3" />
          <span>{daysSince} giorni dall'ultimo messaggio</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <Badge className={`${getEngagementBadgeColor(state.engagementScore)} text-white text-xs`}>
            <TrendingUp className="h-3 w-3 mr-1" />
            {state.engagementScore ?? 0}%
          </Badge>
          <Badge variant="outline" className="text-xs">
            Conv: {((state.conversionProbability ?? 0) * 100).toFixed(0)}%
          </Badge>
        </div>

        {state.aiRecommendation && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{state.aiRecommendation}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KanbanColumn({
  state,
  conversations,
}: {
  state: (typeof PIPELINE_STATES)[number];
  conversations: ConversationWithState[];
}) {
  return (
    <div className="flex-shrink-0 w-[280px]">
      <Card className="h-full">
        <CardHeader className={`${state.color} text-white rounded-t-lg py-3`}>
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            {state.label}
            <Badge variant="secondary" className="bg-white/20 text-white">
              {conversations.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 max-h-[500px] overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nessun lead
            </p>
          ) : (
            conversations.map((conv) => (
              <LeadCard key={conv.state.id} data={conv} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {PIPELINE_STATES.map((state) => (
        <div key={state.key} className="flex-shrink-0 w-[280px]">
          <Card>
            <CardHeader className="py-3">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}

export function PipelineKanban() {
  const { data, isLoading, error } = useConversationStates();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <KanbanSquare className="h-16 w-16 text-destructive mb-4" />
            <h3 className="text-xl font-semibold mb-2">Errore</h3>
            <p className="text-muted-foreground">
              Impossibile caricare i dati della pipeline
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const conversations: ConversationWithState[] = data || [];

  if (conversations.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <KanbanSquare className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nessun lead in pipeline</h3>
            <p className="text-muted-foreground">
              I lead appariranno qui quando inizieranno le conversazioni
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const groupedByState = PIPELINE_STATES.reduce(
    (acc, state) => {
      acc[state.key] = conversations.filter(
        (conv) => conv.state.currentState === state.key
      );
      return acc;
    },
    {} as Record<string, ConversationWithState[]>
  );

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4">
        {PIPELINE_STATES.map((state) => (
          <KanbanColumn
            key={state.key}
            state={state}
            conversations={groupedByState[state.key] || []}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
