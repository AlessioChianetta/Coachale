import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Bot, 
  CheckCircle, 
  PauseCircle, 
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  BarChart3,
  Shield,
  Star,
  Crown
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LevelBadge } from "./LevelBadge";

// TODO: Connect to real tier data from agents
export type AgentTier = "base" | "bronzo" | "argento" | "deluxe";

export const tierConfig: Record<AgentTier, { 
  label: string; 
  icon: React.ElementType; 
  emoji: string;
  color: string; 
  bgColor: string;
  borderColor: string;
}> = {
  base: {
    label: "Base",
    icon: BarChart3,
    emoji: "📊",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-200",
  },
  bronzo: {
    label: "Bronzo",
    icon: Shield,
    emoji: "🛡️",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  argento: {
    label: "Argento",
    icon: Star,
    emoji: "⭐",
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  deluxe: {
    label: "Deluxe",
    icon: Crown,
    emoji: "👑",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
};

interface Agent {
  id: string;
  name: string;
  agentType: string;
  status: "active" | "paused" | "test";
  performanceScore: number;
  trend: "up" | "down" | "stable";
  conversationsToday: number;
  level?: "1" | "2" | null;
  tier?: AgentTier;
}

interface AgentRosterProps {
  onSelectAgent: (agent: Agent) => void;
  selectedAgentId?: string | null;
}

const statusConfig = {
  active: {
    label: "Attivo",
    icon: CheckCircle,
    color: "bg-green-100 text-green-700 border-green-200",
    dotColor: "bg-green-500",
  },
  paused: {
    label: "In Pausa",
    icon: PauseCircle,
    color: "bg-amber-100 text-amber-700 border-amber-200",
    dotColor: "bg-amber-500",
  },
  test: {
    label: "Test",
    icon: FlaskConical,
    color: "bg-blue-100 text-blue-700 border-blue-200",
    dotColor: "bg-blue-500",
  },
};

const agentTypeLabels: Record<string, string> = {
  reactive_lead: "Lead Reattivo",
  proactive_setter: "Setter Proattivo",
  informative_advisor: "Advisor Informativo",
  customer_success: "Customer Success",
  intake_coordinator: "Coordinatore Intake",
};

function TierBadge({ tier }: { tier: AgentTier }) {
  const config = tierConfig[tier];
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border",
      config.bgColor, config.color, config.borderColor
    )}>
      {config.emoji}
    </span>
  );
}

function AgentCard({ 
  agent, 
  isSelected, 
  onClick 
}: { 
  agent: Agent; 
  isSelected: boolean; 
  onClick: () => void;
}) {
  const status = statusConfig[agent.status] || statusConfig.active;
  const StatusIcon = status.icon;

  const TrendIcon = agent.trend === "up" ? TrendingUp : agent.trend === "down" ? TrendingDown : Minus;
  const trendColor = agent.trend === "up" ? "text-green-500" : agent.trend === "down" ? "text-red-500" : "text-slate-400";

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-all",
        "hover:border-blue-300 hover:bg-blue-50/50",
        isSelected 
          ? "border-blue-500 bg-blue-50 shadow-sm" 
          : "border-slate-200 bg-white"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm",
          isSelected ? "bg-blue-600" : "bg-slate-600"
        )}>
          {agent.name.charAt(0).toUpperCase()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "font-medium text-sm truncate",
              isSelected ? "text-blue-900" : "text-slate-900"
            )}>
              {agent.name}
            </span>
            <div className={cn("w-2 h-2 rounded-full", status.dotColor)} />
            {agent.tier && <TierBadge tier={agent.tier} />}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{agentTypeLabels[agent.agentType] || agent.agentType}</span>
            {agent.level && <LevelBadge level={agent.level} size="sm" />}
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    agent.performanceScore >= 80 ? "bg-green-500" :
                    agent.performanceScore >= 60 ? "bg-amber-500" : "bg-red-500"
                  )}
                  style={{ width: `${agent.performanceScore}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-600">
                {agent.performanceScore}%
              </span>
            </div>
            <TrendIcon className={cn("h-3 w-3", trendColor)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentCardSkeleton() {
  return (
    <div className="p-3 rounded-lg border border-slate-200 bg-white">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      </div>
    </div>
  );
}

// TODO: Connect to real tier data from agents - for now using mock assignment based on agent index
function getMockTier(index: number): AgentTier {
  const tiers: AgentTier[] = ["base", "bronzo", "argento", "deluxe"];
  return tiers[index % 4];
}

export function AgentRoster({ onSelectAgent, selectedAgentId }: AgentRosterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");

  const { data, isLoading, isError } = useQuery<Agent[]>({
    queryKey: ["/api/whatsapp/agents/leaderboard"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/agents/leaderboard", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch agents");
      }
      const result = await response.json();
      const rawAgents = Array.isArray(result) ? result : (result.agents || []);
      
      // TODO: Connect to real tier data from agents
      return rawAgents.map((agent: any, index: number) => ({
        id: agent.id,
        name: agent.name || agent.agentName || "Agente",
        agentType: agent.type || agent.agentType || "reactive_lead",
        status: agent.isActive === false ? "paused" : (agent.status || "active"),
        performanceScore: agent.score || agent.performanceScore || 0,
        trend: agent.trend || "stable",
        conversationsToday: agent.conversations7d || agent.conversationsToday || 0,
        level: agent.level || null,
        tier: agent.tier || getMockTier(index),
      }));
    },
    staleTime: 30000,
  });

  const agents = data || [];

  // Count agents per tier
  const tierCounts = useMemo(() => {
    return {
      base: agents.filter(a => a.tier === "base").length,
      bronzo: agents.filter(a => a.tier === "bronzo").length,
      argento: agents.filter(a => a.tier === "argento").length,
      deluxe: agents.filter(a => a.tier === "deluxe").length,
    };
  }, [agents]);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || agent.status === statusFilter;
      const matchesTier = tierFilter === "all" || agent.tier === tierFilter;
      return matchesSearch && matchesStatus && matchesTier;
    });
  }, [agents, searchQuery, statusFilter, tierFilter]);

  const groupedAgents = useMemo(() => {
    const groups: Record<string, Agent[]> = {
      active: [],
      paused: [],
      test: [],
    };
    
    filteredAgents.forEach((agent) => {
      if (groups[agent.status]) {
        groups[agent.status].push(agent);
      }
    });
    
    return groups;
  }, [filteredAgents]);

  if (isError) {
    return (
      <Card className="bg-white border border-slate-200 h-full">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center text-center py-8">
            <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
            <p className="text-sm text-red-600">Errore nel caricamento agenti</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border border-slate-200 h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-600" />
          Roster Agenti
        </CardTitle>
        
        <div className="space-y-2 mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cerca agente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200"
            />
          </div>
          
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-50 border-slate-200 flex-1">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="active">Attivi</SelectItem>
                <SelectItem value="paused">Pausa</SelectItem>
                <SelectItem value="test">Test</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="bg-slate-50 border-slate-200 flex-1">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="base">📊 Base</SelectItem>
                <SelectItem value="bronzo">🛡️ Bronzo</SelectItem>
                <SelectItem value="argento">⭐ Argento</SelectItem>
                <SelectItem value="deluxe">👑 Deluxe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Tier Counters */}
          <div className="grid grid-cols-2 gap-1.5 pt-2">
            <div className={cn("flex items-center justify-between px-2 py-1 rounded text-xs", tierConfig.base.bgColor, tierConfig.base.borderColor, "border")}>
              <span className={tierConfig.base.color}>📊 Base</span>
              <span className={cn("font-semibold", tierConfig.base.color)}>{tierCounts.base}</span>
            </div>
            <div className={cn("flex items-center justify-between px-2 py-1 rounded text-xs", tierConfig.bronzo.bgColor, tierConfig.bronzo.borderColor, "border")}>
              <span className={tierConfig.bronzo.color}>🛡️ Bronzo</span>
              <span className={cn("font-semibold", tierConfig.bronzo.color)}>{tierCounts.bronzo}</span>
            </div>
            <div className={cn("flex items-center justify-between px-2 py-1 rounded text-xs", tierConfig.argento.bgColor, tierConfig.argento.borderColor, "border")}>
              <span className={tierConfig.argento.color}>⭐ Argento</span>
              <span className={cn("font-semibold", tierConfig.argento.color)}>{tierCounts.argento}</span>
            </div>
            <div className={cn("flex items-center justify-between px-2 py-1 rounded text-xs", tierConfig.deluxe.bgColor, tierConfig.deluxe.borderColor, "border")}>
              <span className={tierConfig.deluxe.color}>👑 Deluxe</span>
              <span className={cn("font-semibold", tierConfig.deluxe.color)}>{tierCounts.deluxe}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <AgentCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="h-12 w-12 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Nessun agente trovato</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedAgents).map(([status, statusAgents]) => {
                if (statusAgents.length === 0) return null;
                const config = statusConfig[status as keyof typeof statusConfig];
                
                return (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <Badge variant="outline" className={cn("text-xs", config.color)}>
                        {config.label}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {statusAgents.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {statusAgents.map((agent) => (
                        <AgentCard
                          key={agent.id}
                          agent={agent}
                          isSelected={selectedAgentId === agent.id}
                          onClick={() => onSelectAgent(agent)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
