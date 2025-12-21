import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Trophy, 
  Medal,
  TrendingUp,
  TrendingDown,
  Minus,
  Crown,
  Award,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  agentType: string;
  status: "active" | "paused" | "test";
  performanceScore: number;
  trend: "up" | "down" | "stable";
  conversationsToday?: number;
}

interface AgentLeaderboardProps {
  agents: Agent[];
  isLoading?: boolean;
  onSelectAgent?: (agent: Agent) => void;
}

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Crown className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-slate-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-600" />;
    default:
      return <Star className="h-4 w-4 text-slate-300" />;
  }
}

function getRankBadgeStyle(rank: number) {
  switch (rank) {
    case 1:
      return "bg-gradient-to-r from-yellow-400 to-yellow-500 text-white border-yellow-500";
    case 2:
      return "bg-gradient-to-r from-slate-300 to-slate-400 text-white border-slate-400";
    case 3:
      return "bg-gradient-to-r from-amber-500 to-amber-600 text-white border-amber-600";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function LeaderboardRow({ 
  agent, 
  rank, 
  onClick 
}: { 
  agent: Agent; 
  rank: number; 
  onClick?: () => void;
}) {
  const TrendIcon = agent.trend === "up" ? TrendingUp : agent.trend === "down" ? TrendingDown : Minus;
  const trendColor = agent.trend === "up" ? "text-green-500" : agent.trend === "down" ? "text-red-500" : "text-slate-400";
  
  const isTopThree = rank <= 3;

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer",
        isTopThree ? "bg-slate-50 hover:bg-slate-100" : "hover:bg-slate-50",
        rank === 1 && "bg-gradient-to-r from-yellow-50 to-amber-50 hover:from-yellow-100 hover:to-amber-100"
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border",
        getRankBadgeStyle(rank)
      )}>
        {rank <= 3 ? getRankIcon(rank) : rank}
      </div>

      <div className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm",
        rank === 1 ? "bg-gradient-to-br from-yellow-500 to-amber-600" :
        rank === 2 ? "bg-gradient-to-br from-slate-400 to-slate-500" :
        rank === 3 ? "bg-gradient-to-br from-amber-500 to-amber-600" :
        "bg-slate-500"
      )}>
        {agent.name.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-medium text-sm truncate",
          rank === 1 ? "text-amber-900" : "text-slate-900"
        )}>
          {agent.name}
        </p>
        <p className="text-xs text-slate-500">
          {agent.conversationsToday || 0} conversazioni oggi
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className={cn(
            "font-bold text-lg",
            agent.performanceScore >= 80 ? "text-green-600" :
            agent.performanceScore >= 60 ? "text-amber-600" : "text-red-600"
          )}>
            {agent.performanceScore}
          </p>
          <p className="text-xs text-slate-400">punti</p>
        </div>
        <TrendIcon className={cn("h-4 w-4", trendColor)} />
      </div>
    </div>
  );
}

function LeaderboardRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="w-8 h-8 rounded-full" />
      <Skeleton className="w-9 h-9 rounded-full" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-6 w-12" />
    </div>
  );
}

export function AgentLeaderboard({ agents, isLoading, onSelectAgent }: AgentLeaderboardProps) {
  const sortedAgents = [...agents]
    .sort((a, b) => b.performanceScore - a.performanceScore)
    .slice(0, 5);

  return (
    <Card className="bg-white border border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Classifica Agenti
          <Badge variant="outline" className="ml-auto text-xs bg-amber-50 text-amber-700 border-amber-200">
            Top 5
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <div className="space-y-1">
            {[...Array(5)].map((_, i) => (
              <LeaderboardRowSkeleton key={i} />
            ))}
          </div>
        ) : sortedAgents.length === 0 ? (
          <div className="text-center py-8">
            <Trophy className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nessun agente in classifica</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sortedAgents.map((agent, index) => (
              <LeaderboardRow
                key={agent.id}
                agent={agent}
                rank={index + 1}
                onClick={() => onSelectAgent?.(agent)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
