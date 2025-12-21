import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, 
  Medal,
  TrendingUp,
  Crown,
  Award,
  Star,
  Zap,
  MessageSquare
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

function getRankStyle(rank: number) {
  switch (rank) {
    case 1:
      return {
        bg: "bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500",
        border: "border-amber-400/50 shadow-amber-200/50",
        icon: <Crown className="h-4 w-4 text-white" />,
        glow: "shadow-lg shadow-amber-300/30"
      };
    case 2:
      return {
        bg: "bg-gradient-to-r from-slate-300 via-gray-300 to-slate-400",
        border: "border-slate-300/50 shadow-slate-200/50",
        icon: <Medal className="h-4 w-4 text-white" />,
        glow: "shadow-md shadow-slate-300/20"
      };
    case 3:
      return {
        bg: "bg-gradient-to-r from-amber-600 via-orange-500 to-amber-700",
        border: "border-amber-500/50 shadow-amber-200/50",
        icon: <Award className="h-4 w-4 text-white" />,
        glow: "shadow-md shadow-amber-400/20"
      };
    default:
      return {
        bg: "bg-gradient-to-r from-slate-500 to-slate-600",
        border: "border-slate-300/30",
        icon: <Star className="h-3 w-3 text-white" />,
        glow: ""
      };
  }
}

function getScoreColor(score: number) {
  if (score >= 80) return { text: "text-emerald-600", bg: "bg-emerald-500", label: "Eccellente" };
  if (score >= 60) return { text: "text-blue-600", bg: "bg-blue-500", label: "Buono" };
  if (score >= 40) return { text: "text-amber-600", bg: "bg-amber-500", label: "Medio" };
  return { text: "text-slate-500", bg: "bg-slate-400", label: "Base" };
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
  const rankStyle = getRankStyle(rank);
  const scoreStyle = getScoreColor(agent.performanceScore);
  const isTopThree = rank <= 3;

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-4 p-4 rounded-xl transition-all duration-300 cursor-pointer",
        "hover:scale-[1.02] hover:shadow-lg",
        isTopThree 
          ? "bg-gradient-to-r from-slate-50 to-white border border-slate-100" 
          : "hover:bg-slate-50/80",
        rank === 1 && "bg-gradient-to-r from-amber-50/80 via-yellow-50/60 to-orange-50/40 border-amber-200/50"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm",
        rankStyle.bg, rankStyle.glow,
        "transition-transform group-hover:scale-110"
      )}>
        {rank <= 3 ? rankStyle.icon : <span className="text-white text-xs">{rank}</span>}
      </div>

      <div className={cn(
        "w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg",
        "shadow-inner",
        agent.status === "active" 
          ? "bg-gradient-to-br from-emerald-400 to-teal-600" 
          : "bg-gradient-to-br from-slate-400 to-slate-600"
      )}>
        {agent.name.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className={cn(
            "font-semibold text-sm truncate",
            rank === 1 ? "text-amber-900" : "text-slate-800"
          )}>
            {agent.name}
          </p>
          {agent.status === "active" && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <MessageSquare className="h-3 w-3" />
            <span>{agent.conversationsToday || 0} conv.</span>
          </div>
          <Badge 
            variant="outline" 
            className={cn(
              "text-[10px] px-1.5 py-0 border-0",
              agent.status === "active" 
                ? "bg-emerald-100 text-emerald-700" 
                : "bg-slate-100 text-slate-600"
            )}
          >
            {agent.status === "active" ? "Attivo" : "In pausa"}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 min-w-[80px]">
        <div className="flex items-center gap-1">
          <span className={cn("text-xl font-bold", scoreStyle.text)}>
            {agent.performanceScore}
          </span>
          <span className="text-xs text-slate-400">pt</span>
        </div>
        <div className="w-full">
          <Progress 
            value={agent.performanceScore} 
            className="h-1.5 bg-slate-100"
          />
        </div>
        <span className={cn("text-[10px]", scoreStyle.text)}>{scoreStyle.label}</span>
      </div>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50/50">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-6 w-12 ml-auto" />
            <Skeleton className="h-1.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AgentLeaderboard({ agents, isLoading, onSelectAgent }: AgentLeaderboardProps) {
  const sortedAgents = [...agents].sort((a, b) => b.performanceScore - a.performanceScore);

  return (
    <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/80 shadow-xl shadow-slate-200/50 overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-300/30">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            Classifica Agenti
          </CardTitle>
          <Badge className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-0 shadow-sm">
            <Zap className="h-3 w-3 mr-1" />
            Top {Math.min(agents.length, 5)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        {isLoading ? (
          <LeaderboardSkeleton />
        ) : sortedAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-slate-100 mb-4">
              <Trophy className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">Nessun agente configurato</p>
            <p className="text-xs text-slate-400 mt-1">Crea il tuo primo agente per vedere la classifica</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedAgents.slice(0, 5).map((agent, index) => (
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
