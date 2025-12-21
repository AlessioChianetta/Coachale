import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  MessageSquare, 
  UserPlus, 
  Calendar, 
  CheckCircle, 
  XCircle,
  Clock,
  Bot,
  Zap,
  AlertCircle,
  RefreshCw,
  Send,
  Phone
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface ActivityItem {
  id: string;
  type: "message_sent" | "message_received" | "lead_qualified" | "appointment_booked" | "agent_started" | "agent_paused" | "conversation_completed" | "error";
  agentId: string;
  agentName: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

const activityConfig: Record<string, { 
  icon: typeof MessageSquare; 
  color: string; 
  bgColor: string;
  label: string;
}> = {
  message_sent: {
    icon: Send,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    label: "Messaggio Inviato",
  },
  message_received: {
    icon: MessageSquare,
    color: "text-green-600",
    bgColor: "bg-green-50",
    label: "Messaggio Ricevuto",
  },
  lead_qualified: {
    icon: UserPlus,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    label: "Lead Qualificato",
  },
  appointment_booked: {
    icon: Calendar,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    label: "Appuntamento",
  },
  agent_started: {
    icon: Zap,
    color: "text-green-600",
    bgColor: "bg-green-50",
    label: "Agente Attivato",
  },
  agent_paused: {
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    label: "Agente in Pausa",
  },
  conversation_completed: {
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    label: "Conversazione Completata",
  },
  error: {
    icon: AlertCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    label: "Errore",
  },
};

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const config = activityConfig[activity.type] || {
    icon: Activity,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    label: "Attivita",
  };
  
  const Icon = config.icon;

  const timeAgo = formatDistanceToNow(new Date(activity.timestamp), {
    addSuffix: true,
    locale: it,
  });

  return (
    <div className="flex items-start gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors">
      <div className={cn("p-2 rounded-lg", config.bgColor)}>
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm text-slate-900 truncate">
            {activity.agentName}
          </span>
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            {config.label}
          </Badge>
        </div>
        <p className="text-sm text-slate-600 line-clamp-2">
          {activity.description}
        </p>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo}
        </p>
      </div>
    </div>
  );
}

function ActivityRowSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3">
      <Skeleton className="w-8 h-8 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function ActivityFeed() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<ActivityItem[]>({
    queryKey: ["/api/whatsapp/agents/activity-feed"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/agents/activity-feed", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch activity feed");
      }
      const result = await response.json();
      return Array.isArray(result) ? result : (result.activities || []);
    },
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const activities = data || [];

  return (
    <Card className="bg-white border border-slate-200 h-full flex flex-col">
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          Attivita Recenti
        </CardTitle>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className={cn(
            "p-1.5 rounded-lg hover:bg-slate-100 transition-colors",
            isFetching && "animate-spin"
          )}
        >
          <RefreshCw className="h-4 w-4 text-slate-500" />
        </button>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden pt-2 px-2">
        {isError ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
            <p className="text-sm text-red-600">Errore nel caricamento</p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="space-y-1">
                {[...Array(5)].map((_, i) => (
                  <ActivityRowSkeleton key={i} />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Activity className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">Nessuna attivita recente</p>
                <p className="text-xs text-slate-400 mt-1">
                  Le attivita degli agenti appariranno qui
                </p>
              </div>
            ) : (
              <div className="space-y-1 pr-2">
                {activities.slice(0, 10).map((activity) => (
                  <ActivityRow key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
