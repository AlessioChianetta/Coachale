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
  AlertCircle
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LevelBadges } from "./LevelBadge";

interface Agent {
  id: string;
  name: string;
  agentType: string;
  status: "active" | "paused" | "test";
  performanceScore: number;
  trend: "up" | "down" | "stable";
  conversationsToday: number;
  level?: "1" | "2" | null;
  levels?: ("1" | "2")[];
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
        "p-4 rounded-xl border cursor-pointer transition-all duration-200",
        "hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md hover:-translate-y-0.5",
        isSelected 
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm" 
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm",
          isSelected ? "bg-gradient-to-br from-blue-500 to-blue-600" : "bg-gradient-to-br from-gray-500 to-gray-600"
        )}>
          {agent.name.charAt(0).toUpperCase()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "font-medium text-sm truncate",
              isSelected ? "text-blue-900 dark:text-blue-100" : "text-gray-900 dark:text-gray-100"
            )}>
              {agent.name}
            </span>
            <div className={cn("w-2 h-2 rounded-full ring-2 ring-white dark:ring-gray-800", status.dotColor)} />
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{agentTypeLabels[agent.agentType] || agent.agentType}</span>
            {agent.levels && agent.levels.length > 0 && <LevelBadges levels={agent.levels} />}
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

export function AgentRoster({ onSelectAgent, selectedAgentId }: AgentRosterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
      
      return rawAgents.map((agent: any) => ({
        id: agent.id,
        name: agent.name || agent.agentName || "Agente",
        agentType: agent.type || agent.agentType || "reactive_lead",
        status: agent.isActive === false ? "paused" : (agent.status || "active"),
        performanceScore: agent.score || agent.performanceScore || 0,
        trend: agent.trend || "stable",
        conversationsToday: agent.conversations7d || agent.conversationsToday || 0,
        level: agent.level || null,
        levels: agent.levels || [],
      }));
    },
    staleTime: 30000,
  });

  const agents = data || [];

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || agent.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [agents, searchQuery, statusFilter]);

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
    <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          Roster Agenti
        </CardTitle>
        
        <div className="space-y-2 mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cerca agente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl">
              <SelectValue placeholder="Filtra per stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              <SelectItem value="active">Attivi</SelectItem>
              <SelectItem value="paused">In Pausa</SelectItem>
              <SelectItem value="test">Test</SelectItem>
            </SelectContent>
          </Select>
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
