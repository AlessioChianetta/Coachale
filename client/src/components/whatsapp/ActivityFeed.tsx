import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  MessageSquare, 
  Bot,
  AlertCircle,
  RefreshCw,
  Send,
  User,
  Sparkles
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface ActivityItem {
  id: string;
  agentName: string;
  action: string;
  icon: string;
  timestamp: string;
  preview?: string;
}

const iconMap: Record<string, { icon: typeof Send; color: string; bg: string }> = {
  "🤖": { icon: Bot, color: "text-blue-600", bg: "bg-gradient-to-br from-blue-400 to-blue-600" },
  "📩": { icon: MessageSquare, color: "text-emerald-600", bg: "bg-gradient-to-br from-emerald-400 to-teal-600" },
  "👤": { icon: User, color: "text-purple-600", bg: "bg-gradient-to-br from-purple-400 to-purple-600" },
};

function ActivityRow({ activity, isFirst }: { activity: ActivityItem; isFirst?: boolean }) {
  const config = iconMap[activity.icon] || iconMap["🤖"];
  const Icon = config.icon;

  const timeAgo = formatDistanceToNow(new Date(activity.timestamp), {
    addSuffix: true,
    locale: it,
  });

  return (
    <div className={cn(
      "group relative flex items-start gap-3 p-3 rounded-xl transition-all duration-200",
      "hover:bg-gradient-to-r hover:from-slate-50 hover:to-white",
      isFirst && "bg-gradient-to-r from-blue-50/50 to-white"
    )}>
      <div className="absolute left-[27px] top-[52px] bottom-0 w-0.5 bg-gradient-to-b from-slate-200 to-transparent group-last:hidden" />
      
      <div className={cn(
        "relative z-10 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg",
        config.bg,
        "transition-transform group-hover:scale-110"
      )}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-semibold text-sm text-slate-800">
            {activity.agentName}
          </span>
          <span className="text-sm text-slate-500">
            {activity.action}
          </span>
        </div>
        
        {activity.preview && (
          <div className="bg-slate-50 rounded-lg px-3 py-2 mt-2 border border-slate-100">
            <p className="text-xs text-slate-600 line-clamp-2 italic">
              "{activity.preview}"
            </p>
          </div>
        )}
        
        <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {timeAgo}
        </p>
      </div>
    </div>
  );
}

function ActivityRowSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-3 w-20" />
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
    <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-lg h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3 flex-row items-center justify-between bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-800">
        <CardTitle className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-300/30">
            <Activity className="h-5 w-5 text-white" />
          </div>
          Attivita Recenti
        </CardTitle>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className={cn(
            "p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all",
            isFetching && "animate-spin"
          )}
        >
          <RefreshCw className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </button>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-4">
        {isError ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-red-100 mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-sm font-medium text-red-600">Errore nel caricamento</p>
            <button 
              onClick={() => refetch()}
              className="mt-3 text-xs text-blue-600 hover:underline"
            >
              Riprova
            </button>
          </div>
        ) : (
          <ScrollArea className="h-full pr-2">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <ActivityRowSkeleton key={i} />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-slate-100 mb-4">
                  <Activity className="h-8 w-8 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600">Nessuna attivita recente</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                  Le attivita degli agenti appariranno qui quando inizieranno a interagire
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {activities.slice(0, 10).map((activity, index) => (
                  <ActivityRow 
                    key={activity.id} 
                    activity={activity} 
                    isFirst={index === 0}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
