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
  AlertCircle,
  MessageCircle
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";

import avatarPool1 from "@assets/generated_images/agent_avatar_pool_1.png";
import avatarPool2 from "@assets/generated_images/agent_avatar_pool_2.png";
import avatarPool3 from "@assets/generated_images/agent_avatar_pool_3.png";
import avatarPool4 from "@assets/generated_images/agent_avatar_pool_4.png";
import avatarPool5 from "@assets/generated_images/agent_avatar_pool_5.png";
import avatarPool6 from "@assets/generated_images/agent_avatar_pool_6.png";
import avatarPool7 from "@assets/generated_images/agent_avatar_pool_7.png";
import avatarPool8 from "@assets/generated_images/agent_avatar_pool_8.png";

const avatarPool = [avatarPool1, avatarPool2, avatarPool3, avatarPool4, avatarPool5, avatarPool6, avatarPool7, avatarPool8];

function getAgentAvatar(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) - hash) + agentId.charCodeAt(i);
    hash |= 0;
  }
  return avatarPool[Math.abs(hash) % avatarPool.length];
}

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

  return (
    <div
      onClick={onClick}
      className={cn(
        "px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group",
        isSelected 
          ? "bg-blue-50 dark:bg-blue-900/20 shadow-sm ring-1 ring-blue-200 dark:ring-blue-700" 
          : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-9 h-9 rounded-full flex-shrink-0 overflow-hidden",
          isSelected ? "ring-2 ring-blue-400" : "ring-1 ring-gray-200 dark:ring-gray-700"
        )}>
          <img 
            src={getAgentAvatar(agent.id)} 
            alt={agent.name} 
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium text-sm truncate",
              isSelected ? "text-blue-900 dark:text-blue-100" : "text-gray-800 dark:text-gray-200"
            )}>
              {agent.name}
            </span>
            <div className={cn("w-2 h-2 rounded-full flex-shrink-0", status.dotColor)} />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <MessageCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {agentTypeLabels[agent.agentType] || agent.agentType}
            </span>
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <span className={cn(
            "text-sm font-bold",
            agent.performanceScore >= 80 ? "text-green-600" :
            agent.performanceScore >= 60 ? "text-amber-600" : "text-red-500"
          )}>
            {agent.performanceScore}%
          </span>
        </div>
      </div>
    </div>
  );
}

function AgentCardSkeleton() {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-4 w-8" />
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
      <Card className="bg-white dark:bg-gray-900 shadow-md border-0 rounded-2xl h-full">
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
    <Card className="bg-white dark:bg-gray-900 shadow-md border-0 rounded-2xl h-full flex flex-col">
      <CardHeader className="pb-3 px-4 pt-4">
        <CardTitle className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2.5">
          <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
            <Bot className="h-4 w-4 text-white" />
          </div>
          Roster Dipendenti
          <span className="text-xs font-normal text-gray-400 ml-auto">{agents.length}</span>
        </CardTitle>
        
        <div className="flex items-center gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Cerca..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-gray-50 dark:bg-gray-800 border-0 shadow-sm rounded-lg focus-visible:ring-1 focus-visible:ring-blue-300"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[100px] h-8 text-xs bg-gray-50 dark:bg-gray-800 border-0 shadow-sm rounded-lg">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="active">Attivi</SelectItem>
              <SelectItem value="paused">In Pausa</SelectItem>
              <SelectItem value="test">Test</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-2 pb-3">
          {isLoading ? (
            <div className="space-y-1">
              {[...Array(5)].map((_, i) => (
                <AgentCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bot className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">Nessun agente trovato</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedAgents).map(([status, statusAgents]) => {
                if (statusAgents.length === 0) return null;
                const config = statusConfig[status as keyof typeof statusConfig];
                
                return (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-1 px-3">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                        {config.label}
                      </span>
                      <span className="text-[10px] text-gray-300">
                        {statusAgents.length}
                      </span>
                    </div>
                    <div className="space-y-0.5">
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
