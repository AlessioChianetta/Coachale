import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Crown, 
  CheckCircle, 
  PauseCircle, 
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Users
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

interface EmployeeRosterProps {
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

function EmployeeAgentCard({ 
  agent, 
  isSelected, 
  onClick 
}: { 
  agent: Agent; 
  isSelected: boolean; 
  onClick: () => void;
}) {
  const status = statusConfig[agent.status] || statusConfig.active;

  const TrendIcon = agent.trend === "up" ? TrendingUp : agent.trend === "down" ? TrendingDown : Minus;
  const trendColor = agent.trend === "up" ? "text-green-500" : agent.trend === "down" ? "text-red-500" : "text-slate-400";

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-all",
        "hover:border-amber-300 hover:bg-amber-50/50",
        isSelected 
          ? "border-amber-500 bg-amber-50 shadow-sm" 
          : "border-slate-200 bg-white"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm",
          isSelected ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-amber-400 to-orange-400"
        )}>
          {agent.name.charAt(0).toUpperCase()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "font-medium text-sm truncate",
              isSelected ? "text-amber-900" : "text-slate-900"
            )}>
              {agent.name}
            </span>
            <div className={cn("w-2 h-2 rounded-full", status.dotColor)} />
          </div>
          
          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
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

function EmployeeAgentCardSkeleton() {
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

export function EmployeeRoster({ onSelectAgent, selectedAgentId }: EmployeeRosterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");

  const { data, isLoading, isError } = useQuery<Agent[]>({
    queryKey: ["/api/whatsapp/agents"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/agents", {
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

  const employeeAgents = useMemo(() => {
    return agents.filter((agent) => agent.levels && agent.levels.length > 0);
  }, [agents]);

  const filteredAgents = useMemo(() => {
    return employeeAgents.filter((agent) => {
      const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesTier = true;
      if (tierFilter === "bronze") {
        matchesTier = agent.levels?.includes("1") || false;
      } else if (tierFilter === "silver") {
        matchesTier = agent.levels?.includes("2") || false;
      }
      
      return matchesSearch && matchesTier;
    });
  }, [employeeAgents, searchQuery, tierFilter]);

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

  const tierStats = useMemo(() => {
    const bronzeCount = employeeAgents.filter(a => a.levels?.includes("1")).length;
    const silverCount = employeeAgents.filter(a => a.levels?.includes("2")).length;
    return { bronze: bronzeCount, silver: silverCount, total: employeeAgents.length };
  }, [employeeAgents]);

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
          <Crown className="h-5 w-5 text-amber-500" />
          Agenti Dipendenti AI
        </CardTitle>
        
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            {tierStats.bronze} Bronze
          </Badge>
          <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
            {tierStats.silver} Silver
          </Badge>
        </div>
        
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
          
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="bg-slate-50 border-slate-200">
              <SelectValue placeholder="Filtra per tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tier</SelectItem>
              <SelectItem value="bronze">Bronze (Livello 1)</SelectItem>
              <SelectItem value="silver">Silver (Livello 2)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <EmployeeAgentCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">
                {employeeAgents.length === 0 
                  ? "Nessun agente configurato per dipendenti" 
                  : "Nessun agente trovato con i filtri selezionati"}
              </p>
              {employeeAgents.length === 0 && (
                <p className="text-xs text-slate-400 mt-2">
                  Configura un agente con livelli Bronze o Silver per vederlo qui
                </p>
              )}
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
                        <EmployeeAgentCard
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
